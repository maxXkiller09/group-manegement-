package modules

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/PaulSonOfLars/gotgbot/v2"
	"github.com/PaulSonOfLars/gotgbot/v2/ext"
)

const nonMemberBanHint = "Ye user abhi group me nahi hai, /ban use karo."

func assertNonMemberBanHint(t *testing.T, client *moduleBotClient) {
	t.Helper()
	calls := client.callsFor("sendMessage")
	if len(calls) != 1 {
		t.Fatalf("sendMessage calls = %d, want exactly one non-member response", len(calls))
	}
	if got := fmt.Sprint(calls[0].Params["text"]); !strings.Contains(got, nonMemberBanHint) {
		t.Fatalf("non-member response = %q, want %q", got, nonMemberBanHint)
	}
}

func TestMuteVariantsExplainTelegramNonMemberRefusal(t *testing.T) {
	tests := []struct {
		name string
		text string
		run  func(*gotgbot.Bot, *ext.Context) error
		ctx  func(*gotgbot.Bot, gotgbot.Chat, gotgbot.User) *ext.Context
	}{
		{
			name: "mute", text: "/mute 13", run: mutesModule.mute,
			ctx: func(bot *gotgbot.Bot, chat gotgbot.Chat, admin gotgbot.User) *ext.Context {
				return newModuleMessageContext(bot, chat, admin, "/mute 13")
			},
		},
		{
			name: "temporary mute", text: "/tmute 13 1h", run: mutesModule.tMute,
			ctx: func(bot *gotgbot.Bot, chat gotgbot.Chat, admin gotgbot.User) *ext.Context {
				return newModuleMessageContext(bot, chat, admin, "/tmute 13 1h")
			},
		},
		{
			name: "silent mute", text: "/smute 13", run: mutesModule.sMute,
			ctx: func(bot *gotgbot.Bot, chat gotgbot.Chat, admin gotgbot.User) *ext.Context {
				return newModuleMessageContext(bot, chat, admin, "/smute 13")
			},
		},
		{
			name: "delete mute", text: "/dmute 13", run: mutesModule.dMute,
			ctx: func(bot *gotgbot.Bot, chat gotgbot.Chat, admin gotgbot.User) *ext.Context {
				return newMuteReplyContext(bot, chat, admin, gotgbot.User{Id: 13, FirstName: "Left User"}, "/dmute 13")
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := newAdminChatFixture(t)
			f.client.errorsByUser = map[string]error{"restrictChatMember|13": errors.New("Bad Request: user is not a member of the chat")}
			ctx := tt.ctx(f.bot, f.chat, f.admin)
			if err := tt.run(f.bot, ctx); err != ext.EndGroups {
				t.Fatalf("%s returned %v, want EndGroups after the refusal reply", tt.text, err)
			}
			assertNonMemberBanHint(t, f.client)
			if calls := f.client.callsFor("restrictChatMember"); len(calls) != 1 {
				t.Fatalf("restrictChatMember calls = %d, want one attempted action rejected by Telegram", len(calls))
			}
			for _, call := range f.client.callsFor("getChatMember") {
				if fmt.Sprint(call.Params["user_id"]) == "13" {
					t.Fatalf("%s made an unnecessary target membership preflight: %+v", tt.text, call)
				}
			}
			if calls := f.client.callsFor("deleteMessage"); len(calls) != 0 {
				t.Fatalf("%s deleted a message after Telegram refused the mute: %+v", tt.text, calls)
			}
		})
	}
}

func TestRestrictPromptExplainsAbsentTarget(t *testing.T) {
	f := newAdminChatFixture(t)
	ctx := newModuleMessageContext(f.bot, f.chat, f.admin, "/restrict 13")
	if err := bansModule.restrict(f.bot, ctx); err != ext.EndGroups {
		t.Fatalf("restrict(absent target) error = %v, want EndGroups", err)
	}
	assertNonMemberBanHint(t, f.client)
	if calls := f.client.callsFor("restrictChatMember"); len(calls) != 0 {
		t.Fatalf("restrict prompt unexpectedly applied an action: %+v", calls)
	}
}

func TestRestrictButtonExplainsTargetThatLeftBeforeAction(t *testing.T) {
	f := newAdminChatFixture(t)
	f.client.errorsByUser = map[string]error{"restrictChatMember|13": errors.New("Bad Request: user is not a member of the chat")}
	msgCtx := newModuleMessageContext(f.bot, f.chat, f.admin, "/restrict 13")
	data := moderationButtonData("restrict", msgCtx.EffectiveMessage, &f.chat, map[string]string{"a": "mute", "u": "13"})
	ctx := newModuleCallbackContext(f.bot, f.chat, f.admin, data)

	if err := bansModule.restrictButtonHandler(f.bot, ctx); err != ext.EndGroups {
		t.Fatalf("restrictButtonHandler() error = %v, want EndGroups", err)
	}
	calls := f.client.callsFor("answerCallbackQuery")
	if len(calls) != 1 || !strings.Contains(fmt.Sprint(calls[0].Params["text"]), nonMemberBanHint) {
		t.Fatalf("callback answers = %+v, want the non-member /ban hint", calls)
	}
	if calls[0].Params["show_alert"] != true {
		t.Fatalf("callback answer params = %+v, want show_alert=true", calls[0].Params)
	}
	if edits := f.client.callsFor("editMessageText"); len(edits) != 0 {
		t.Fatalf("restrict button reported success after refusal: %+v", edits)
	}
}

func TestUnrestrictButtonExplainsTargetThatLeftBeforeAction(t *testing.T) {
	f := newAdminChatFixture(t)
	f.client.errorsByUser = map[string]error{"restrictChatMember|13": errors.New("Bad Request: user is not a member of the chat")}
	msgCtx := newModuleMessageContext(f.bot, f.chat, f.admin, "/unrestrict 13")
	data := moderationButtonData("unrestrict", msgCtx.EffectiveMessage, &f.chat, map[string]string{"a": "unmute", "u": "13"})
	ctx := newModuleCallbackContext(f.bot, f.chat, f.admin, data)

	if err := bansModule.unrestrictButtonHandler(f.bot, ctx); err != ext.EndGroups {
		t.Fatalf("unrestrictButtonHandler() error = %v, want EndGroups", err)
	}
	calls := f.client.callsFor("answerCallbackQuery")
	if len(calls) != 1 || !strings.Contains(fmt.Sprint(calls[0].Params["text"]), nonMemberBanHint) {
		t.Fatalf("callback answers = %+v, want the non-member /ban hint", calls)
	}
	if calls[0].Params["show_alert"] != true {
		t.Fatalf("callback answer params = %+v, want show_alert=true", calls[0].Params)
	}
	if edits := f.client.callsFor("editMessageText"); len(edits) != 0 {
		t.Fatalf("unrestrict button reported success after refusal: %+v", edits)
	}
}
