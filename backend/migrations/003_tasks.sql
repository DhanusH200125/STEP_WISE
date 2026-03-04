-- Migration 003: Task Backlog (FR-5)

CREATE TYPE task_domain AS ENUM ('work_study', 'personal_growth', 'health', 'life_admin');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE task_energy AS ENUM ('low', 'medium', 'high');
CREATE TYPE task_status AS ENUM ('backlog', 'planned', 'in_progress', 'completed', 'skipped');
CREATE TYPE deadline_type AS ENUM ('hard', 'soft');

CREATE TABLE tasks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    domain              task_domain NOT NULL,
    priority            task_priority NOT NULL DEFAULT 'medium',
    status              task_status NOT NULL DEFAULT 'backlog',
    estimated_minutes   INTEGER NOT NULL CHECK (estimated_minutes > 0),
    energy_level        task_energy NOT NULL DEFAULT 'medium',
    deadline            DATE,
    deadline_type       deadline_type,
    is_locked           BOOLEAN NOT NULL DEFAULT FALSE,
    actual_minutes      INTEGER,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT deadline_type_required CHECK (
        (deadline IS NULL AND deadline_type IS NULL) OR
        (deadline IS NOT NULL AND deadline_type IS NOT NULL)
    )
);

CREATE TRIGGER set_updated_at_tasks
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_domain ON tasks(user_id, domain);
CREATE INDEX idx_tasks_deadline ON tasks(deadline) WHERE deadline IS NOT NULL;