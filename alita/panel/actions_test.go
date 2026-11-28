//go:build testtools

package panel

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/PaulSonOfLars/gotgbot/v2"

	"github.com/divkix/Alita_Robot/alita/config"
)

const panelDirectActionActorID int64 = 279058397

func directActionFixture(t *testing.T) (panelFixture, int64, string) {
	t.Helper()
	fixture := newPanelFixture(t)
	chatID := uniquePanelChatID()
	seedPanelChat(t, chatID, "Direct Action Group", fixtureNow)
	fixture.client.admins[chatID] = adminListJSON(panelDirectActionActorID)
	fixture.client.rights[panelDirectActionActorID] = panelFakeRights{canRestrictMembers: true}
	fixture.client.botRights = panelFakeRights{canRestrictMembers: true}
	return fixture, chatID, readFixture(t, "initdata_main.txt")
}

func directActionRequest(t *testing.T, fixture panelFixture, chatID int64, initData, target string) *httptest.ResponseRecorder {
	t.Helper()
	body := fmt.Sprintf(`{"action":"mute","target":%q,"reason":"panel test","confirmed":true}`, target)
	path := "/panel/api/v1/chats/" + strconv.FormatInt(chatID, 10) + "/actions"
	return panelRequest(t, fixture.handler, http.MethodPost, path, initData, body, "application/json")
}

func TestDirectActionResolvesUsernameFromUserDBBeforeTelegram(t *testing.T) {
	fixture, chatID, initData := directActionFixture(t)
	seedPanelUser(t, 321, "dbmember", "Database Member")
	// If the resolver incorrectly calls Telegram first, this non-user chat
	// would be rejected. A DB hit must win without a username getChat request.
	fixture.client.usernameChats["@dbmember"] = gotgbot.Chat{Id: -1009876543210, Type: "group"}

	recorder := directActionRequest(t, fixture, chatID, initData, "@dbmember")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", recorder.Code, recorder.Body.String())
	}
	var response directActionResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode direct action response: %v", err)
	}
	if !response.Applied || response.TargetID != 321 {
		t.Fatalf("response = %+v, want successful action for DB user 321", response)
	}
	if got := fixture.client.countUsernameLookups(); got != 0 {
		t.Fatalf("Telegram username lookups = %d, want 0 after DB hit", got)
	}
}

func TestDirectActionResolvesNumericTargetWithoutUsernameLookup(t *testing.T) {
	fixture, chatID, initData := directActionFixture(t)
	recorder := directActionRequest(t, fixture, chatID, initData, "654")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", recorder.Code, recorder.Body.String())
	}
	var response directActionResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode direct action response: %v", err)
	}
	if !response.Applied || response.TargetID != 654 {
		t.Fatalf("response = %+v, want successful action for numeric user 654", response)
	}
	if got := fixture.client.countUsernameLookups(); got != 0 {
		t.Fatalf("Telegram username lookups = %d, want 0 for numeric target", got)
	}
}

func TestDirectActionAcceptsOnlyPrivateTelegramUsernameFallback(t *testing.T) {
	tests := []struct {
		name     string
		chat     gotgbot.Chat
		wantCode string
		wantHTTP int
	}{
		{name: "private user", chat: gotgbot.Chat{Id: 765, Type: "private", Username: "fallbackuser"}, wantHTTP: http.StatusOK},
		{name: "basic group", chat: gotgbot.Chat{Id: -765, Type: "group"}, wantHTTP: http.StatusBadRequest, wantCode: "invalid_target"},
		{name: "supergroup", chat: gotgbot.Chat{Id: -100765, Type: "supergroup"}, wantHTTP: http.StatusBadRequest, wantCode: "invalid_target"},
		{name: "channel", chat: gotgbot.Chat{Id: -1007654321000, Type: "channel"}, wantHTTP: http.StatusBadRequest, wantCode: "invalid_target"},
		{name: "bot user", chat: gotgbot.Chat{Id: 999, Type: "private", Username: "botuser"}, wantHTTP: http.StatusBadRequest, wantCode: "invalid_target"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fixture, chatID, initData := directActionFixture(t)
			fixture.client.usernameChats["@fallbackuser"] = tt.chat
			recorder := directActionRequest(t, fixture, chatID, initData, "@fallbackuser")
			if recorder.Code != tt.wantHTTP {
				t.Fatalf("status = %d, want %d (body %s)", recorder.Code, tt.wantHTTP, recorder.Body.String())
			}
			if tt.wantCode != "" {
				var body errorResponse
				if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
					t.Fatalf("decode error response: %v", err)
				}
				if body.Error.Code != tt.wantCode {
					t.Fatalf("error code = %q, want %q", body.Error.Code, tt.wantCode)
				}
				if calls := fixture.client.countCalls("restrictChatMember"); calls != 0 {
					t.Fatalf("restricted a rejected non-user target: %d calls", calls)
				}
			}
			if got := fixture.client.countUsernameLookups(); got != 1 {
				t.Fatalf("Telegram username lookups = %d, want 1", got)
			}
		})
	}
}

