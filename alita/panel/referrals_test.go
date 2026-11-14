//go:build testtools

package panel

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/divkix/Alita_Robot/alita/db"
	"github.com/divkix/Alita_Robot/alita/db/models"
)

func TestReferralDashboardIsAdminOnly(t *testing.T) {
	fixture := newPanelFixture(t)
	chatID := uniquePanelChatID()

	recorder := panelRequest(t, fixture.handler, http.MethodGet, analyticsPath(chatID, "referrals", ""), readFixture(t, "initdata_main.txt"), "", "")
	requireAPIError(t, recorder, http.StatusForbidden, "not_admin")
}

func TestReferralDashboardReturnsTrackedLinksAndLeaderboard(t *testing.T) {
	fixture := newPanelFixture(t)
	chatID := uniquePanelChatID()
	fixture.client.admins[chatID] = adminListJSON(279058397)

	links := []models.ChatInviteLink{
		{InviteLink: "https://t.me/+tracked-one", ChatID: chatID, Name: "one", CreatorID: 279058397},
		{InviteLink: "https://t.me/+tracked-two", ChatID: chatID, Name: "two", CreatorID: 12345},
	}
	if err := db.DB.Create(&links).Error; err != nil {
		t.Fatalf("seed invite links: %v", err)
	}
	attributions := []models.ChatInviteAttribution{
		{ChatID: chatID, UserID: 1001, InviteLink: links[0].InviteLink, InviterID: 279058397},
		{ChatID: chatID, UserID: 1002, InviteLink: links[0].InviteLink, InviterID: 279058397},
		{ChatID: chatID, UserID: 1003, InviteLink: links[1].InviteLink, InviterID: 12345},
	}
	if err := db.DB.Create(&attributions).Error; err != nil {
		t.Fatalf("seed invite attributions: %v", err)
	}
	t.Cleanup(func() {
		_ = db.DB.Where("chat_id = ?", chatID).Delete(&models.ChatInviteAttribution{}).Error
		_ = db.DB.Where("chat_id = ?", chatID).Delete(&models.ChatInviteLink{}).Error
	})

	recorder := panelRequest(t, fixture.handler, http.MethodGet, analyticsPath(chatID, "referrals", ""), readFixture(t, "initdata_main.txt"), "", "")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", recorder.Code, recorder.Body.String())
	}
	var body referralDashboardResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode referral dashboard: %v", err)
	}
	if len(body.Links) != 2 || len(body.Leaderboard) != 2 || body.Total != 3 {
		t.Fatalf("response = %+v, want 2 links, 2 inviters and 3 attributed members", body)
	}
	if body.Links[0].Joined != 2 || body.Links[0].InviteLink != links[0].InviteLink {
		t.Fatalf("top link = %+v, want tracked-one with 2 joins", body.Links[0])
	}
	if body.Leaderboard[0].InviterID != 279058397 || body.Leaderboard[0].Joined != 2 {
		t.Fatalf("top inviter = %+v, want user 279058397 with 2 joins", body.Leaderboard[0])
	}
}
