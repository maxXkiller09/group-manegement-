//go:build testtools

package modules

import (
	"fmt"
	"net/url"
	"strings"
	"testing"

	"github.com/PaulSonOfLars/gotgbot/v2"
	"github.com/PaulSonOfLars/gotgbot/v2/ext"

	"github.com/divkix/Alita_Robot/alita/i18n"
	"github.com/divkix/Alita_Robot/alita/utils/helpers"
)

// The private /about screen keeps the add-to-group action but no longer offers sharing.
func TestAboutOffersAddToGroupWithoutShare(t *testing.T) {
	useRealLocales(t)
	tr := i18n.MustNewTranslator("en")
	shareButtonText, err := tr.GetString("help_button_share")
	if err != nil || shareButtonText == "" {
		t.Fatalf("help_button_share = %q, %v; want a localized label", shareButtonText, err)
	}
	shareText, err := tr.GetString("help_share_text")
	if err != nil || shareText == "" {
		t.Fatalf("help_share_text = %q, %v; want a localized pitch", shareText, err)
	}

	client := newModuleBotClient()
	bot := newModuleTestBot(client)
	user := gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Admin"}
	chat := gotgbot.Chat{Id: user.Id, Type: "private", FirstName: "Admin"}

	if err := DefaultHelpRegistry().about(bot, newModuleMessageContext(bot, chat, user, "/about")); err != ext.EndGroups {
		t.Fatalf("about error = %v, want EndGroups", err)
	}

	markup := markupOf(t, client.onlyCall(t, "sendMessage"))
	if len(markup.InlineKeyboard) == 0 || len(markup.InlineKeyboard[0]) != 1 {
		t.Fatalf("first keyboard row = %+v, want only the add-to-group button", markup.InlineKeyboard)
	}

	add := markup.InlineKeyboard[0][0]
	if want := helpers.AddToGroupURL("AlitaTestBot"); add.Url != want {
		t.Errorf("add-to-group url = %q, want %q", add.Url, want)
	}
	assertAddToChatRequestsAdminRights(t, add.Url)

	for _, row := range markup.InlineKeyboard {
		for _, button := range row {
			if strings.Contains(strings.ToLower(button.Text), "share") || strings.Contains(button.Url, "t.me/share") {
				t.Errorf("About keyboard still contains a share action: %+v", button)
			}
		}
	}
}

// The dashboard hint follows PANEL_ENABLED; the add-to-group action stays on both variants.
func TestAboutMentionsDashboardOnlyWhenPanelEnabled(t *testing.T) {
	useRealLocales(t)
	hint, err := i18n.MustNewTranslator("en").GetString("help_about_panel_hint")
	if err != nil || hint == "" {
		t.Fatalf("help_about_panel_hint = %q, %v; want a localized hint", hint, err)
	}

	for _, enabled := range []bool{false, true} {
		t.Run(fmt.Sprintf("panel enabled=%v", enabled), func(t *testing.T) {
			withPanelConfig(t, enabled, "https://panel.example.com", "")

			client := newModuleBotClient()
			bot := newModuleTestBot(client)
			user := gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Admin"}
			chat := gotgbot.Chat{Id: user.Id, Type: "private", FirstName: "Admin"}

			if err := DefaultHelpRegistry().about(bot, newModuleMessageContext(bot, chat, user, "/about")); err != ext.EndGroups {
				t.Fatalf("about error = %v, want EndGroups", err)
			}

			call := client.onlyCall(t, "sendMessage")
			text := fmt.Sprint(call.Params["text"])
			if got := strings.Contains(text, hint); got != enabled {
				t.Errorf("about text mentions the dashboard = %v, want %v; text = %q", got, enabled, text)
			}
			markup := markupOf(t, call)
			if len(markup.InlineKeyboard) == 0 || len(markup.InlineKeyboard[0]) != 1 {
				t.Fatalf("first keyboard row = %+v, want only the add-to-group button", markup.InlineKeyboard)
			}
		})
	}
}

// A group /help reply sends the reader to the bot's PM. It must never carry a
// raw add-to-group link: that would add the bot without its admin rights.
func TestGroupHelpLinksThePrivateHelpDeepLink(t *testing.T) {
	withPanelConfig(t, false, "", "")

	client := newModuleBotClient()
	bot := newModuleTestBot(client)
	user := gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Helper"}
	group := gotgbot.Chat{Id: uniqueModuleChatID(), Type: "supergroup", Title: "Help Chat"}

	if err := DefaultHelpRegistry().help(bot, newModuleMessageContext(bot, group, user, "/help")); err != ext.EndGroups {
		t.Fatalf("help error = %v, want EndGroups", err)
	}

	markup := markupOf(t, client.onlyCall(t, "sendMessage"))
	if len(markup.InlineKeyboard) == 0 || len(markup.InlineKeyboard[0]) != 1 {
		t.Fatalf("first keyboard row = %+v, want the private help button alone", markup.InlineKeyboard)
	}
	button := markup.InlineKeyboard[0][0]
	if want := "https://t.me/AlitaTestBot?start=help_help"; button.Url != want {
		t.Fatalf("group /help button url = %q, want the PM deep link %q", button.Url, want)
	}
	for _, row := range markup.InlineKeyboard {
		for _, button := range row {
			if strings.Contains(button.Url, "startgroup") {
				t.Errorf("group /help offers %q; adding the bot must go through the rights link, not a group reply", button.Url)
			}
		}
	}
}
