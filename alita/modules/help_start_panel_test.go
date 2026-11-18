//go:build testtools

package modules

import (
	"fmt"
	"strings"
	"testing"

	"github.com/PaulSonOfLars/gotgbot/v2"
	"github.com/PaulSonOfLars/gotgbot/v2/ext"
)

func TestPrivateStartPanelButtonOpensGroupPicker(t *testing.T) {
	useRealLocales(t)
	withPanelConfig(t, true, "https://panel.example.com", "nexguard_panel")
	resetCachedBotUsername()
	t.Cleanup(resetCachedBotUsername)

	client := newModuleBotClient()
	bot := newModuleTestBot(client)
	user := gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Admin"}
	if err := DefaultHelpRegistry().start(bot, newModuleMessageContext(bot, privateChatOf(user), user, "/start")); err != ext.EndGroups {
		t.Fatalf("start(private) error = %v, want EndGroups", err)
	}

	markup := markupOf(t, client.onlyCall(t, "sendMessage"))
	if len(markup.InlineKeyboard) != 3 || len(markup.InlineKeyboard[1]) != 1 {
		t.Fatalf("private start keyboard = %+v, want three rows with a full-width panel row", markup.InlineKeyboard)
	}
	button := markup.InlineKeyboard[1][0]
	if button.WebApp == nil {
		t.Fatalf("panel button = %+v, want a WebApp button", button)
	}
	if button.WebApp.Url != "https://panel.example.com" {
		t.Fatalf("panel WebApp URL = %q, want the panel root URL for the group picker", button.WebApp.Url)
	}
	if strings.Contains(button.WebApp.Url, "chat=") || strings.Contains(button.WebApp.Url, "startapp=chat_") {
		t.Fatalf("private panel button pins a group instead of opening the picker: %q", button.WebApp.Url)
	}
}

func TestPrivateStartHidesPanelButtonWhenDisabled(t *testing.T) {
	useRealLocales(t)
	withPanelConfig(t, false, "", "")
	client := newModuleBotClient()
	bot := newModuleTestBot(client)
	user := gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Admin"}

	if err := DefaultHelpRegistry().start(bot, newModuleMessageContext(bot, privateChatOf(user), user, "/start")); err != ext.EndGroups {
		t.Fatalf("start(private) error = %v, want EndGroups", err)
	}
	markup := markupOf(t, client.onlyCall(t, "sendMessage"))
	if len(markup.InlineKeyboard) != 2 {
		t.Fatalf("private start rows = %d, want 2 without panel", len(markup.InlineKeyboard))
	}
}

func TestGroupStartHasPanelAndHelpInPMButtons(t *testing.T) {
	useRealLocales(t)
	withPanelConfig(t, true, "https://panel.example.com", "nexguard_panel")
	resetCachedBotUsername()
	t.Cleanup(resetCachedBotUsername)

	client := newModuleBotClient()
	bot := newModuleTestBot(client)
	user := gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Admin"}
	group := gotgbot.Chat{Id: uniqueModuleChatID(), Type: "supergroup", Title: "NexGuard test"}
	if err := DefaultHelpRegistry().start(bot, newModuleMessageContext(bot, group, user, "/start")); err != ext.EndGroups {
		t.Fatalf("start(group) error = %v, want EndGroups", err)
	}
	call := client.onlyCall(t, "sendMessage")
	markup := markupOf(t, call)
	if len(markup.InlineKeyboard) != 2 {
		t.Fatalf("group start rows = %d, want panel and PM help rows", len(markup.InlineKeyboard))
	}
	if got, want := markup.InlineKeyboard[0][0].Url, fmt.Sprintf("https://t.me/AlitaTestBot/nexguard_panel?startapp=chat_%d", group.Id); got != want {
		t.Errorf("group panel URL = %q, want %q", got, want)
	}
	if got, want := markup.InlineKeyboard[1][0].Url, "https://t.me/AlitaTestBot?start=help_help"; got != want {
		t.Errorf("group Help in PM URL = %q, want %q", got, want)
	}
	if got := fmt.Sprint(call.Params["parse_mode"]); got != "HTML" {
		t.Errorf("group /start parse mode = %q, want HTML", got)
	}
}

func TestGroupStartHidesPanelButtonWhenDisabled(t *testing.T) {
	useRealLocales(t)
	withPanelConfig(t, false, "", "")
	resetCachedBotUsername()
	t.Cleanup(resetCachedBotUsername)

	client := newModuleBotClient()
	bot := newModuleTestBot(client)
	user := gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Admin"}
	group := gotgbot.Chat{Id: uniqueModuleChatID(), Type: "supergroup", Title: "NexGuard test"}
	if err := DefaultHelpRegistry().start(bot, newModuleMessageContext(bot, group, user, "/start")); err != ext.EndGroups {
		t.Fatalf("start(group) error = %v, want EndGroups", err)
	}
	markup := markupOf(t, client.onlyCall(t, "sendMessage"))
	if len(markup.InlineKeyboard) != 1 || len(markup.InlineKeyboard[0]) != 1 {
		t.Fatalf("group start keyboard = %+v, want only Help in PM", markup.InlineKeyboard)
	}
	if got, want := markup.InlineKeyboard[0][0].Url, "https://t.me/AlitaTestBot?start=help_help"; got != want {
		t.Errorf("group Help in PM URL = %q, want %q", got, want)
	}
}
