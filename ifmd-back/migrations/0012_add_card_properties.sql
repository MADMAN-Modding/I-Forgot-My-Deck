-- Add is_commander and is_two_faced columns to card_name_to_id_cache table
ALTER TABLE card_name_to_id_cache ADD is_commander;
ALTER TABLE card_name_to_id_cache ADD is_two_faced BOOLEAN DEFAULT false;