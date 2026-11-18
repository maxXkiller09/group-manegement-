//go:build testtools

package modules

import (
	"regexp"
	"strings"
	"testing"

	"github.com/divkix/Alita_Robot/alita/i18n"
	"github.com/divkix/Alita_Robot/alita/utils/formatting"
)

var nexGuardHelpLocaleKeys = []string{
	"help_bot_intro", "help_pm_questions", "help_about", "help_donatetext",
	"help_help_msg", "help_pm_intro", "help_configuration_step-3", "help_extend_hint",
	"help_contact_pm", "help_contact_pm_module", "help_button_share", "help_share_text",
	"help_button_add_to_chat", "help_button_about", "help_button_commands_help",
	"help_button_language", "panel_open_button", "help_click_here",
}

func getHelpLocaleText(t *testing.T, code, key string) string {
	t.Helper()
	value, err := i18n.MustNewTranslator(code).GetString(key)
	if err != nil {
		t.Fatalf("%s.yml: %s: %v", code, key, err)
	}
	return value
}

func TestNexGuardHelpLocaleKeyParityAndPlaceholders(t *testing.T) {
	for _, code := range localeCodes {
		for _, key := range nexGuardHelpLocaleKeys {
			if _, err := i18n.MustNewTranslator(code).GetString(key); err != nil {
				t.Errorf("%s.yml is missing %s: %v", code, key, err)
			}
		}
		if got := strings.Count(getHelpLocaleText(t, code, "help_about"), "%s"); got != 2 {
			t.Errorf("%s.yml help_about has %d %%s placeholders, want 2", code, got)
		}
		if got := strings.Count(getHelpLocaleText(t, code, "help_pm_intro"), "%s"); got != 1 {
			t.Errorf("%s.yml help_pm_intro has %d %%s placeholders, want 1", code, got)
		}
		if got := strings.Count(getHelpLocaleText(t, code, "help_contact_pm_module"), "{module}"); got != 1 {
			t.Errorf("%s.yml help_contact_pm_module has %d {module} placeholders, want 1", code, got)
		}
	}
}

func TestNexGuardHelpHTMLUsesOnlyApprovedTelegramTags(t *testing.T) {
	allowed := regexp.MustCompile(`^(?i:b|i|u|s|code|pre|a)$`)
	htmlKeys := []string{
		"help_bot_intro", "help_pm_questions", "help_about", "help_donatetext",
		"help_pm_intro", "help_configuration_step-3", "help_extend_hint",
		"help_contact_pm", "help_contact_pm_module",
	}
	for _, code := range localeCodes {
		for _, key := range htmlKeys {
			value := getHelpLocaleText(t, code, key)
			for _, match := range angleTagRe.FindAllStringSubmatch(value, -1) {
				if !allowed.MatchString(match[2]) {
					t.Errorf("%s.yml %s contains disallowed Telegram HTML tag %q", code, key, match[0])
				}
			}
		}
		moduleHelp := formatting.ToTelegramHTML(getHelpLocaleText(t, code, "help_help_msg"))
		for _, match := range angleTagRe.FindAllStringSubmatch(moduleHelp, -1) {
			if !allowed.MatchString(match[2]) {
				t.Errorf("%s.yml help_help_msg renders disallowed Telegram HTML tag %q", code, match[0])
			}
		}
	}
}

func TestNexGuardHelpCopyHasNoRemovedLinksOrClaims(t *testing.T) {
	noLinkKeys := []string{
		"help_about", "help_help_msg", "help_pm_intro", "help_configuration_step-3",
		"help_donatetext", "help_contact_pm", "help_contact_pm_module",
	}
	for _, code := range localeCodes {
		for _, key := range noLinkKeys {
			value := strings.ToLower(getHelpLocaleText(t, code, key))
			for _, forbidden := range []string{"https://", "http://", "github.com", "t.me", "nexguard support"} {
				if strings.Contains(value, forbidden) {
					t.Errorf("%s.yml %s still contains %q", code, key, forbidden)
				}
			}
		}
		for _, key := range []string{"help_help_msg", "help_pm_intro"} {
			value := strings.ToLower(getHelpLocaleText(t, code, key))
			if strings.Contains(value, "/donate") || strings.Contains(value, "donate") {
				t.Errorf("%s.yml %s still mentions donations", code, key)
			}
		}
		about := strings.ToLower(getHelpLocaleText(t, code, "help_about"))
		if strings.Contains(about, "2020") {
			t.Errorf("%s.yml help_about still contains the old 2020 claim", code)
		}
	}
}

func TestNexGuardDefaultHinglishCopy(t *testing.T) {
	wantStart := "🛡️ <b>NexGuard</b>\n<i>Aapke group ki suraksha, bina jhanjhat.</i>\n\n✅ Spam, raid aur bots se bachao\n✅ Welcome, rules, warnings, notes, sab ek jagah\n✅ Mini App me tap karke settings badlo\n\n<b>Shuru kaise karein:</b>\n1️⃣ Mujhe apne group me add karo\n2️⃣ Mujhe admin banao\n3️⃣ Neeche <b>Open admin panel</b> dabao"
	if got := getHelpLocaleText(t, "en", "help_bot_intro"); got != wantStart {
		t.Errorf("PM /start copy = %q, want %q", got, wantStart)
	}
	wantGroup := "🛡️ <b>NexGuard active hai.</b>\nSettings ke liye admin panel kholo, commands ke liye /help."
	if got := getHelpLocaleText(t, "en", "help_pm_questions"); got != wantGroup {
		t.Errorf("group /start copy = %q, want %q", got, wantGroup)
	}
	if got, want := getHelpLocaleText(t, "en", "help_donatetext"), "Abhi koi donation option nahi hai. NexGuard free hai."; got != want {
		t.Errorf("/donate copy = %q, want %q", got, want)
	}
	for _, code := range localeCodes {
		if got := getHelpLocaleText(t, code, "help_donatetext"); got != "Abhi koi donation option nahi hai. NexGuard free hai." {
			t.Errorf("%s.yml /donate copy = %q", code, got)
		}
	}
	about := getHelpLocaleText(t, "en", "help_about")
	if !strings.Contains(about, "🛡️ <b>NexGuard</b> (@%s)") ||
		!strings.Contains(about, "<i>Aapke group ki suraksha, bina jhanjhat.</i>") ||
		!strings.Contains(about, "<b>Simple:</b>") || !strings.Contains(about, "<b>Fast:</b>") ||
		!strings.Contains(about, "<b>Safe:</b>") || !strings.HasSuffix(about, "Version: %s") {
		t.Errorf("About copy does not match the approved brand and placeholders: %q", about)
	}
	if got, want := getHelpLocaleText(t, "en", "help_extend_hint"), "\n\nSab commands ek list mein dekhne ke liye /extend bhejo."; got != want {
		t.Errorf("extend hint = %q, want %q", got, want)
	}
}
