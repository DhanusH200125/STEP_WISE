-- Migration 004: Weekly Sprints & Scheduled Slots (FR-6)

CREATE TYPE sprint_status AS ENUM ('draft', 'active', 'completed');
CREATE TYPE slot_status AS ENUM ('scheduled', 'completed', 'missed', 'rescheduled', 'skipped');

CREATE TABLE weekly_sprints (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start                  DATE NOT NULL,
    week_end                    DATE NOT NULL,
    status                      sprint_status NOT NULL DEFAULT 'draft',
    computed_capacity_minutes   INTEGER NOT NULL,
    realism_factor_used         NUMERIC(3,2) NOT NULL,
    planned_minutes             INTEGER NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, week_start),
    CONSTRAINT valid_week CHECK (week_end = week_start + INTERVAL '6 days')
);

CREATE TABLE scheduled_slots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id               UUID NOT NULL REFERENCES weekly_sprints(id) ON DELETE CASCADE,
    task_id                 UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scheduled_date          DATE NOT NULL,
    start_time              TIME NOT NULL,
    end_time                TIME NOT NULL,
    status                  slot_status NOT NULL DEFAULT 'scheduled',
    is_locked               BOOLEAN NOT NULL DEFAULT FALSE,
    recommendation_reason   TEXT,
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_slot_time CHECK (end_time > start_time)
);

CREATE TRIGGER set_updated_at_weekly_sprints
    BEFORE UPDATE ON weekly_sprints
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_scheduled_slots
    BEFORE UPDATE ON scheduled_slots
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_weekly_sprints_user_id ON weekly_sprints(user_id);
CREATE INDEX idx_weekly_sprints_week_start ON weekly_sprints(user_id, week_start);
CREATE INDEX idx_scheduled_slots_sprint_id ON scheduled_slots(sprint_id);
CREATE INDEX idx_scheduled_slots_user_date ON scheduled_slots(user_id, scheduled_date);