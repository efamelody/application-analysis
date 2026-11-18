-- Candidate profile and reusable evidence for CV tailoring.
CREATE TABLE IF NOT EXISTS candidate_profile (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  full_name TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  master_cv TEXT NOT NULL DEFAULT '',
  preferred_roles TEXT NOT NULL DEFAULT 'TypeScript Full-Stack Developer',
  preferred_locations TEXT NOT NULL DEFAULT 'Kuala Lumpur, Selangor',
  remote_preference TEXT NOT NULL DEFAULT 'Remote is acceptable when the role is junior and offers suitable training.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  technologies TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_candidate_profile_updated_at ON candidate_profile;
CREATE TRIGGER trg_candidate_profile_updated_at
  BEFORE UPDATE ON candidate_profile
  FOR EACH ROW EXECUTE FUNCTION set_profile_updated_at();

DROP TRIGGER IF EXISTS trg_profile_evidence_updated_at ON profile_evidence;
CREATE TRIGGER trg_profile_evidence_updated_at
  BEFORE UPDATE ON profile_evidence
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO candidate_profile (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
