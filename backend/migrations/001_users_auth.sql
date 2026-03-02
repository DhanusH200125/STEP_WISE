-- ============================================================
-- Migration 001: Users, Auth, and Preferences
-- ============================================================

-- Enum types
CREATE TYPE user_role AS ENUM ('student', 'professional');
CREATE TYPE notification_pref AS ENUM ('email', 'push', 'none');
CREATE TYPE day_of_week AS ENUM ('monday','tuesday','wednesday','thursday','friday','saturday','sunday');

-- Users table
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'student',
    timezone        VARCHAR(100) NOT NULL DEFAULT 'UTC',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User preferences (1:1 with users)
CREATE TABLE user_preferences (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    working_days                day_of_week[] NOT NULL DEFAULT '{monday,tuesday,wednesday,thursday,friday}',
    notification_pref           notification_pref NOT NULL DEFAULT 'none',
    growth_target_hours_weekly  NUMERIC(4,2) NOT NULL DEFAULT 5.0,
    quiet_hours_start           TIME,            -- e.g. 22:00
    quiet_hours_end             TIME,            -- e.g. 07:00
    realism_factor              NUMERIC(3,2) NOT NULL DEFAULT 0.70,  -- FR-4: default 0.7
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Refresh tokens for JWT rotation
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at trigger function (reused across tables)
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_user_preferences
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);