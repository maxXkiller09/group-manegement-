package modules

import (
	"fmt"
	"testing"

	"github.com/PaulSonOfLars/gotgbot/v2"
	"github.com/PaulSonOfLars/gotgbot/v2/ext"

	"github.com/divkix/Alita_Robot/alita/db"
	"github.com/divkix/Alita_Robot/alita/db/approvals"
)

func TestApprovalCommandsNonMemberTargetResolutionMatrix(t *testing.T) {
	useEnglishLocale(t)
	commands := []struct {
		name string
		run  func(*gotgbot.Bot, *ext.Context) error
		text func(string, bool) string
	}{
		{"approve", approvalsModule.approveUser, func(target string, reply bool) string {
			if reply {
				return "/approve"
			}
			return "/approve " + target + " reason"
		}},
		{"unapprove", approvalsModule.unapproveUser, func(target string, reply bool) string {
			if reply {
				return "/unapprove"
			}
			return "/unapprove " + target
		}},
	}
	for _, command := range commands {
		for _, membership := range []string{"member", "non-member"} {
			for _, targetMethod := range []string{"reply", "username", "numeric ID"} {
				t.Run(command.name+"/"+membership+"/"+targetMethod, func(t *testing.T) {
					f := newAdminChatFixture(t)
					targetID := uniquePositiveUserID()
					if targetMethod == "username" {
						if err := db.DB.Create(&db.User{UserId: targetID, UserName: "approvaluser"+fmt.Sprint(targetID), Name: "Approval Target"}).Error; err != nil {
							t.Fatal(err)
						}
					}
					if command.name == "unapprove" {
						if err := approvals.AddApprovedUser(f.chat.Id, targetID, f.admin.Id, "seed"); err != nil {
							t.Fatal(err)
						}
					}
					arg := fmt.Sprint(targetID)
					if targetMethod == "username" {
						arg = "@approvaluser" + fmt.Sprint(targetID)
					}
					if targetMethod == "reply" {
						arg = ""
					}
					ctx := newModuleMessageContext(f.bot, f.chat, f.admin, command.text(arg, targetMethod == "reply"))
					replyUser := gotgbot.User{Id: targetID, FirstName: "Approval Target"}
					if targetMethod != "reply" {
						replyUser = gotgbot.User{Id: uniquePositiveUserID(), FirstName: "Different Reply Sender"}
					}
					ctx.EffectiveMessage.ReplyToMessage = &gotgbot.Message{MessageId: 303, Date: 1, Chat: f.chat, From: &replyUser, Text: "reply source"}
					if err := command.run(f.bot, ctx); err != ext.EndGroups {
						t.Fatalf("%s error = %v, want EndGroups", command.name, err)
					}
					approved := approvals.IsUserApproved(f.chat.Id, targetID)
					if command.name == "approve" && !approved {
						t.Fatalf("target %d was not approved", targetID)
					}
					if command.name == "unapprove" && approved {
						t.Fatalf("target %d remained approved", targetID)
					}
					if targetMethod != "reply" && approvals.IsUserApproved(f.chat.Id, replyUser.Id) {
						t.Fatalf("reply sender %d was incorrectly modified", replyUser.Id)
					}
					for _, call := range f.client.callsFor("getChatMember") {
						if fmt.Sprint(call.Params["user_id"]) == fmt.Sprint(targetID) {
							t.Fatalf("approval target membership lookup occurred: %+v", call.Params)
						}
					}
				})
			}
		}
	}
}
