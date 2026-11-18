-- Job discovery metadata. Existing application records remain intact.
ALTER TYPE app_status ADD VALUE IF NOT EXISTS 'discovered';
ALTER TYPE app_status ADD VALUE IF NOT EXISTS 'reviewing';
ALTER TYPE app_status ADD VALUE IF NOT EXISTS 'shortlisted';

ALTER TABLE applications ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS source_message_id TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_remote BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS training_signals TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS cv_suggestions TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS discovered_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_applications_source_message
  ON applications(source_message_id)
  WHERE source_message_id IS NOT NULL AND source_message_id <> '';
