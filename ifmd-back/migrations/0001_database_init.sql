--- Creates a table to store device information per minute
CREATE TABLE IF NOT EXISTS card_name_to_id_cache (
    card_name VARCHAR(255),
    card_id VARCHAR(255),
    card_url VARCHAR(255),
    UNIQUE(card_name, card_id, card_url)
);