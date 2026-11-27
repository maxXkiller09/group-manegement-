package modules

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/PaulSonOfLars/gotgbot/v2"
	"github.com/PaulSonOfLars/gotgbot/v2/ext"
	"github.com/PaulSonOfLars/gotgbot/v2/ext/handlers"
	"github.com/PaulSonOfLars/gotgbot/v2/ext/handlers/filters/callbackquery"
	"github.com/PaulSonOfLars/gotgbot/v2/ext/handlers/filters/message"
	log "github.com/sirupsen/logrus"

	"github.com/divkix/Alita_Robot/alita/db/chats"
	"github.com/divkix/Alita_Robot/alita/db/lang"
	"github.com/divkix/Alita_Robot/alita/db/user"
	"github.com/divkix/Alita_Robot/alita/i18n"
	"github.com/divkix/Alita_Robot/alita/utils/cache"
	"github.com/divkix/Alita_Robot/alita/utils/chat_status"
	"github.com/divkix/Alita_Robot/alita/utils/error_handling"
	"github.com/divkix/Alita_Robot/alita/utils/formatting"
	"github.com/divkix/Alita_Robot/alita/utils/helpers"
)

// function used to get status of bot when it joined a group and send a message to the group
// also send a message to MESSAGE_DUMP telling that it joined a group
// botJoinedGroup handles bot addition to new groups.
// Sends welcome message and ensures the group is a supergroup before staying.
func botJoinedGroup(b *gotgbot.Bot, ctx *ext.Context) error {
	chat := ctx.EffectiveChat

	// don't log if it's a private chat
	if chat.Type == "private" {
		return ext.EndGroups
	}
	if (chat.Type == "group" || chat.Type == "supergroup") && ctx.MyChatMember != nil {
		// Only Telegram membership updates represent an actual bot addition.
		logBotAddedToGroup(b, ctx, chat)
	}

	// check if group is supergroup or not
	// if not a supergroup, send a message and leave it
	if chat.Type == "group" || chat.Type == "channel" {
		if chat.Type == "group" {
			tr := i18n.MustNewTranslator(lang.GetLanguage(ctx))
			text, _ := tr.GetString("bot_updates_need_supergroup")
			convertInstr, _ := tr.GetString("bot_updates_convert_instruction")
			convertHowto, _ := tr.GetString("bot_updates_convert_howto")
			_, err := b.SendMessage(
				chat.Id,
				fmt.Sprint(
					text,
					"\n\n",
					convertInstr,
					convertHowto,
					"https://telegra.ph/Convert-group-to-Supergroup-07-29",
				),
				formatting.Shtml(),
			)
			if err != nil {
				log.Error(err)
				return err
			}
		}

		_, err := b.LeaveChat(chat.Id, nil)
		if err != nil {
			log.Error(err)
			return err
		}

		return ext.EndGroups
	}

	// Persist lifecycle state independently of the welcome/admin checks. The
	// upsert is idempotent, so Telegram redeliveries and re-adds do not create
	// duplicate chat rows. A failed DB write must not suppress the welcome.
	chatID, chatTitle := chat.Id, chat.Title
	adderID := botJoinActorID(ctx)
	spawnAsyncUpdate(func() {
		if err := chats.TouchChat(chatID, chatTitle); err != nil {
			log.WithError(err).Warnf("[BotUpdates] Failed to persist bot addition for chat %d", chatID)
			return
		}
		if adderID > 0 {
			if err := chats.AddChatMember(chatID, adderID); err != nil {
				log.WithError(err).Warnf("[BotUpdates] Failed to track bot adder %d for chat %d", adderID, chatID)
			}
		}
	})

	tr := i18n.MustNewTranslator(lang.GetLanguage(ctx))

	// The MyChatMember update already contains the bot's new status. Use
	// that snapshot instead of making a synchronous Telegram lookup: the
	// welcome path must not wait for enrichment or fail on a Telegram timeout.
	msgAdmin := ""
	if !botIsAdminFromJoinUpdate(ctx) {
		msgAdmin, _ = tr.GetString("bot_updates_make_me_admin")
	}

	// send a message to group itself
	thanksText, _ := tr.GetString("bot_updates_thanks_for_adding")
	creatorsPlug, _ := tr.GetString("bot_updates_creators_plug")
	// Offer captcha with a button; it stays off until an admin presses it.
	var opts *gotgbot.SendMessageOpts
	buttonText, _ := tr.GetString("captcha_join_enable_button")
	if markup, ok := captchaJoinOfferMarkup(ctx, chat.Id, buttonText); ok {
		opts = &gotgbot.SendMessageOpts{ReplyMarkup: markup}
	}
	_, err := b.SendMessage(
		chat.Id,
		fmt.Sprint(thanksText, creatorsPlug, msgAdmin),
		opts,
	)
	if err != nil {
		log.Error(err)
		return err
	}

	return ext.ContinueGroups
}

