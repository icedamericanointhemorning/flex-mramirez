# FEATURE: remove-all
resource "twilio_taskrouter_workspaces_task_queues_v1" "template_example_everyone" {
  workspace_sid  = var.TWILIO_FLEX_WORKSPACE_SID
  friendly_name  = "Template Example Everyone"
  target_workers = "1==1"
  max_reserved_workers = 1
  task_order = "FIFO"
}

resource "twilio_taskrouter_workspaces_task_queues_v1" "template_example_sales" {
  workspace_sid  = var.TWILIO_FLEX_WORKSPACE_SID
  friendly_name  = "Template Example Sales"
  target_workers = "routing.skills HAS 'template_example_sales'"
  max_reserved_workers = 1
  task_order = "FIFO"
}

resource "twilio_taskrouter_workspaces_task_queues_v1" "template_example_support" {
  workspace_sid  = var.TWILIO_FLEX_WORKSPACE_SID
  friendly_name  = "Template Example Support"
  target_workers = "routing.skills HAS 'template_example_support'"
  max_reserved_workers = 1
  task_order = "FIFO"
}

resource "twilio_taskrouter_workspaces_task_queues_v1" "template_example_after_hours" {
  workspace_sid  = var.TWILIO_FLEX_WORKSPACE_SID
  friendly_name  = "Template Example After Hours"
  # No worker matches, so after-hours tasks are only recorded for reporting, never offered.
  target_workers = "1==2"
  max_reserved_workers = 1
  task_order = "FIFO"
}

resource "twilio_taskrouter_workspaces_workflows_v1" "template_example_assign_to_anyone" {
  workspace_sid = var.TWILIO_FLEX_WORKSPACE_SID
  friendly_name = "Template Example Assign to Anyone"
  configuration = templatefile("workflows/template_example_assign_to_anyone.json", {
    "QUEUE_SID_EVERYONE" = twilio_taskrouter_workspaces_task_queues_v1.template_example_everyone.sid
    "QUEUE_SID_TEMPLATE_EXAMPLE_SALES" = twilio_taskrouter_workspaces_task_queues_v1.template_example_sales.sid
    "QUEUE_SID_TEMPLATE_EXAMPLE_SUPPORT" = twilio_taskrouter_workspaces_task_queues_v1.template_example_support.sid
    "QUEUE_SID_TEMPLATE_EXAMPLE_AFTER_HOURS" = twilio_taskrouter_workspaces_task_queues_v1.template_example_after_hours.sid
  })
}
# END FEATURE: remove-all