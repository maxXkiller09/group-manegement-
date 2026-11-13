package models

import "time"

// ChatInviteLink stores a bot-managed invite link for one Telegram chat.
// The invite URL is the primary key because Telegram returns it as the
// stable identifier for subsequent membership updates.
type ChatInviteLink struct {
	InviteLink  string    `gorm:"column:invite_link;primaryKey;size:512" json:"invite_link"`
	ChatID      int64     `gorm:"column:chat_id;not null;index:idx_chat_invite_links_chat" json:"chat_id"`
	Name        string    `gorm:"column:name;not null;default:'';size:64" json:"name"`
	CreatorID   int64     `gorm:"column:creator_id;not null" json:"creator_id"`
	Revoked     bool      `gorm:"column:revoked;not null;default:false" json:"revoked"`
	CreatedAt   time.Time `gorm:"column:created_at;not null;autoCreateTime" json:"created_at"`
}

func (ChatInviteLink) TableName() string { return "chat_invite_links" }

// ChatInviteAttribution records the first observed join source for a user in
// a chat. The composite key prevents duplicate updates and repeat joins from
// inflating unique referral totals.
type ChatInviteAttribution struct {
	ChatID       int64     `gorm:"column:chat_id;primaryKey;autoIncrement:false" json:"chat_id"`
	UserID       int64     `gorm:"column:user_id;primaryKey;autoIncrement:false" json:"user_id"`
	InviteLink   string    `gorm:"column:invite_link;not null;size:512;index:idx_chat_invite_attributions_link" json:"invite_link"`
	InviterID    int64     `gorm:"column:inviter_id;not null" json:"inviter_id"`
	JoinedAt     time.Time `gorm:"column:joined_at;not null" json:"joined_at"`
}

func (ChatInviteAttribution) TableName() string { return "chat_invite_attributions" }
