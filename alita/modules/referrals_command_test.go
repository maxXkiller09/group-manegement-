package modules

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/PaulSonOfLars/gotgbot/v2/ext"

	"github.com/divkix/Alita_Robot/alita/db"
	"github.com/divkix/Alita_Robot/alita/db/models"
)

func TestReferralCreateAllowsRegularMembersAndAttributesThem(t *testing.T) {
	fixture := newAdminChatFixture(t)
	inviteURL := fmt.Sprintf("https://t.me/+member-%d", fixture.chat.Id)
	fixture.client.responses["createChatInviteLink"] = json.RawMessage(fmt.Sprintf(
		`{"invite_link":%q,"creator":{"id":999,"is_bot":true,"first_name":"Alita"},"creates_join_request":false,"is_primary":false,"is_revoked":false}`,
		inviteURL,
	))

	dispatcher := ext.NewDispatcher(&ext.DispatcherOpts{MaxRoutines: -1})
	LoadReferrals(dispatcher)
	ctx := newModuleMessageContext(fixture.bot, fixture.chat, fixture.member, "/referral create")
	if err := dispatcher.ProcessUpdate(fixture.bot, ctx.Update, nil); err != nil {
		t.Fatalf("member /referral create error = %v", err)
	}

	if calls := fixture.client.callsFor("createChatInviteLink"); len(calls) != 1 {
		t.Fatalf("createChatInviteLink calls = %d, want 1 for regular member", len(calls))
	}
	var saved models.ChatInviteLink
	if err := db.DB.Where("invite_link = ?", inviteURL).First(&saved).Error; err != nil {
		t.Fatalf("member invite link was not saved: %v", err)
	}
	if saved.ChatID != fixture.chat.Id || saved.CreatorID != fixture.member.Id {
		t.Fatalf("saved invite = %+v, want chat %d and member creator %d", saved, fixture.chat.Id, fixture.member.Id)
	}
	replies := fixture.client.callsFor("sendMessage")
	if len(replies) != 1 || !strings.Contains(fmt.Sprint(replies[0].Params["text"]), inviteURL) {
		t.Fatalf("member invite reply = %+v, want the created link", replies)
	}
}

func TestReferralStatsRemainAdminOnly(t *testing.T) {
	fixture := newAdminChatFixture(t)
	dispatcher := ext.NewDispatcher(&ext.DispatcherOpts{MaxRoutines: -1})
	LoadReferrals(dispatcher)

	memberCtx := newModuleMessageContext(fixture.bot, fixture.chat, fixture.member, "/referral stats")
	if err := dispatcher.ProcessUpdate(fixture.bot, memberCtx.Update, nil); err != nil {
		t.Fatalf("member /referral stats error = %v", err)
	}
	if calls := fixture.client.callsFor("sendMessage"); len(calls) != 1 {
		t.Fatalf("member stats replies = %d, want one permission refusal", len(calls))
	}
	if text := fmt.Sprint(fixture.client.callsFor("sendMessage")[0].Params["text"]); strings.Contains(text, "No tracked joins") {
		t.Fatalf("regular member received admin referral stats: %q", text)
	}
	if calls := fixture.client.callsFor("getChatAdministrators"); len(calls) != 1 {
		t.Fatalf("admin verification calls = %d, want 1", len(calls))
	}

	adminCtx := newModuleMessageContext(fixture.bot, fixture.chat, fixture.admin, "/referral stats")
	if err := dispatcher.ProcessUpdate(fixture.bot, adminCtx.Update, nil); err != nil {
		t.Fatalf("admin /referral stats error = %v", err)
	}
	replies := fixture.client.callsFor("sendMessage")
	if len(replies) != 2 || !strings.Contains(fmt.Sprint(replies[1].Params["text"]), "No tracked joins") {
		t.Fatalf("admin stats replies = %+v, want the empty-state stats message", replies)
	}
}
