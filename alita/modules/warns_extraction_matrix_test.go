package modules

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/PaulSonOfLars/gotgbot/v2"
	"github.com/PaulSonOfLars/gotgbot/v2/ext"

	"github.com/divkix/Alita_Robot/alita/db"
	"github.com/divkix/Alita_Robot/alita/db/models"
	"github.com/divkix/Alita_Robot/alita/db/warns"
)

// These dispatcher-level cases complement extraction's unit tests: they prove
// the resolved target survives the real /warn command pipeline and is stored.
func TestWarnDispatcherResolvesNumericAndUsernameTargets(t *testing.T) {
	useEnglishLocale(t)

	for _, tc := range []struct {
		name     string
		target   string
		username string
	}{
		{name: "numeric ID", target: "numeric"},
		{name: "username", target: "username", username: "warnmatrixuser"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newAdminChatFixture(t)
			target := gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Warn Matrix Target"}
			f.client.membersByUser[fmt.Sprint(target.Id)] = json.RawMessage(
				fmt.Sprintf(`{"status":"member","user":{"id":%d,"is_bot":false,"first_name":"Warn Matrix Target"}}`, target.Id),
			)

			commandTarget := fmt.Sprint(target.Id)
			if tc.username != "" {
				if err := db.DB.Create(&db.User{
					UserId: target.Id, UserName: tc.username, Name: target.FirstName,
				}).Error; err != nil {
					t.Fatalf("create username lookup row: %v", err)
				}
				commandTarget = "@" + tc.username
			}

			dispatcher := ext.NewDispatcher(&ext.DispatcherOpts{MaxRoutines: -1})
			LoadWarns(dispatcher)
			ctx := newModuleMessageContext(f.bot, f.chat, f.admin, "/warn "+commandTarget+" matrix reason")
			if err := dispatcher.ProcessUpdate(f.bot, ctx.Update, nil); err != nil {
				t.Fatalf("ProcessUpdate(/warn %s) error = %v", commandTarget, err)
			}

			count, entries := warns.GetWarns(target.Id, f.chat.Id)
			if count != 1 || len(entries) != 1 || entries[0].Reason != "matrix reason" {
				t.Fatalf("stored warns = (%d, %+v), want one warn with reason %q", count, entries, "matrix reason")
			}
		})
	}
}

// A reply to a channel post has SenderChat but no real user target. The warn
// pipeline must reject it rather than warning a dummy From identity.
func TestWarnDispatcherRejectsReplyToAnonymousChannelPost(t *testing.T) {
	useEnglishLocale(t)
	f := newAdminChatFixture(t)
	channel := gotgbot.Chat{Id: -1001234567890, Type: "channel", Title: "Anonymous Channel"}
	ctx := newModuleMessageContext(f.bot, f.chat, f.admin, "/warn channel post")
	ctx.EffectiveMessage.ReplyToMessage = &gotgbot.Message{
		MessageId:  202,
		Date:       1,
		Chat:       f.chat,
		From:       &gotgbot.User{Id: 777123, FirstName: "Channel Placeholder"},
		SenderChat: &channel,
	}

	dispatcher := ext.NewDispatcher(&ext.DispatcherOpts{MaxRoutines: -1})
	LoadWarns(dispatcher)
	if err := dispatcher.ProcessUpdate(f.bot, ctx.Update, nil); err != nil {
		t.Fatalf("ProcessUpdate(reply to channel post) error = %v", err)
	}

	if count, _ := warns.GetWarns(777123, f.chat.Id); count != 0 {
		t.Fatalf("placeholder user received %d warns, want none", count)
	}
	calls := f.client.callsFor("sendMessage")
	if len(calls) != 1 || !strings.Contains(calls[0].Params["text"].(string), translated(t, "common_anonymous_user_error")) {
		t.Fatalf("replies = %+v, want the anonymous/channel target refusal", calls)
	}
}

