-- Add columns
ALTER TABLE codes
ADD COLUMN time TEXT;

ALTER TABLE tokens
ADD COLUMN time TEXT;

-- Backfill using current timestamp
UPDATE codes
SET time = CURRENT_TIMESTAMP
WHERE time IS NULL;

UPDATE tokens
SET time = CURRENT_TIMESTAMP
WHERE time IS NULL;