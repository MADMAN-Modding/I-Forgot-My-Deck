ALTER TABLE accounts ADD verified boolean;

CREATE TABLE IF NOT EXISTS codes (
    code VARCHAR(255),
    action VARCHAR(255),
    UNIQUE(code)
)