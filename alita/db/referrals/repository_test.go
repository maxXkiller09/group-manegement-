//go:build testtools

package referrals

import (
	"testing"
	"time"

	"github.com/divkix/Alita_Robot/alita/db/models"
)

func TestRecordJoinCountsUniqueMembersOnly(t *testing.T) {
	chatID := time.Now().UnixNano()
	link := "https://t.me/+test-" + time.Now().Format("150405.000000000")
	if err := SaveInviteLink(models.ChatInviteLink{InviteLink: link, ChatID: chatID, CreatorID: 11}); err != nil {
		t.Fatal(err)
	}
	joinedAt := time.Date(2026, 11, 13, 12, 0, 0, 0, time.UTC)
	created, err := RecordJoin(chatID, 22, link, 11, joinedAt)
	if err != nil || !created {
		t.Fatalf("first RecordJoin() = %v, %v; want true, nil", created, err)
	}
	created, err = RecordJoin(chatID, 22, link, 11, joinedAt.Add(time.Hour))
	if err != nil || created {
		t.Fatalf("duplicate RecordJoin() = %v, %v; want false, nil", created, err)
	}
	rows, err := ListLinkStats(chatID)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].Joined != 1 {
		t.Fatalf("stats = %+v, want one link with one unique join", rows)
	}
}

func TestRecordJoinIgnoresUnmanagedLinks(t *testing.T) {
	created, err := RecordJoin(123, 456, "", 0, time.Now())
	if err != nil || created {
		t.Fatalf("RecordJoin(empty link) = %v, %v; want false, nil", created, err)
	}
}
