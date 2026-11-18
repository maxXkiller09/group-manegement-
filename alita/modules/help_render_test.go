//go:build testtools

package modules

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/PaulSonOfLars/gotgbot/v2"

	"github.com/divkix/Alita_Robot/alita/i18n"
)

type helpFakeBotClient struct {
	response json.RawMessage
	err      error
}

func (f helpFakeBotClient) RequestWithContext(context.Context, string, string, map[string]any, *gotgbot.RequestOpts) (json.RawMessage, error) {
	if f.err != nil {
		return nil, f.err
	}
	return f.response, nil
}

func (f helpFakeBotClient) GetAPIURL(*gotgbot.RequestOpts) string {
	return "https://api.telegram.org"
}

func (f helpFakeBotClient) FileURL(token string, path string, _ *gotgbot.RequestOpts) string {
	return "https://api.telegram.org/file/bot" + token + "/" + path
}

func helpTestTranslator(t *testing.T) *i18n.Translator {
	t.Helper()

	tr, err := i18n.NewTestTranslator(`
help_info_about_header: "About NexGuard"
help_bot_intro: "Intro. "
help_news_channel_text: ""
help_pm_intro: "Hi %s. "
help_all_commands_usage: "Use commands."
help_button_about_me: "About me"
help_button_news_channel: "News"
help_button_support_group: "Support"
help_button_configuration: "Config"
common_back_arrow_alt: "Back"
help_button_about: "About"
help_button_add_to_chat: "Add"
help_button_share: "Share"
help_share_text: "Share the bot."
help_button_commands_help: "Commands"
help_button_language: "Language"
`)
	if err != nil {
		t.Fatalf("NewTestTranslator() error = %v", err)
	}
	return tr
}

func TestHelpTextRendering(t *testing.T) {
	t.Parallel()

	tr := helpTestTranslator(t)
	if got := getAboutText(tr); got != "About NexGuard" {
		t.Fatalf("getAboutText() = %q", got)
	}
	if got := getStartHelp(tr); got != "Intro. " {
		t.Fatalf("getStartHelp() = %q", got)
	}
	if got := getMainHelp(tr, "Div"); got != "Hi Div. Use commands." {
		t.Fatalf("getMainHelp() = %q", got)
	}
}

func TestHelpKeyboardsUseCallbackCodecAndBotUsername(t *testing.T) {
	withPanelConfig(t, false, "", "")
	tr := helpTestTranslator(t)

	aboutKb := getAboutKb(tr, "NexGuardd_Bot")
	if len(aboutKb.InlineKeyboard) != 4 {
		t.Fatalf("getAboutKb() rows = %d, want 4", len(aboutKb.InlineKeyboard))
	}
	if len(aboutKb.InlineKeyboard[0]) != 1 || aboutKb.InlineKeyboard[0][0].Text != "Add" {
		t.Fatalf("about add row = %+v", aboutKb.InlineKeyboard[0])
	}
	if aboutKb.InlineKeyboard[1][0].Text != "About me" ||
		!strings.HasPrefix(aboutKb.InlineKeyboard[1][0].CallbackData, "about|v1|") {
		t.Fatalf("about details row = %+v", aboutKb.InlineKeyboard[1])
	}
	for _, row := range aboutKb.InlineKeyboard {
		for _, button := range row {
			if strings.Contains(strings.ToLower(button.Text), "share") || strings.Contains(button.Url, "t.me/share") {
				t.Fatalf("share button remains in About keyboard: %+v", button)
			}
		}
	}

	startKb := getStartMarkup(tr, "NexGuardd_Bot")
	if len(startKb.InlineKeyboard) != 2 {
		t.Fatalf("getStartMarkup() rows = %d, want add + commands/language rows", len(startKb.InlineKeyboard))
	}
	if got := startKb.InlineKeyboard[0][0].Url; !strings.HasPrefix(got, "https://t.me/NexGuardd_Bot?startgroup=botstart&") {
		t.Fatalf("add-to-chat URL = %q", got)
	}
	if len(startKb.InlineKeyboard[1]) != 2 ||
		!strings.HasPrefix(startKb.InlineKeyboard[1][0].CallbackData, "helpq|v1|") ||
		!strings.HasPrefix(startKb.InlineKeyboard[1][1].CallbackData, "helpq|v1|") {
		t.Fatalf("commands/language row = %+v", startKb.InlineKeyboard[1])
	}
	for _, row := range startKb.InlineKeyboard {
		for _, button := range row {
			if strings.HasPrefix(button.CallbackData, "about|") {
				t.Fatalf("About must live inside Help, not the start keyboard: %+v", button)
			}
		}
	}
}

