// Keyword test bot for Flex Conversations SMS addresses.
//
// Point a Flex Conversations address (Webhook integration, onMessageAdded) at this
// function. It answers guest texts with canned keyword replies, and when the guest
// asks for an agent it hands the existing conversation to Flex through the
// Interactions API, so the agent sees the full history.
//
// This is a protected function, so Twilio Functions validates X-Twilio-Signature
// before the handler runs.
const { prepareStudioFunction, twilioExecute } = require(Runtime.getFunctions()['common/helpers/function-helper'].path);

const BOT_AUTHOR = 'Test Bot';

// Edit these to change the bot's replies. If a guest's text contains the keyword,
// they get that reply.
const KEYWORD_REPLIES = {
  hours: 'We are open daily from 9am to 10pm.',
  rooms: 'We offer standard rooms and suites. Text AGENT to book with a person.',
  parking: 'Guest parking is free in the garage next to the lobby.',
};

const MENU_REPLY = `Hi! I'm a test bot. Text HOURS, ROOMS, or PARKING to learn more, or AGENT to talk to a person.`;

const ESCALATION_KEYWORDS = ['agent', 'human', 'person', 'representative'];

// Carrier compliance keywords are handled by the Messaging Service, so the bot
// stays silent on them. "help" is one of these, which is why it isn't a bot keyword.
const COMPLIANCE_KEYWORDS = [
  'stop',
  'stopall',
  'unsubscribe',
  'cancel',
  'end',
  'quit',
  'start',
  'unstop',
  'help',
  'info',
];

const requiredParameters = [{ key: 'ConversationSid', purpose: 'conversation the message was added to' }];

const sendBotMessage = async (context, conversationSid, body) =>
  twilioExecute(context, (client) =>
    client.conversations.v1.conversations(conversationSid).messages.create({ author: BOT_AUTHOR, body }),
  );

const setAttributes = async (context, conversationSid, attributes) =>
  twilioExecute(context, (client) =>
    client.conversations.v1.conversations(conversationSid).update({ attributes: JSON.stringify(attributes) }),
  );

const getReply = (text) => {
  const keyword = Object.keys(KEYWORD_REPLIES).find((key) => text.includes(key));
  return keyword ? KEYWORD_REPLIES[keyword] : MENU_REPLY;
};

const escalate = async (context, conversationSid, guestAddress, attributes) => {
  // Mark the conversation first so any texts that arrive mid-escalation are ignored.
  await setAttributes(context, conversationSid, { ...attributes, escalated: true });
  await sendBotMessage(context, conversationSid, 'Connecting you to an agent. One moment, please.');

  const result = await twilioExecute(context, (client) =>
    client.flexApi.v1.interaction.create({
      channel: {
        type: 'sms',
        initiated_by: 'customer',
        properties: { media_channel_sid: conversationSid },
      },
      routing: {
        properties: {
          workspace_sid: context.TWILIO_FLEX_WORKSPACE_SID,
          workflow_sid: context.SMS_TEST_BOT_WORKFLOW_SID,
          task_channel_unique_name: context.SMS_TEST_BOT_TASK_CHANNEL || 'sms',
          attributes: {
            from: guestAddress,
            customerName: guestAddress,
            customerAddress: guestAddress,
            escalationReason: 'Guest asked for an agent',
          },
        },
      },
    }),
  );

  if (!result.success) {
    console.error(`(${context.PATH}) Interaction create failed for ${conversationSid}: ${result.message}`);
    // Hand the conversation back to the bot so the guest isn't left waiting on nobody.
    await setAttributes(context, conversationSid, { ...attributes, escalated: false });
    await sendBotMessage(context, conversationSid, "Sorry, we couldn't reach an agent right now. Please try again.");
  }
};

exports.handler = prepareStudioFunction(requiredParameters, async (context, event, callback, response, handleError) => {
  try {
    const { EventType, ConversationSid, Body = '', Author, Source } = event;

    // Only react to texts from the guest. Agent replies come from the Flex UI
    // (Source "SDK"). The bot's own replies are sent through the REST API, which
    // doesn't trigger conversation webhooks, so the author check is a safety net.
    if (EventType !== 'onMessageAdded' || Source === 'SDK' || Author === BOT_AUTHOR) {
      return callback(null, response);
    }

    const conversation = await twilioExecute(context, (client) =>
      client.conversations.v1.conversations(ConversationSid).fetch(),
    );
    if (!conversation.success) {
      return handleError(conversation.message);
    }

    const attributes = JSON.parse(conversation.data.attributes || '{}');
    if (attributes.escalated) {
      return callback(null, response);
    }

    const text = Body.trim().toLowerCase();
    if (COMPLIANCE_KEYWORDS.includes(text)) {
      return callback(null, response);
    }

    if (ESCALATION_KEYWORDS.some((keyword) => text.includes(keyword))) {
      await escalate(context, ConversationSid, Author, attributes);
    } else {
      await sendBotMessage(context, ConversationSid, getReply(text));
    }

    return callback(null, response);
  } catch (error) {
    return handleError(error);
  }
});
