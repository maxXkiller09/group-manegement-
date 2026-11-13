// Package referrals persists bot-managed invite links and their first observed
// join attribution. It deliberately stores only unique members per chat.
package referrals

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/divkix/Alita_Robot/alita/db"
	"github.com/divkix/Alita_Robot/alita/db/models"
)

func SaveInviteLink(link models.ChatInviteLink) error {
	if db.DB == nil {
		return errors.New("database not initialized")
	}
	if link.InviteLink == "" || link.ChatID == 0 || link.CreatorID == 0 {
		return errors.New("invite link, chat ID and creator ID are required")
	}
	if err := db.DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "invite_link"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "revoked"}),
	}).Create(&link).Error; err != nil {
		return fmt.Errorf("save chat invite link: %w", err)
	}
	return nil
}

// RecordJoin records the first join attributed to a managed invite link.
// false means this user was already attributed in this chat.
func RecordJoin(chatID, userID int64, inviteLink string, inviterID int64, joinedAt time.Time) (bool, error) {
	if db.DB == nil {
		return false, errors.New("database not initialized")
	}
	if chatID == 0 || userID == 0 || inviteLink == "" {
		return false, nil
	}
	row := models.ChatInviteAttribution{
		ChatID: chatID, UserID: userID, InviteLink: inviteLink,
		InviterID: inviterID, JoinedAt: joinedAt.UTC(),
	}
	result := db.DB.Clauses(clause.OnConflict{DoNothing: true}).Create(&row)
	if result.Error != nil {
		return false, fmt.Errorf("record chat invite attribution: %w", result.Error)
	}
	return result.RowsAffected == 1, nil
}

type LinkStats struct {
	InviteLink string `gorm:"column:invite_link" json:"invite_link"`
	InviterID  int64  `gorm:"column:inviter_id" json:"inviter_id"`
	Joined     int64  `gorm:"column:joined" json:"joined"`
}

// ListLinkStats returns unique attributed joins per invite link for one chat.
func ListLinkStats(chatID int64) ([]LinkStats, error) {
	if db.DB == nil {
		return nil, errors.New("database not initialized")
	}
	var rows []LinkStats
	err := db.DB.Model(&models.ChatInviteAttribution{}).
		Select("invite_link, inviter_id, COUNT(*) AS joined").
		Where("chat_id = ?", chatID).
		Group("invite_link, inviter_id").
		Order("joined DESC").
		Order("invite_link ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, fmt.Errorf("list chat invite stats: %w", err)
	}
	return rows, nil
}

// RecordManagedJoin attributes a membership update only when its invite URL was
// created and stored by this bot for the same chat.
func RecordManagedJoin(chatID, userID int64, inviteURL string, joinedAt time.Time) (bool, error) {
	if db.DB == nil { return false, errors.New("database not initialized") }
	if inviteURL == "" { return false, nil }
	var link models.ChatInviteLink
	if err := db.DB.Where("invite_link = ? AND chat_id = ? AND revoked = ?", inviteURL, chatID, false).First(&link).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) { return false, nil }
		return false, fmt.Errorf("find managed chat invite link: %w", err)
	}
	return RecordJoin(chatID, userID, inviteURL, link.CreatorID, joinedAt)
}
