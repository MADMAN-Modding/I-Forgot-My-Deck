--- Creates a table to store device information per minute
CREATE TABLE IF NOT EXISTS accounts (
    display_name VARCHAR(255),
    id VARCHAR(255),
    salt VARCHAR(255),
    pass VARCHAR(255),
    UNIQUE(id, salt, pass)
)