func TestHelpMenuIncludesAboutEntry(t *testing.T) {
	useRealLocales(t)
	kb := initHelpButtonsFrom(newHelpRegistry(), "en")
	found := false
	for _, row := range kb.InlineKeyboard {
		for _, button := range row {
			if strings.HasPrefix(button.CallbackData, "about|v1|") {
				found = true
			}
		}
	}
	if !found {
		t.Fatal("Help keyboard is missing its About entry")
	}
}
func resetCachedBotUsername() {
	cachedBotUsernameMu.Lock()
	cachedBotUsername = ""
	cachedBotUsernameMu.Unlock()
}

func TestGetBotUsernameCachesStructAndGetMeFallbacks(t *testing.T) {
	resetCachedBotUsername()
	t.Cleanup(resetCachedBotUsername)

	if got := getBotUsername(&gotgbot.Bot{User: gotgbot.User{Username: "StructBot"}}); got != "StructBot" {
		t.Fatalf("getBotUsername(struct) = %q", got)
	}
	if got := getBotUsername(nil); got != "StructBot" {
		t.Fatalf("getBotUsername(cached) = %q", got)
	}

	resetCachedBotUsername()
	bot := &gotgbot.Bot{
		Token: "123:test",
		BotClient: helpFakeBotClient{response: json.RawMessage(
			`{"id":123,"is_bot":true,"first_name":"Alita","username":"GetMeBot"}`,
		)},
	}
	if got := getBotUsername(bot); got != "GetMeBot" {
		t.Fatalf("getBotUsername(getMe) = %q", got)
	}

	resetCachedBotUsername()
	if got := getBotUsername(nil); got != "" {
		t.Fatalf("getBotUsername(nil) = %q, want empty", got)
	}
}

func TestRenderModuleHelpHTMLBodyKeepsBoldTags(t *testing.T) {
	t.Parallel()

	header := "Here is the help for the *%s* module:\n\n"
	body := `<b>🎭 Auto-Reactions</b>

Automatically react to messages with specific keywords!

<b>Admin Commands:</b>
• /addreaction <keyword> <emoji> - Add an auto-reaction
<b>Example:</b>
• /addreaction hello 👋`

	got := renderModuleHelp(header, "Reactions", body)
	if strings.Contains(got, "&lt;b&gt;") || strings.Contains(got, "*Reactions*") {
		t.Fatalf("renderModuleHelp() escaped HTML or left markdown: %q", got)
	}
	if !strings.Contains(got, "<b>Reactions</b>") {
		t.Fatalf("renderModuleHelp() missing converted header bold: %q", got)
	}
	if !strings.Contains(got, "<b>🎭 Auto-Reactions</b>") {
		t.Fatalf("renderModuleHelp() missing body heading: %q", got)
	}
	if !strings.Contains(got, "<b>Admin Commands:</b>") {
		t.Fatalf("renderModuleHelp() missing Admin Commands heading: %q", got)
	}
	if !strings.Contains(got, "<b>Example:</b>") {
		t.Fatalf("renderModuleHelp() missing Example heading: %q", got)
	}
	if !strings.Contains(got, "module:</b>\n\n<b>🎭 Auto-Reactions</b>") &&
		!strings.Contains(got, "module:\n\n<b>🎭 Auto-Reactions</b>") {
		t.Fatalf("renderModuleHelp() missing blank line between header and body: %q", got)
	}
	if !strings.Contains(got, "&lt;keyword&gt;") || !strings.Contains(got, "&lt;emoji&gt;") {
		t.Fatalf("renderModuleHelp() did not escape placeholders: %q", got)
	}
}

func TestRenderModuleHelpMarkdownBodyConvertsBold(t *testing.T) {
	t.Parallel()

	header := "Here is the help for the *%s* module:\n\n"
	body := "*Admin Commands:*\n× /promote `<reply/username>`: Promote a user."
	got := renderModuleHelp(header, "Admin", body)
	if !strings.Contains(got, "<b>Admin</b>") {
		t.Fatalf("renderModuleHelp(markdown) missing header bold: %q", got)
	}
	if !strings.Contains(got, "<b>Admin Commands:</b>") && !strings.Contains(got, "<b>Admin Commands</b>") {
		t.Fatalf("renderModuleHelp(markdown) missing converted section heading: %q", got)
	}
	if strings.Contains(got, "<reply/username>") {
		t.Fatalf("renderModuleHelp(markdown) left raw placeholder: %q", got)
	}
}
