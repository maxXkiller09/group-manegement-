-- Bot-managed invite links and first-join attribution.
-- A member is counted once per chat, even if Telegram sends duplicate updates
-- or the member leaves and joins again later.
CREATE TABLE IF NOT EXISTS chat_invite_links (
    invite_link VARCHAR(512) PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    name VARCHAR(64) NOT NULL DEFAULT '',
    creator_id BIGINT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_invite_links_chat
    ON chat_invite_links (chat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_invite_attributions (
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    invite_link VARCHAR(512) NOT NULL,
    inviter_id BIGINT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_invite_attributions_link
    ON chat_invite_attributions (invite_link, joined_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_invite_attributions_chat_joined
    ON chat_invite_attributions (chat_id, joined_at DESC);
