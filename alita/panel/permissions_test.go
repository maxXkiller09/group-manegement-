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


// A role cached by the initial chat lookup must not authorize a later write
// after Telegram has revoked the user's administrator status.
func TestSettingsPatchRechecksDemotedAdminBeforeWrite(t *testing.T) {
	fixture, chatID := newSettingsFixture(t)
	raw := readFixture(t, "initdata_main.txt")

	if recorder := panelRequest(t, fixture.handler, http.MethodGet, settingsPath(chatID), raw, "", ""); recorder.Code != http.StatusOK {
		t.Fatalf("initial settings GET status = %d", recorder.Code)
	}
	fixture.client.statuses[settingsFixtureUserID] = "member"

	recorder := panelRequest(t, fixture.handler, http.MethodPatch, settingsPath(chatID), raw,
		`{"changes":{"greetings.welcome_enabled":false}}`, "application/json")
	requireAPIError(t, recorder, http.StatusForbidden, "not_admin")
	if count := countChatRows(t, &models.GreetingSettings{}, chatID); count != 0 {
		t.Fatalf("demoted admin write created %d greeting rows", count)
	}
}

// Bot admin status is also rechecked: a cached positive result cannot authorize
// a settings write after the bot loses administrator rights.
func TestSettingsPatchRechecksDemotedBotBeforeWrite(t *testing.T) {
	fixture, chatID := newSettingsFixture(t)
	raw := readFixture(t, "initdata_main.txt")

	if recorder := panelRequest(t, fixture.handler, http.MethodGet, settingsPath(chatID), raw, "", ""); recorder.Code != http.StatusOK {
		t.Fatalf("initial settings GET status = %d", recorder.Code)
	}
	fixture.client.statuses[999] = "member"

	recorder := panelRequest(t, fixture.handler, http.MethodPatch, settingsPath(chatID), raw,
		`{"changes":{"greetings.welcome_enabled":false}}`, "application/json")
	requireAPIError(t, recorder, http.StatusConflict, "bot_not_admin")
	if count := countChatRows(t, &models.GreetingSettings{}, chatID); count != 0 {
		t.Fatalf("write with demoted bot created %d greeting rows", count)
	}
}
