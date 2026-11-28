package chats

import (
	"errors"
	"testing"
	"time"

	"github.com/divkix/Alita_Robot/alita/db"
	"github.com/divkix/Alita_Robot/alita/db/models"
)

func TestMigrateChatIDMovesSettingsAndWarnsIdempotently(t *testing.T) {
	withChatSQLite(t)
	if err := db.DB.AutoMigrate(&models.ChatFilters{}, &models.Warns{}, &models.WarnEntry{}, &chatIDMigration{}); err != nil {
		t.Fatalf("AutoMigrate migration fixtures: %v", err)
	}

	const (
		oldID  = int64(-10001)
		newID  = int64(-10002)
		userID = int64(42)
	)
	if err := db.DB.Create(&models.Chat{ChatId: oldID, ChatName: "Old group"}).Error; err != nil {
		t.Fatalf("create old chat: %v", err)
	}
	if err := db.DB.Create(&models.ChatFilters{ChatId: oldID, KeyWord: "hello", FilterReply: "welcome"}).Error; err != nil {
		t.Fatalf("create old filter: %v", err)
	}
	if err := db.DB.Create(&models.Warns{UserId: userID, ChatId: oldID, NumWarns: 2, Reasons: models.StringArray{"one", "two"}}).Error; err != nil {
		t.Fatalf("create old warns: %v", err)
	}
	if err := db.DB.Create(&models.WarnEntry{UserId: userID, ChatId: oldID, Reason: "one", WarnedAt: timePtr(time.Now())}).Error; err != nil {
		t.Fatalf("create old warn entry: %v", err)
	}

	if err := MigrateChatID(oldID, newID, "New supergroup"); err != nil {
		t.Fatalf("MigrateChatID() error = %v", err)
	}

	var newChat models.Chat
	if err := db.DB.Where("chat_id = ?", newID).First(&newChat).Error; err != nil {
		t.Fatalf("load new chat: %v", err)
	}
	if newChat.ChatName != "New supergroup" || newChat.IsInactive {
		t.Fatalf("new chat = %+v, want active chat named New supergroup", newChat)
	}
	var oldChat models.Chat
	if err := db.DB.Where("chat_id = ?", oldID).First(&oldChat).Error; err != nil {
		t.Fatalf("load retained old chat: %v", err)
	}
	if !oldChat.IsInactive {
		t.Fatal("old chat should be retained as inactive history")
	}

	var filters []models.ChatFilters
	if err := db.DB.Where("chat_id = ?", newID).Find(&filters).Error; err != nil {
		t.Fatalf("load migrated filters: %v", err)
	}
	if len(filters) != 1 || filters[0].KeyWord != "hello" || filters[0].FilterReply != "welcome" {
		t.Fatalf("migrated filters = %+v, want the original filter exactly once", filters)
	}
	var warns models.Warns
	if err := db.DB.Where("chat_id = ? AND user_id = ?", newID, userID).First(&warns).Error; err != nil {
		t.Fatalf("load migrated warns: %v", err)
	}
	if warns.NumWarns != 2 || len(warns.Reasons) != 2 {
		t.Fatalf("migrated warns = %+v, want count 2 and both reasons", warns)
	}
	var entries []models.WarnEntry
	if err := db.DB.Where("chat_id = ? AND user_id = ?", newID, userID).Find(&entries).Error; err != nil {
		t.Fatalf("load migrated warn entries: %v", err)
	}
	if len(entries) != 1 || entries[0].Reason != "one" {
		t.Fatalf("migrated warn entries = %+v, want one original entry", entries)
	}

	if err := MigrateChatID(oldID, newID, "New supergroup"); err != nil {
		t.Fatalf("replayed MigrateChatID() error = %v", err)
	}
	for _, model := range []any{&models.ChatFilters{}, &models.Warns{}, &models.WarnEntry{}} {
		var count int64
		if err := db.DB.Model(model).Where("chat_id = ?", newID).Count(&count).Error; err != nil {
			t.Fatalf("count migrated rows for %T: %v", model, err)
		}
		if count != 1 {
			t.Fatalf("migrated row count for %T = %d, want 1 after replay", model, count)
		}
	}
}

func TestMigrateChatIDFailsClosedOnTargetRows(t *testing.T) {
	withChatSQLite(t)
	if err := db.DB.AutoMigrate(&models.ChatFilters{}, &chatIDMigration{}); err != nil {
		t.Fatalf("AutoMigrate migration fixtures: %v", err)
	}
	const oldID, newID = int64(-20001), int64(-20002)
	if err := db.DB.Create(&models.Chat{ChatId: oldID, ChatName: "Old"}).Error; err != nil {
		t.Fatalf("create old chat: %v", err)
	}
	if err := db.DB.Create(&models.ChatFilters{ChatId: oldID, KeyWord: "old", FilterReply: "source"}).Error; err != nil {
		t.Fatalf("create source filter: %v", err)
	}
	if err := db.DB.Create(&models.ChatFilters{ChatId: newID, KeyWord: "existing", FilterReply: "target"}).Error; err != nil {
		t.Fatalf("create target filter: %v", err)
	}

	err := MigrateChatID(oldID, newID, "New")
	if !errors.Is(err, ErrChatMigrationTargetExists) {
		t.Fatalf("MigrateChatID() error = %v, want ErrChatMigrationTargetExists", err)
	}
	var source models.ChatFilters
	if err := db.DB.Where("chat_id = ? AND keyword = ?", oldID, "old").First(&source).Error; err != nil {
		t.Fatalf("source filter must remain untouched: %v", err)
	}
	var oldChat models.Chat
	if err := db.DB.Where("chat_id = ?", oldID).First(&oldChat).Error; err != nil {
		t.Fatalf("source chat must remain untouched: %v", err)
	}
	var target models.ChatFilters
	if err := db.DB.Where("chat_id = ? AND keyword = ?", newID, "existing").First(&target).Error; err != nil {
		t.Fatalf("target filter must remain untouched: %v", err)
	}
}

func timePtr(value time.Time) *time.Time { return &value }