// adminCacheAutoUpdate automatically refreshes admin cache when admin status changes.
// Reloads admin permissions cache if it's not already available.
func adminCacheAutoUpdate(b *gotgbot.Bot, ctx *ext.Context) error {
	chat := ctx.EffectiveChat
	if chat == nil {
		return ext.ContinueGroups
	}

	// Telegram admin-list requests are bounded but can still take several
	// seconds across retries. Keep them off the update handler so a membership
	// event never delays the welcome or other group processing.
	chatID, chatTitle := chat.Id, chat.Title
	spawnAsyncUpdate(func() {
		cache.InvalidateAdminCache(chatID)
		cache.LoadAdminCache(b, chatID)
		log.Info(fmt.Sprintf("Reloaded admin cache for %d (%s)", chatID, chatTitle))
	})

	return ext.ContinueGroups
}

// botIsAdminFromJoinUpdate reads the bot's status from the membership
// update itself, avoiding a Telegram API request in the welcome path.
func botIsAdminFromJoinUpdate(ctx *ext.Context) bool {
	if ctx == nil || ctx.MyChatMember == nil || ctx.MyChatMember.NewChatMember == nil {
		return false
	}
	status := ctx.MyChatMember.NewChatMember.GetStatus()
	return status == "administrator" || status == "creator"
}

// botJoinActorID returns the Telegram user who added the bot, when the
// update includes a MyChatMember event. Missing/system actors are ignored.
func botJoinActorID(ctx *ext.Context) int64 {
	if ctx == nil || ctx.MyChatMember == nil {
		return 0
	}
	return ctx.MyChatMember.From.Id
}

