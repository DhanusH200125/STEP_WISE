-- Migration 002: Routines & Fixed Commitments (FR-3, FR-4)

CREATE TYPE day_of_week_type AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');

CREATE TABLE sleep_schedules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    sleep_time  TIME NOT NULL,
    wake_time   TIME NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE routine_blocks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    day_of_week day_of_week_type NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

CREATE TRIGGER set_updated_at_sleep_schedules
    BEFORE UPDATE ON sleep_schedules
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_routine_blocks
    BEFORE UPDATE ON routine_blocks
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_routine_blocks_user_id ON routine_blocks(user_id);
CREATE INDEX idx_routine_blocks_user_day ON routine_blocks(user_id, day_of_week);