func TestWarnCommandsNonMemberTargetResolutionMatrix(t *testing.T) {
	useEnglishLocale(t)
	commands := []struct {
		name string
		text func(string, bool) string
	}{
		{"warn", func(target string, reply bool) string {
			if reply {
				return "/warn spam"
			}
			return "/warn " + target + " spam"
		}},
		{"swarn", func(target string, reply bool) string {
			if reply {
				return "/swarn"
			}
			return "/swarn " + target
		}},
		{"dwarn", func(target string, reply bool) string {
			if reply {
				return "/dwarn"
			}
			return "/dwarn " + target + " spam"
		}},
	}
	for _, command := range commands {
		for _, membership := range []string{"member", "non-member"} {
			for _, targetMethod := range []string{"reply", "username", "numeric ID"} {
				t.Run(command.name+"/"+membership+"/"+targetMethod, func(t *testing.T) {
					f := newAdminChatFixture(t)
					targetID := uniquePositiveUserID()
					target := gotgbot.User{Id: targetID, FirstName: "Warn Matrix Target"}
					if targetMethod == "username" {
						if err := db.DB.Create(&db.User{UserId: targetID, UserName: "warnmatrix" + fmt.Sprint(targetID), Name: target.FirstName}).Error; err != nil {
							t.Fatal(err)
						}
					}
					status := "member"
					if membership == "non-member" {
						status = "left"
					}
					f.client.membersByUser[fmt.Sprint(targetID)] = json.RawMessage(fmt.Sprintf(
						`{"status":%q,"user":{"id":%d,"is_bot":false,"first_name":"Warn Matrix Target"}}`, status, targetID))
					arg := fmt.Sprint(targetID)
					if targetMethod == "username" {
						arg = "@warnmatrix" + fmt.Sprint(targetID)
					}
					if targetMethod == "reply" {
						arg = ""
					}
					text := command.text(arg, targetMethod == "reply")
					ctx := newModuleMessageContext(f.bot, f.chat, f.admin, text)
					replyUser := target
					if targetMethod != "reply" {
						replyUser = gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Different Reply Sender"}
					}
					ctx.EffectiveMessage.ReplyToMessage = &gotgbot.Message{MessageId: 303, Date: 1, Chat: f.chat, From: &replyUser, Text: "reply source"}
					dispatcher := ext.NewDispatcher(&ext.DispatcherOpts{MaxRoutines: -1})
					LoadWarns(dispatcher)
					if err := dispatcher.ProcessUpdate(f.bot, ctx.Update, nil); err != nil {
						t.Fatalf("ProcessUpdate(%s) error = %v", text, err)
					}
					if count, entries := warns.GetWarns(targetID, f.chat.Id); count != 1 || len(entries) != 1 {
						t.Fatalf("warn rows for target %d = %d/%d, want 1", targetID, count, len(entries))
					}
					if targetMethod != "reply" {
						if count, _ := warns.GetWarns(replyUser.Id, f.chat.Id); count != 0 {
							t.Fatalf("reply sender %d incorrectly received %d warns", replyUser.Id, count)
						}
					}
					for _, call := range f.client.callsFor("getChatMember") {
						if fmt.Sprint(call.Params["user_id"]) == fmt.Sprint(targetID) {
							t.Fatalf("warn target membership preflight occurred: %+v", call.Params)
						}
					}
				})
			}
		}
	}
}

func TestWarnRemovalCommandsNonMemberTargetResolutionMatrix(t *testing.T) {
	useEnglishLocale(t)
	commands := []struct {
		name string
		run  func(*gotgbot.Bot, *ext.Context) error
		text func(string, bool) string
	}{
		{"rmwarn", warnsModule.removeWarn, func(target string, reply bool) string {
			if reply {
				return "/rmwarn"
			}
			return "/rmwarn " + target
		}},
		{"resetwarns", warnsModule.resetWarns, func(target string, reply bool) string {
			if reply {
				return "/resetwarns"
			}
			return "/resetwarns " + target
		}},
	}
	for _, command := range commands {
		for _, membership := range []string{"member", "non-member"} {
			for _, targetMethod := range []string{"reply", "username", "numeric ID"} {
				t.Run(command.name+"/"+membership+"/"+targetMethod, func(t *testing.T) {
					f := newAdminChatFixture(t)
					targetID := uniquePositiveUserID()
					if targetMethod == "username" {
						if err := db.DB.Create(&db.User{UserId: targetID, UserName: "warnremove"+fmt.Sprint(targetID), Name: "Warn Removal Target"}).Error; err != nil {
							t.Fatal(err)
						}
					}
					if _, _, err := warns.WarnUser(targetID, f.chat.Id, models.WarnEntry{WarnedBy: f.admin.Id}); err != nil {
						t.Fatalf("seed warn: %v", err)
					}
					status := "member"
					if membership == "non-member" {
						status = "left"
					}
					f.client.membersByUser[fmt.Sprint(targetID)] = json.RawMessage(fmt.Sprintf(
						`{"status":%q,"user":{"id":%d,"is_bot":false,"first_name":"Warn Removal Target"}}`, status, targetID))
					arg := fmt.Sprint(targetID)
					if targetMethod == "username" {
						arg = "@warnremove" + fmt.Sprint(targetID)
					}
					if targetMethod == "reply" {
						arg = ""
					}
					ctx := newModuleMessageContext(f.bot, f.chat, f.admin, command.text(arg, targetMethod == "reply"))
					replyUser := gotgbot.User{Id: targetID, FirstName: "Warn Removal Target"}
					if targetMethod != "reply" {
						replyUser = gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Different Reply Sender"}
					}
					ctx.EffectiveMessage.ReplyToMessage = &gotgbot.Message{MessageId: 303, Date: 1, Chat: f.chat, From: &replyUser, Text: "reply source"}
					if err := command.run(f.bot, ctx); err != ext.EndGroups {
						t.Fatalf("%s error = %v, want EndGroups", command.name, err)
					}
					if count, _ := warns.GetWarns(targetID, f.chat.Id); count != 0 {
						t.Fatalf("%s left %d warns for target %d", command.name, count, targetID)
					}
					if targetMethod != "reply" {
						if count, _ := warns.GetWarns(replyUser.Id, f.chat.Id); count != 0 {
							t.Fatalf("reply sender %d received %d warns", replyUser.Id, count)
						}
					}
					for _, call := range f.client.callsFor("getChatMember") {
						if fmt.Sprint(call.Params["user_id"]) == fmt.Sprint(targetID) {
							t.Fatalf("warn removal target membership lookup occurred: %+v", call.Params)
						}
					}
				})
			}
		}
	}
}
