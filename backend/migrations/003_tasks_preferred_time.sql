-- Migration 003b: Add preferred time hint to tasks
-- Allows users to specify when they want to do a task (FR-5 extension)

ALTER TABLE tasks
  ADD COLUMN preferred_date        DATE,
  ADD COLUMN preferred_start_time  TIME,
  ADD COLUMN preferred_end_time    TIME,
  ADD COLUMN is_time_hinted        BOOLEAN NOT NULL DEFAULT FALSE;

-- Ensure end > start when time hint is set (checked at app layer too)
ALTER TABLE tasks ADD CONSTRAINT preferred_time_valid CHECK (
  (is_time_hinted = FALSE) OR
  (is_time_hinted = TRUE AND preferred_date IS NOT NULL
    AND preferred_start_time IS NOT NULL
    AND preferred_end_time IS NOT NULL
    AND preferred_end_time > preferred_start_time)
);

CREATE INDEX idx_tasks_time_hinted ON tasks(user_id, preferred_date)
  WHERE is_time_hinted = TRUE;