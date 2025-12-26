CREATE TABLE IF NOT EXISTS tokens (
    id VARCHAR(255),
    token VARCHAR(255),
    UNIQUE(token)
)