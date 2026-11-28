-- Track Telegram basic-group → supergroup ID migrations.
-- Old chat rows are retained as inactive history; settings and child rows are
-- reassigned to the new ID by the application in one transaction.
CREATE TABLE IF NOT EXISTS chat_id_migrations (
    old_chat_id BIGINT PRIMARY KEY,
    new_chat_id BIGINT NOT NULL UNIQUE,
    migrated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_chat_id_migrations_distinct CHECK (old_chat_id <> new_chat_id)
);
