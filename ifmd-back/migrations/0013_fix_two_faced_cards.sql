-- Backfill is_two_faced for cards already in the cache whose name contains "//"
-- Note: this uses the name heuristic; newly fetched cards use the Scryfall layout field instead.
UPDATE card_name_to_id_cache SET is_two_faced = 1 WHERE name LIKE '%//%';
