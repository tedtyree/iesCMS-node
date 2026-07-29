CREATE TABLE IF NOT EXISTS app_log (
    id SERIAL NOT NULL PRIMARY KEY,
    event VARCHAR(60) NOT NULL,
    level VARCHAR(10) NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    context VARCHAR(60) DEFAULT NULL,
    detail JSONB DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS app_log_created_idx ON app_log (created_at DESC);
