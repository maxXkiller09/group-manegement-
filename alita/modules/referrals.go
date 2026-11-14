package modules

import (
	"fmt"
	"html"
	"strings"
	"unicode/utf8"

	"github.com/PaulSonOfLars/gotgbot/v2"
	"github.com/PaulSonOfLars/gotgbot/v2/ext"

	"github.com/divkix/Alita_Robot/alita/db/models"
	"github.com/divkix/Alita_Robot/alita/db/referrals"
	"github.com/divkix/Alita_Robot/alita/utils/formatting"
	"github.com/divkix/Alita_Robot/alita/utils/helpers"
)

var referralModule = moduleStruct{moduleName: "Referrals"}

func (moduleStruct) referral(c *helpers.CommandContext) error {
	args := c.Ctx.Args()[1:]
	if len(args) == 0 {
		return referralUsage(c)
	}

	switch strings.ToLower(args[0]) {
	case "create":
		return createReferralLink(c, strings.TrimSpace(strings.Join(args[1:], " ")))
	case "stats":
		return showReferralStats(c)
	case "leaderboard":
		return showReferralLeaderboard(c)
	default:
		return referralUsage(c)
	}
}

func referralUsage(c *helpers.CommandContext) error {
	const usage = "Referral commands:\n/referral create [name] — create a tracked invite link\n/referral stats — show this group's link stats\n/referral leaderboard — show top inviters"
	_, err := c.Msg.Reply(c.Bot, usage, formatting.Shtml())
	return err
}

func createReferralLink(c *helpers.CommandContext, name string) error {
	if utf8.RuneCountInString(name) > 32 {
		_, err := c.Msg.Reply(c.Bot, "Link name must be 32 characters or fewer.", formatting.Shtml())
		return err
	}
	if c.User == nil || c.User.Id == 0 {
		_, err := c.Msg.Reply(c.Bot, "I couldn't identify the admin who requested this link. Please retry without anonymous admin mode.", formatting.Shtml())
		return err
	}

	link, err := c.Chat.CreateInviteLink(c.Bot, &gotgbot.CreateChatInviteLinkOpts{Name: name})
	if err != nil {
		_, replyErr := c.Msg.Reply(c.Bot, "I couldn't create an invite link. Please check that I have permission to invite users.", formatting.Shtml())
		if replyErr != nil {
			return replyErr
		}
		return ext.EndGroups
	}

	record := models.ChatInviteLink{
		InviteLink: link.InviteLink,
		ChatID:     c.Chat.Id,
		Name:       name,
		CreatorID:  c.User.Id,
	}
	if err := referrals.SaveInviteLink(record); err != nil {
		// Revoke a link that could not be stored: untracked links must not be
		// handed out because their joins cannot be attributed reliably.
		_, revokeErr := c.Chat.RevokeInviteLink(c.Bot, link.InviteLink, nil)
		if revokeErr != nil {
			return fmt.Errorf("save referral link: %w (also failed to revoke it: %v)", err, revokeErr)
		}
		_, replyErr := c.Msg.Reply(c.Bot, "The link was created but could not be saved, so I revoked it. Please try again later.", formatting.Shtml())
		return replyErr
	}

	label := "Tracked invite link"
	if name != "" {
		label += " (" + html.EscapeString(name) + ")"
	}
	text := fmt.Sprintf(`%s: <a href="%s">%s</a>`, label, html.EscapeString(link.InviteLink), html.EscapeString(link.InviteLink))
	_, err = c.Msg.Reply(c.Bot, text, formatting.Shtml())
	return err
}

func showReferralStats(c *helpers.CommandContext) error {
	rows, err := referrals.ListLinkStats(c.Chat.Id)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		_, err := c.Msg.Reply(c.Bot, "No tracked joins yet. Create a link with /referral create.", formatting.Shtml())
		return err
	}

	var text strings.Builder
	text.WriteString("<b>Tracked invite links</b>\n")
	var total int64
	for i, row := range rows {
		total += row.Joined
		fmt.Fprintf(&text, `\n%d. <a href="%s">Open link</a> — <b>%d</b> unique join(s)`, i+1, html.EscapeString(row.InviteLink), row.Joined)
	}
	fmt.Fprintf(&text, "\n\nTotal attributed members: <b>%d</b>", total)
	_, err = c.Msg.Reply(c.Bot, text.String(), formatting.Shtml())
	return err
}

func showReferralLeaderboard(c *helpers.CommandContext) error {
	rows, err := referrals.ListLeaderboard(c.Chat.Id)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		_, err := c.Msg.Reply(c.Bot, "The referral leaderboard is empty so far.", formatting.Shtml())
		return err
	}

	var text strings.Builder
	text.WriteString("<b>Top inviters</b>\n")
	for i, row := range rows {
		fmt.Fprintf(&text, "\n%d. <code>%d</code> — <b>%d</b> unique join(s)", i+1, row.InviterID, row.Joined)
	}
	_, err = c.Msg.Reply(c.Bot, text.String(), formatting.Shtml())
	return err
}

func LoadReferrals(dispatcher *ext.Dispatcher) {
	SetModuleEnabled(referralModule.moduleName, true)
	helpers.WrapCommand(dispatcher, helpers.CommandDescriptor{
		Name:       "referral",
		PMGroupArg: helpers.PMGroupArgNone,
		RequiredChecks: []helpers.CheckFunc{
			helpers.RequireGroup(),
			helpers.RequireConnectedAdmin(helpers.BotAdminRequired),
			helpers.RequireBotAdmin(),
			helpers.RequireUserAdmin(),
		},
	}, referralModule.referral)
}

func init() {
	RegisterLegacyModule("Referrals", 235, LoadReferrals)
}
