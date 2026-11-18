CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE app_status AS ENUM (
    'applied', 'viewed', 'interviewing', 'unlikely_to_progress', 'rejected', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  company_name TEXT NOT NULL,
  job_title TEXT NOT NULL,
  job_url TEXT,
  job_description TEXT,
  salary_range TEXT,
  status app_status DEFAULT 'applied',
  match_score INT CHECK (match_score IS NULL OR (match_score BETWEEN 0 AND 100)),
  strengths TEXT,
  gaps_and_risks TEXT,
  improvement_action_item TEXT,
  cover_letter_type TEXT DEFAULT 'generic' CHECK (cover_letter_type IN ('generic', 'custom')),
  cover_letter_content TEXT,
  last_email_snippet TEXT
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_applications_updated_at ON applications;
CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_applications_company ON applications(company_name);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_applications_job_url
  ON applications(job_url) WHERE job_url IS NOT NULL AND job_url <> '';
