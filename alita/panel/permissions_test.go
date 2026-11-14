//go:build testtools

package panel

import (
	"context"
	"net/http"
	"testing"

	"github.com/divkix/Alita_Robot/alita/db/greetings"
	"github.com/divkix/Alita_Robot/alita/db/lang"
	"github.com/divkix/Alita_Robot/alita/db/models"
)

// A batch checks every requested right before writing any setting.
// language change is not written when a greeting change beside it is refused.
func TestSettingsPatchPermissionRefusalWritesNothing(t *testing.T) {
	fixture, chatID := newSettingsFixture(t)
	raw := readFixture(t, "initdata_main.txt")
	delete(fixture.client.rights, settingsFixtureUserID)

	recorder := panelRequest(t, fixture.handler, http.MethodPatch, settingsPath(chatID), raw,
		`{"changes":{"language.code":"es","greetings.clean_welcome":true}}`, "application/json")
	requireAPIError(t, recorder, http.StatusForbidden, "missing_permission")
	if got := lang.GetGroupLanguage(context.Background(), chatID); got != "en" {
		t.Fatalf("language after refused batch = %q, want en", got)
	}
	if count := countChatRows(t, &models.GreetingSettings{}, chatID); count != 0 {
		t.Fatalf("refused batch created %d greeting rows", count)
	}
}


func TestWriteRechecksAdminAfterAccessMemo(t *testing.T) {
	fixture, chatID := newSettingsFixture(t)
	raw := readFixture(t, "initdata_main.txt")
	target := "/panel/api/v1/chats/" + strconv.FormatInt(chatID, 10)

	// Prime the read memo while the caller and bot are administrators.
	if response := panelRequest(t, fixture.handler, http.MethodGet, target, raw, "", ""); response.Code != http.StatusOK {
		t.Fatalf("prime access status = %d, want 200", response.Code)
	}
	fixture.client.statuses[settingsFixtureUserID] = "member"

	write := panelRequest(t, fixture.handler, http.MethodPatch, settingsPath(chatID), raw,
		`{"changes":{"language.code":"es"}}`, "application/json")
	requireAPIError(t, write, http.StatusForbidden, "not_admin")
	if got := lang.GetGroupLanguage(context.Background(), chatID); got != "en" {
		t.Fatalf("demoted admin changed language to %q, want no write", got)
	}
}

func TestWriteRechecksBotAdminAfterAccessMemo(t *testing.T) {
	fixture, chatID := newSettingsFixture(t)
	raw := readFixture(t, "initdata_main.txt")
	target := "/panel/api/v1/chats/" + strconv.FormatInt(chatID, 10)

	if response := panelRequest(t, fixture.handler, http.MethodGet, target, raw, "", ""); response.Code != http.StatusOK {
		t.Fatalf("prime access status = %d, want 200", response.Code)
	}
	fixture.client.statuses[999] = "member"

	write := panelRequest(t, fixture.handler, http.MethodPatch, settingsPath(chatID), raw,
		`{"changes":{"language.code":"es"}}`, "application/json")
	requireAPIError(t, write, http.StatusConflict, "bot_not_admin")
	if got := lang.GetGroupLanguage(context.Background(), chatID); got != "en" {
		t.Fatalf("write without current bot admin changed language to %q, want no write", got)
	}
}

// The chat creator holds every right even when getChatMember reports none.
func TestSettingsPatchCreatorSkipsRights(t *testing.T) {
	fixture, chatID := newSettingsFixture(t)
	raw := readFixture(t, "initdata_main.txt")
	delete(fixture.client.rights, settingsFixtureUserID)
	fixture.client.statuses[settingsFixtureUserID] = "creator"

	recorder := panelRequest(t, fixture.handler, http.MethodPatch, settingsPath(chatID), raw,
		`{"changes":{"greetings.welcome_enabled":false}}`, "application/json")
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body %s)", recorder.Code, recorder.Body.String())
	}
	if greetings.GetGreetingSettings(chatID).WelcomeSettings.ShouldWelcome {
		t.Fatal("creator greeting write did not apply")
	}
}