// verifyAnonymousAdmin handles callback verification for anonymous admins.
// When an anonymous admin presses the verify button, this function:
// 1. Verifies they are actually an admin in the chat
// 2. Retrieves the original command from cache
// 3. Executes the appropriate command handler with restored context
func verifyAnonymousAdmin(b *gotgbot.Bot, ctx *ext.Context) error {
	defer error_handling.RecoverFromPanic("bot_updates", "verifyAnonymousAdmin")

	query, ok := callbackQueryFromContext(ctx)
	if !ok {
		return ext.EndGroups
	}
	qmsg := query.Message
	tr := i18n.MustNewTranslator(lang.GetLanguage(ctx))
	if qmsg == nil {
		return answerInvalidCallback(b, ctx, query)
	}

	chatIDRaw := ""
	msgIDRaw := ""
	if decoded, ok := decodeCallbackData(query.Data, "anon_admin"); ok {
		chatIDRaw, _ = decoded.Field("c")
		msgIDRaw, _ = decoded.Field("m")
	}
	if chatIDRaw == "" || msgIDRaw == "" {
		log.Warnf("[BotUpdates] Invalid callback data format: %s", query.Data)
		return answerInvalidCallback(b, ctx, query)
	}
	chatId, err := strconv.ParseInt(chatIDRaw, 10, 64)
	if err != nil {
		log.Warnf("[BotUpdates] Invalid callback chat ID: %s (%s)", query.Data, chatIDRaw)
		return answerInvalidCallback(b, ctx, query)
	}
	msgId, err := strconv.ParseInt(msgIDRaw, 10, 64)
	if err != nil {
		log.Warnf("[BotUpdates] Invalid callback message ID: %s (%s)", query.Data, msgIDRaw)
		return answerInvalidCallback(b, ctx, query)
	}
	// The button is always sent as a reply to the command, so it lives in the command's chat.
	// Refuse a mismatch before any side effect: checks would run against chatId while the
	// command acts on ctx.EffectiveChat.
	if qmsg.GetChat().Id != chatId {
		log.Warnf("[BotUpdates] Callback chat %d does not match encoded chat %d", qmsg.GetChat().Id, chatId)
		return answerInvalidCallback(b, ctx, query)
	}

	// if non-admins try to press it
	// using this func because it's the only one that can be called by taking chatId from callback query
	if !chat_status.IsUserAdmin(b, chatId, query.From.Id) {
		text, _ := tr.GetString("bot_updates_need_admin")
		_, err := query.Answer(b,
			&gotgbot.AnswerCallbackQueryOpts{
				Text: text,
			},
		)
		if err != nil {
			log.Error(err)
			return err
		}
		return ext.EndGroups
	}

	msg, errCache := getAnonAdminCache(chatId, msgId)

	if errCache != nil {
		tr := i18n.MustNewTranslator(lang.GetLanguage(ctx))
		expiredText, _ := tr.GetString("bot_updates_button_expired")
		_, _, err := qmsg.EditText(b, &gotgbot.EditMessageTextOpts{Text: expiredText})
		if err != nil {
			log.Error(err)
			return err
		}
		return ext.EndGroups
	}

	if msg == nil {
		log.WithFields(log.Fields{
			"chatId": chatId,
			"msgId":  msgId,
		}).Error("getAnonAdminCache: nil message from cache")
		return ext.EndGroups
	}

	_, err = qmsg.Delete(b, nil)
	if err != nil {
		log.Error(err)
		return err
	}
	// Stop the button's loading spinner; a failed answer must not cancel the confirmed command.
	if _, err := query.Answer(b, nil); err != nil {
		log.Error(err)
	}

	ctx.EffectiveMessage = msg            // set the message to the message that was originally used when command was given
	ctx.EffectiveMessage.SenderChat = nil // make senderChat nil to avoid chat_status.isAnonAdmin to mistaken user for GroupAnonymousBot
	// Replay as the original message update: chat_status reads the chat from ctx.Update,
	// so clearing only CallbackQuery would leave the replayed command without a chat.
	ctx.Update = &gotgbot.Update{UpdateId: ctx.UpdateId, Message: msg}
	fromCopy := query.From
	ctx.EffectiveUser = &fromCopy
	ctx.EffectiveSender = &gotgbot.Sender{User: &fromCopy, ChatId: chatId}
	// Extract the command from Text or Caption (caption commands would panic on empty Text)
	text := msg.Text
	if text == "" {
		text = msg.Caption
	}
	if len(text) == 0 || text[0] != '/' {
		return ext.EndGroups
	}
	parts := strings.SplitN(text, " ", 2)
	command := strings.SplitN(parts[0][1:], "@", 2)[0]
	chat_status.SetConfirmedAnonymousAdmin(ctx, chatId, query.From.Id)

	if err := helpers.RunCommand(b, ctx, command); err != nil {
		return ext.EndGroups
	}
	return ext.EndGroups
}

// getAnonAdminCache retrieves cached message data for anonymous admin verification.
// Returns the original message context stored during anonymous admin command execution.
func getAnonAdminCache(chatId, msgId int64) (*gotgbot.Message, error) {
	m := cache.GetMarshal()
	if m == nil {
		return nil, fmt.Errorf("cache not initialized")
	}
	result, err := m.Get(cache.Context, chat_status.AnonAdminCacheKey(chatId, msgId), new(gotgbot.Message))
	if err != nil {
		return nil, err
	}
	return result.(*gotgbot.Message), nil
}

// botLeftGroup persists removal without making a Telegram request. The
// database upsert is safe for duplicate lifecycle updates and for chats that
// have not yet been observed by the message tracker.
func botLeftGroup(b *gotgbot.Bot, ctx *ext.Context) error {
	chat := ctx.EffectiveChat
	if chat == nil || (chat.Type != "group" && chat.Type != "supergroup") {
		return ext.ContinueGroups
	}
	chatID, chatTitle := chat.Id, chat.Title
	logBotRemovedFromGroup(b, ctx, chat)
	spawnAsyncUpdate(func() {
		if err := chats.MarkChatInactive(chatID, chatTitle); err != nil {
			log.WithError(err).Warnf("[BotUpdates] Failed to persist bot removal for chat %d", chatID)
		}
	})
	return ext.ContinueGroups
}

