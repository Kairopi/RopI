-- Company logos on saved jobs (the job sources give a logo URL; saved jobs showed only a letter).
-- Safe to re-run.
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS company_logo TEXT;

-- PostgREST caches the table shape: reload it so the new column is accepted right away
NOTIFY pgrst, 'reload schema';
