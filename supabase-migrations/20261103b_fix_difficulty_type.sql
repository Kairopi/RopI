-- Fix: in the live database concept_cards.difficulty was created as INTEGER,
-- but FSRS difficulty is a decimal (e.g. 3.53), so every review failed with
-- "invalid input syntax for type integer".
-- Converting INTEGER -> FLOAT keeps every existing value exactly. Safe to re-run.

ALTER TABLE concept_cards
  ALTER COLUMN difficulty TYPE DOUBLE PRECISION USING difficulty::double precision;

NOTIFY pgrst, 'reload schema';