func TestDirectActionRejectsCallerBotOwnerAndGroupAdmins(t *testing.T) {
	tests := []struct {
		name       string
		targetID   int64
		ownerID    int64
		admin      bool
		wantStatus int
		wantCode   string
	}{
		{name: "caller", targetID: panelDirectActionActorID, wantStatus: http.StatusBadRequest, wantCode: "invalid_target"},
		{name: "bot self", targetID: 999, wantStatus: http.StatusBadRequest, wantCode: "invalid_target"},
		{name: "global owner", targetID: 7777, ownerID: 7777, wantStatus: http.StatusForbidden, wantCode: "protected_owner"},
		{name: "group admin", targetID: 8888, admin: true, wantStatus: http.StatusForbidden, wantCode: "protected_admin"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fixture, chatID, initData := directActionFixture(t)
			if tt.ownerID != 0 {
				previous := config.AppConfig
				config.AppConfig = &config.Config{OwnerId: tt.ownerID}
				t.Cleanup(func() { config.AppConfig = previous })
			}
			if tt.admin {
				fixture.client.admins[chatID] = adminListJSON(panelDirectActionActorID, tt.targetID)
			}
			recorder := directActionRequest(t, fixture, chatID, initData, strconv.FormatInt(tt.targetID, 10))
			requireAPIError(t, recorder, tt.wantStatus, tt.wantCode)
			if calls := fixture.client.countCalls("restrictChatMember"); calls != 0 {
				t.Fatalf("protected target received a Telegram action: %d calls", calls)
			}
		})
	}
}

func TestDirectActionRechecksCallerAndBotRightsLive(t *testing.T) {
	tests := []struct {
		name      string
		caller    panelFakeRights
		bot       panelFakeRights
	}{
		{name: "caller lost restrict right", caller: panelFakeRights{canRestrictMembers: false}, bot: panelFakeRights{canRestrictMembers: true}},
		{name: "bot lost restrict right", caller: panelFakeRights{canRestrictMembers: true}, bot: panelFakeRights{canRestrictMembers: false}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fixture, chatID, initData := directActionFixture(t)
			fixture.client.rights[panelDirectActionActorID] = tt.caller
			fixture.client.botRights = tt.bot
			recorder := directActionRequest(t, fixture, chatID, initData, "654")
			if recorder.Code != http.StatusForbidden {
				t.Fatalf("status = %d, want 403 (body %s)", recorder.Code, recorder.Body.String())
			}
			if calls := fixture.client.countCalls("restrictChatMember"); calls != 0 {
				t.Fatalf("action ran after live rights check failed: %d calls", calls)
			}
		})
	}
}

func TestDirectActionLegacyNumericFieldRemainsSupported(t *testing.T) {
	fixture, chatID, initData := directActionFixture(t)
	body := `{"action":"mute","target_user_id":654,"reason":"legacy client","confirmed":true}`
	path := "/panel/api/v1/chats/" + strconv.FormatInt(chatID, 10) + "/actions"
	recorder := panelRequest(t, fixture.handler, http.MethodPost, path, initData, body, "application/json")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", recorder.Code, recorder.Body.String())
	}
	if got := fixture.client.countUsernameLookups(); got != 0 {
		t.Fatalf("Telegram username lookups = %d, want 0 for legacy numeric ID", got)
	}
}

