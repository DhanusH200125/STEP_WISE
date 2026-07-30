-- Migration 005: Activity Logs & Weekly Reports (FR-10, FR-11)

CREATE TYPE log_event_type AS ENUM (
  'task_created', 'task_updated', 'task_completed', 'task_skipped',
  'slot_rescheduled', 'slot_missed', 'slot_completed',
  'sprint_generated', 'sprint_accepted', 'sprint_modified'
);

CREATE TABLE activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  log_event_type NOT NULL,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  slot_id     UUID REFERENCES scheduled_slots(id) ON DELETE SET NULL,
  sprint_id   UUID REFERENCES weekly_sprints(id) ON DELETE SET NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE weekly_reports (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sprint_id                 UUID NOT NULL UNIQUE REFERENCES weekly_sprints(id) ON DELETE CASCADE,
  week_start                DATE NOT NULL,
  tasks_planned             INTEGER NOT NULL DEFAULT 0,
  tasks_completed           INTEGER NOT NULL DEFAULT 0,
  tasks_missed              INTEGER NOT NULL DEFAULT 0,
  completion_rate           NUMERIC(5,2),
  minutes_by_domain         JSONB NOT NULL DEFAULT '{}',
  growth_minutes_planned    INTEGER NOT NULL DEFAULT 0,
  growth_minutes_completed  INTEGER NOT NULL DEFAULT 0,
  growth_consistency_score  NUMERIC(5,2),
  productivity_patterns     JSONB NOT NULL DEFAULT '{}',
  suggestions               JSONB NOT NULL DEFAULT '[]',
  generated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_event_type ON activity_logs(event_type);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(user_id, created_at DESC);
CREATE INDEX idx_activity_logs_task_id ON activity_logs(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX idx_weekly_reports_user_id ON weekly_reports(user_id);
CREATE INDEX idx_weekly_reports_week_start ON weekly_reports(user_id, week_start DESC);