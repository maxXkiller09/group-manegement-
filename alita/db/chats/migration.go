package chats

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/divkix/Alita_Robot/alita/db"
	"github.com/divkix/Alita_Robot/alita/db/cache"
	"github.com/divkix/Alita_Robot/alita/db/models"
)

var (
	ErrChatMigrationSourceNotFound = errors.New("source chat not found")
	ErrChatMigrationTargetExists   = errors.New("target chat ID already has data")
	ErrChatMigrationConflict       = errors.New("chat ID migration conflicts with an existing mapping")
)

type chatIDMigration struct {
	OldChatID int64     `gorm:"column:old_chat_id;primaryKey"`
	NewChatID int64     `gorm:"column:new_chat_id;uniqueIndex;not null"`
	MigratedAt time.Time `gorm:"column:migrated_at;not null"`
}

func (chatIDMigration) TableName() string { return "chat_id_migrations" }

// MigrateChatID moves every chat-scoped row from a Telegram basic-group ID to
// its supergroup ID. It copies the chats row, then reassigns child references;
// the old chats row is retained and marked inactive. A pre-existing target row
// in any chat_id-scoped table is treated as an ambiguity and aborts the whole
// transaction rather than overwriting or dropping either side.
func MigrateChatID(oldID, newID int64, newTitle string) error {
	if db.DB == nil {
		return errors.New("database not initialized")
	}
	if oldID >= 0 || newID >= 0 || oldID == newID {
		return fmt.Errorf("invalid Telegram chat migration %d -> %d", oldID, newID)
	}

	err := db.DB.Transaction(func(tx *gorm.DB) error {
		var prior chatIDMigration
		err := tx.Where("old_chat_id = ?", oldID).First(&prior).Error
		if err == nil {
			if prior.NewChatID != newID {
				return ErrChatMigrationConflict
			}
			if newTitle != "" {
				return tx.Model(&models.Chat{}).Where("chat_id = ?", newID).
					Updates(map[string]any{"chat_name": newTitle, "is_inactive": false, "updated_at": time.Now()}).Error
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var mapped chatIDMigration
		err = tx.Where("new_chat_id = ?", newID).First(&mapped).Error
		if err == nil {
			return ErrChatMigrationConflict
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var targetChat models.Chat
		if err := tx.Where("chat_id = ?", newID).First(&targetChat).Error; err == nil {
			return fmt.Errorf("%w: chats", ErrChatMigrationTargetExists)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		var oldChat models.Chat
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("chat_id = ?", oldID).First(&oldChat).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrChatMigrationSourceNotFound
			}
			return err
		}

		tables, err := tx.Migrator().GetTables()
		if err != nil {
			return fmt.Errorf("list database tables for chat migration: %w", err)
		}
		chatTables := make([]string, 0, len(tables))
		for _, table := range tables {
			if table == "chats" || table == "channels" || table == "chat_id_migrations" ||
				!tx.Migrator().HasColumn(table, "chat_id") {
				continue
			}
			var count int64
			if err := tx.Table(table).Where("chat_id = ?", newID).Count(&count).Error; err != nil {
				return fmt.Errorf("check target ID in %s: %w", table, err)
			}
			if count != 0 {
				return fmt.Errorf("%w: %s", ErrChatMigrationTargetExists, table)
			}
			chatTables = append(chatTables, table)
		}

		title := oldChat.ChatName
		if newTitle != "" {
			title = newTitle
		}
		now := time.Now()
		newChat := models.Chat{
			ChatId: newID, ChatName: title, Language: oldChat.Language,
			Users: append(models.Int64Array(nil), oldChat.Users...),
			IsInactive: false, LastActivity: now, CreatedAt: oldChat.CreatedAt, UpdatedAt: now,
		}
		if err := tx.Create(&newChat).Error; err != nil {
			return fmt.Errorf("create migrated chat row: %w", err)
		}

		for _, table := range chatTables {
			if err := tx.Table(table).Where("chat_id = ?", oldID).Update("chat_id", newID).Error; err != nil {
				return fmt.Errorf("move chat_id references in %s: %w", table, err)
			}
		}

		// These columns store chat IDs as destinations/references rather than
		// the owning chat key. channels.channel_id is intentionally excluded:
		// the schema history establishes it as the channel's own Telegram ID.
		for _, column := range []string{"log_chat_id", "log_channel_id", "admin_chat_id", "user_chat_id"} {
			for _, table := range tables {
				if table == "chats" || table == "channels" || table == "chat_id_migrations" ||
					!tx.Migrator().HasColumn(table, column) {
					continue
				}
				if err := tx.Table(table).Where(column+" = ?", oldID).Update(column, newID).Error; err != nil {
					return fmt.Errorf("move %s references in %s: %w", column, table, err)
				}
			}
		}

		if err := tx.Model(&models.Chat{}).Where("chat_id = ?", oldID).
			Updates(map[string]any{"is_inactive": true, "updated_at": now}).Error; err != nil {
			return fmt.Errorf("mark old chat inactive: %w", err)
		}
		return tx.Create(&chatIDMigration{OldChatID: oldID, NewChatID: newID, MigratedAt: now}).Error
	})
	if err != nil {
		return err
	}

	invalidateMigratedChatCaches(oldID)
	invalidateMigratedChatCaches(newID)
	return nil
}

func invalidateMigratedChatCaches(chatID int64) {
	for _, key := range []string{
		"chat", "chat_users", "filters", "greetings", "locks_map", "warn_settings",
		"admin_settings", "antiflood", "antiraid", "approvals", "bans", "blacklists",
		"captcha_settings", "disable", "notes", "notes_settings", "pins", "rules",
		"report_settings", "reactions", "federation", "log_channel", "ai_spam",
		"spam_db", "digest", "chat_timezone", "probation", "recurring",
		"night_mode", "spam_filter", "ephemeral",
	} {
		cache.DeleteCache(cache.CacheKey(key, chatID))
	}
}