// logBotAddedToGroup gathers the member count asynchronously and sends a
// content-free lifecycle record to MESSAGE_DUMP.
func logBotAddedToGroup(b *gotgbot.Bot, ctx *ext.Context, chat *gotgbot.Chat) {
	if ctx == nil || chat == nil {
		return
	}
	updateID := ctx.UpdateId
	if updateID == 0 {
		updateID = time.Now().UnixNano()
	}
	var adder *gotgbot.User
	var eventTime int64
	if ctx.MyChatMember != nil {
		adderCopy := ctx.MyChatMember.From
		adder = &adderCopy
		eventTime = ctx.MyChatMember.Date
	}
	if adder == nil && ctx.EffectiveUser != nil {
		adderCopy := *ctx.EffectiveUser
		adder = &adderCopy
	}
	isAdmin := botIsAdminFromJoinUpdate(ctx)
	chatCopy := *chat
	enqueueLifecycleLogWithBuilder(b, fmt.Sprintf("bot-added:%d", updateID), func() string {
		memberCount := "unknown"
		count, err := b.GetChatMemberCount(chatCopy.Id, &gotgbot.GetChatMemberCountOpts{
			RequestOpts: &gotgbot.RequestOpts{Timeout: lifecycleLogRequestTimeout},
		})
		if err != nil {
			log.WithError(err).Warnf("[LifecycleLog] Could not read member count for group %d", chatCopy.Id)
		} else {
			memberCount = fmt.Sprint(count)
		}
		return fmt.Sprintf(
			"<b>BOT ADDED TO GROUP</b>\nGroup: %s\nChat ID: <code>%d</code>\nAdded by: %s\nMembers: %s\nBot admin: %t\nTime: %s",
			lifecycleGroupTitle(&chatCopy), chatCopy.Id, lifecycleUserLabel(adder), memberCount, isAdmin, lifecycleEventTime(eventTime),
		)
	})
}

// logBotRemovedFromGroup records the actor when Telegram includes it. A bot
// initiated leave is distinguished from a removal by another administrator.
func logBotRemovedFromGroup(b *gotgbot.Bot, ctx *ext.Context, chat *gotgbot.Chat) {
	if ctx == nil || chat == nil {
		return
	}
	updateID := ctx.UpdateId
	if updateID == 0 {
		updateID = time.Now().UnixNano()
	}
	var actor *gotgbot.User
	var eventTime int64
	if ctx.MyChatMember != nil {
		actor = &ctx.MyChatMember.From
		eventTime = ctx.MyChatMember.Date
	}
	action := "LEFT"
	actorLine := "Removed by: unknown"
	if actor != nil && b != nil && actor.Id == b.Id {
		actorLine = "Left by bot"
	} else if actor != nil {
		action = "REMOVED/KICKED"
		actorLine = "Removed by: " + lifecycleUserLabel(actor)
	}
	messageText := fmt.Sprintf(
		"<b>BOT %s GROUP</b>\nGroup: %s\nChat ID: <code>%d</code>\n%s\nTime: %s",
		action, lifecycleGroupTitle(chat), chat.Id, actorLine, lifecycleEventTime(eventTime),
	)
	enqueueLifecycleLog(b, fmt.Sprintf("bot-removed:%d", updateID), messageText)
}

// logPrivateStartMessage observes PM /start updates without registering a
// second command name or changing the existing /start command's handler.
func logPrivateStartMessage(b *gotgbot.Bot, ctx *ext.Context) error {
	if ctx == nil || ctx.EffectiveChat == nil || ctx.EffectiveChat.Type != "private" || ctx.EffectiveMessage == nil {
		return ext.ContinueGroups
	}
	parts := strings.Fields(ctx.EffectiveMessage.Text)
	if len(parts) == 0 || !strings.HasPrefix(parts[0], "/") {
		return ext.ContinueGroups
	}
	command := strings.SplitN(strings.TrimPrefix(parts[0], "/"), "@", 2)[0]
	if command != "start" {
		return ext.ContinueGroups
	}
	return logPrivateStart(b, ctx)
}

