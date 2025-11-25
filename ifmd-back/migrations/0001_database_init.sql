--- Creates a table to store device information per minute
CREATE TABLE IF NOT EXISTS card_name_to_id_cache (
    name VARCHAR(255),
    id VARCHAR(255),
    url VARCHAR(255),
    UNIQUE(name, id, url)
);