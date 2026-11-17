package panel

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/PaulSonOfLars/gotgbot/v2"

	"github.com/divkix/Alita_Robot/alita/utils/cache"
)

// Chat roles returned by the chat access helper.
const (
	RoleAdmin    = "admin"
	RoleReadonly = "readonly"
)

// chatAccessMemoTTL is how long an access answer is trusted. Writes with the
// panel are gated by the same answer, so keep it short.
const chatAccessMemoTTL = 60 * time.Second

// chatAccessMemoCap bounds the memo. One (chat, user) pair is one entry;
// reaching the cap clears the map instead of scanning it on every request, so
// the worst case is a few extra Telegram calls, never unbounded growth.
const chatAccessMemoCap = 4096

// Errors returned by accessChat. chatRequest maps them to stable panel error
// codes; every other error is a Telegram failure.
var (
	errNotGroup  = errors.New("chat is not a group")
	errNotMember = errors.New("user is not a member of the chat")
)

// chatRights is a read-only snapshot for UI explanation. It is never used to
// authorize writes; requirePermission always fetches current Telegram members.
type chatRights struct {
	CanChangeInfo      bool `json:"can_change_info"`
	CanRestrictMembers bool `json:"can_restrict_members"`
	BotCanRestrict     bool `json:"bot_can_restrict_members"`
	IsCreator          bool `json:"is_creator"`
}

// chatAccess is one verified chat: its Telegram title, caller role and the
// best-effort rights snapshot returned to read-only UI consumers.
type chatAccess struct {
	ChatID   int64
	Title    string
	Role     string
	BotAdmin bool
	Rights   *chatRights
}

type accessKey struct {
	chatID int64
	userID int64
}

type accessEntry struct {
	access  chatAccess
	expires time.Time
}

// accessChat verifies that userID is a current member of chatID and returns
// the caller's role. Only groups and supergroups are served; a non-member is
// refused with errNotMember, and a member who is not an admin is readonly.
// Results are memoised per (chat, user) for 60 seconds, successes only; later
// panel endpoints reuse this helper through the same memo.
func (p *Panel) accessChat(ctx context.Context, userID, chatID int64) (chatAccess, error) {
	key := accessKey{chatID: chatID, userID: userID}
	now := p.deps.Now()

	p.accessMu.Lock()
	entry, ok := p.access[key]
	p.accessMu.Unlock()
	if ok && now.Before(entry.expires) {
		return entry.access, nil
	}

	info, err := p.bot.GetChatWithContext(ctx, chatID, nil)
	if err != nil {
		return chatAccess{}, fmt.Errorf("get chat: %w", err)
	}
	if info.Type != "group" && info.Type != "supergroup" {
		return chatAccess{}, fmt.Errorf("%w: chat %d has type %q", errNotGroup, chatID, info.Type)
	}

	member, err := p.bot.GetChatMemberWithContext(ctx, chatID, userID, nil)
	if err != nil {
		return chatAccess{}, fmt.Errorf("get chat member: %w", err)
	}
	role, ok := memberRole(member)
	if !ok {
		status := "unknown"
		if member != nil {
			status = member.GetStatus()
		}
		return chatAccess{}, fmt.Errorf("%w: status %q", errNotMember, status)
	}

	botAdmin, botCanRestrict, botRightsKnown := p.botAccess(ctx, chatID)
	var rights *chatRights
	if botRightsKnown {
		rights = &chatRights{
			CanChangeInfo:      memberCan(member, permChangeInfo),
			CanRestrictMembers: memberCan(member, permRestrict),
			BotCanRestrict:     botCanRestrict,
			IsCreator:          member.GetStatus() == gotgbot.ChatMemberStatusCreator,
		}
	}

	access := chatAccess{
		ChatID:   chatID,
		Title:    info.Title,
		Role:     role,
		BotAdmin: botAdmin,
		Rights:   rights,
	}

	p.accessMu.Lock()
	if _, cached := p.access[key]; !cached && len(p.access) >= chatAccessMemoCap {
		clear(p.access)
	}
	p.access[key] = accessEntry{access: access, expires: now.Add(chatAccessMemoTTL)}
	p.accessMu.Unlock()

	return access, nil
}

// botAccess reuses the shared Telegram admin cache when possible. On a cache
// miss it performs the single bot-member lookup previously used by the access
// check. Failure is deliberately soft: callers still get readable settings,
// but the UI receives rights:null rather than guessed permissions.
func (p *Panel) botAccess(ctx context.Context, chatID int64) (isAdmin, canRestrict, known bool) {
	if found, member := cache.GetAdminCacheUser(chatID, p.bot.Id); found {
		return member.Status == gotgbot.ChatMemberStatusAdministrator,
			member.Status == gotgbot.ChatMemberStatusCreator || member.CanRestrictMembers, true
	}

	member, err := p.bot.GetChatMemberWithContext(ctx, chatID, p.bot.Id, nil)
	if err != nil || member == nil {
		return false, false, false
	}
	return member.GetStatus() == gotgbot.ChatMemberStatusAdministrator,
		memberCan(member, permRestrict), true
}

// memberRole is the panel role for one chat member. It reports false when the
// member is not in the chat: left, kicked, or restricted with is_member false.
func memberRole(member gotgbot.ChatMember) (string, bool) {
	if member == nil {
		return "", false
	}
	switch member.GetStatus() {
	case gotgbot.ChatMemberStatusCreator, gotgbot.ChatMemberStatusAdministrator:
		return RoleAdmin, true
	case gotgbot.ChatMemberStatusMember:
		return RoleReadonly, true
	case gotgbot.ChatMemberStatusRestricted:
		if restricted, ok := member.(gotgbot.ChatMemberRestricted); ok && restricted.IsMember {
			return RoleReadonly, true
		}
	}
	return "", false
}