// logPrivateStart records first-time versus returning PM starts without
// including the user's message or deep-link payload. User lookup and formatting
// happen in the lifecycle worker, never in the update handler.
func logPrivateStart(b *gotgbot.Bot, ctx *ext.Context) error {
	if ctx == nil || ctx.EffectiveChat == nil || ctx.EffectiveChat.Type != "private" || ctx.EffectiveUser == nil || ctx.EffectiveMessage == nil {
		return ext.ContinueGroups
	}
	fields := strings.Fields(ctx.EffectiveMessage.Text)
	if len(fields) == 0 || !strings.HasPrefix(fields[0], "/") {
		return ext.ContinueGroups
	}
	command := strings.SplitN(strings.TrimPrefix(fields[0], "/"), "@", 2)[0]
	if command != "start" {
		return ext.ContinueGroups
	}
	startedBy := *ctx.EffectiveUser
	unixTime := int64(0)
	if ctx.EffectiveMessage != nil {
		unixTime = ctx.EffectiveMessage.Date
	}
	updateID := ctx.UpdateId
	if updateID == 0 {
		updateID = time.Now().UnixNano()
	}
	enqueueLifecycleLogWithBuilder(b, fmt.Sprintf("pm-start:%d", updateID), func() string {
		kind := "RETURNING"
		if user.CheckUserInfo(startedBy.Id) == nil {
			kind = "FIRST TIME"
		}
		return fmt.Sprintf(
			"<b>BOT PM START — %s</b>\nUser: %s\nTime: %s",
			kind, lifecycleUserLabel(&startedBy), lifecycleEventTime(unixTime),
		)
	})
	return ext.ContinueGroups
}

// logGroupMigration records Telegram's migration service message. It is a
// message update (not a MyChatMember update), so it is registered separately
// from the bot add/remove handlers.
func logGroupMigration(b *gotgbot.Bot, ctx *ext.Context) error {
	if ctx == nil || ctx.EffectiveMessage == nil {
		return ext.ContinueGroups
	}
	msg := ctx.EffectiveMessage
	var text string
	switch {
	case msg.MigrateToChatId != 0:
		text = fmt.Sprintf("<b>GROUP MIGRATION</b>\nFrom: <code>%d</code>\nTo: <code>%d</code>\nGroup: %s\nTime: %s",
			msg.Chat.Id, msg.MigrateToChatId, lifecycleGroupTitle(&msg.Chat), lifecycleEventTime(msg.Date))
	case msg.MigrateFromChatId != 0:
		text = fmt.Sprintf("<b>GROUP MIGRATION</b>\nFrom: <code>%d</code>\nTo: <code>%d</code>\nGroup: %s\nTime: %s",
			msg.MigrateFromChatId, msg.Chat.Id, lifecycleGroupTitle(&msg.Chat), lifecycleEventTime(msg.Date))
	default:
		return ext.ContinueGroups
	}
	updateID := ctx.UpdateId
	if updateID == 0 {
		updateID = time.Now().UnixNano()
	}
	enqueueLifecycleLog(b, fmt.Sprintf("group-migration:%d", updateID), text)
	return ext.ContinueGroups
}

// LoadBotUpdates registers bot event handlers for group management.
// Sets up handlers for bot joins, admin updates, and anonymous admin verification.
func LoadBotUpdates(dispatcher *ext.Dispatcher) {
	dispatcher.AddHandlerToGroup(handlers.NewMyChatMember(
		chat_status.ExtractAdminUpdateStatusChange, adminCacheAutoUpdate,
	), -2)
	dispatcher.AddHandlerToGroup(
		handlers.NewMyChatMember(
			func(u *gotgbot.ChatMemberUpdated) bool {
				wasMember, isMember := chat_status.ExtractJoinLeftStatusChange(u)
				return wasMember && !isMember
			},
			botLeftGroup,
		),
		-1,
	)
	dispatcher.AddHandlerToGroup(
		handlers.NewMyChatMember(
			func(u *gotgbot.ChatMemberUpdated) bool {
				wasMember, isMember := chat_status.ExtractJoinLeftStatusChange(u)
				return !wasMember && isMember
			},
			botJoinedGroup,
		),
		-1, // process before the default command group (after the group -2 admin-cache refresh)
	)

	dispatcher.AddHandler(
		handlers.NewChatMember(
			chat_status.ExtractAdminUpdateStatusChange,
			adminCacheAutoUpdate,
		),
	)

	dispatcher.AddHandler(handlers.NewMessage(message.All, logPrivateStartMessage))
	dispatcher.AddHandler(handlers.NewMessage(message.All, logGroupMigration))
	dispatcher.AddHandler(handlers.NewCallback(callbackquery.Prefix("anon_admin"), verifyAnonymousAdmin))
}

func init() {
	RegisterLegacyModule("BotUpdates", -10, LoadBotUpdates)
}
