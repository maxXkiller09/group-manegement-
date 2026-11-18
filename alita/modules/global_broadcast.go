package modules

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf16"
	"unicode/utf8"

	"github.com/PaulSonOfLars/gotgbot/v2"
	"github.com/PaulSonOfLars/gotgbot/v2/ext"
	log "github.com/sirupsen/logrus"

	"github.com/divkix/Alita_Robot/alita/db/chats"
	"github.com/divkix/Alita_Robot/alita/utils/cache"
	"github.com/divkix/Alita_Robot/alita/utils/chat_status"
	"github.com/divkix/Alita_Robot/alita/utils/helpers"
)

const (
	globalLogChatKey    = "alita:ops:global_log_chat"
	broadcastPreviewTTL = 2 * time.Minute
	broadcastRateLimit  = 40 * time.Millisecond
)

type broadcastPreview struct {
	ownerID     int64
	originChatID int64
	message     string
	targetCount int
	expiresAt   time.Time
}

var broadcastState = struct {
	sync.Mutex
	previews map[int64]broadcastPreview
	running bool
}{previews: make(map[int64]broadcastPreview)}

func saveGlobalLogChat(chatID int64) error {
	m := cache.GetMarshal()
	if m == nil {
		return fmt.Errorf("persistent cache is unavailable")
	}
	return m.Set(cache.Context, globalLogChatKey, chatID)
}

func getGlobalLogChat() (int64, error) {
	m := cache.GetMarshal()
	if m == nil {
		return 0, fmt.Errorf("persistent cache is unavailable")
	}
	var chatID int64
	if _, err := m.Get(cache.Context, globalLogChatKey, &chatID); err != nil {
		return 0, err
	}
	if chatID >= 0 || chat_status.IsChannelId(chatID) {
		return 0, fmt.Errorf("global log group is not configured")
	}
	return chatID, nil
}

// validBroadcastMessage enforces Telegram's text limit in UTF-16 code units,
// which differs from rune count for supplementary-plane characters.
func validBroadcastMessage(message string) bool {
	return message != "" && utf8.ValidString(message) && len(utf16.Encode([]rune(message))) <= 4000
}

func activeBroadcastTargets() []int64 {
	all := chats.GetAllChats()
	targets := make([]int64, 0, len(all))
	for id, chat := range all {
		if id < 0 && !chat_status.IsChannelId(id) && !chat.IsInactive {
			targets = append(targets, id)
		}
	}
	sort.Slice(targets, func(i, j int) bool { return targets[i] < targets[j] })
	return targets
}

func (moduleStruct) setGlobalLogChat(c *helpers.CommandContext) error {
	if c.Chat == nil || (c.Chat.Type != "group" && c.Chat.Type != "supergroup") {
		_, _ = c.Msg.Reply(c.Bot, "Run /setloggc inside the group you want to use as the global log group.", nil)
		return ext.EndGroups
	}
	if err := saveGlobalLogChat(c.Chat.Id); err != nil {
		log.Errorf("[GlobalBroadcast] save global log group: %v", err)
		_, _ = c.Msg.Reply(c.Bot, "Could not save the global log group. Persistent storage is unavailable.", nil)
		return ext.EndGroups
	}
	_, _ = c.Msg.Reply(c.Bot, fmt.Sprintf("Global log group saved: %s (%d).", c.Chat.Title, c.Chat.Id), nil)
	return ext.EndGroups
}

func (moduleStruct) broadcastPreviewCommand(c *helpers.CommandContext) error {
	args := c.Ctx.Args()
	if len(args) < 2 {
		_, _ = c.Msg.Reply(c.Bot, "Usage: /broadcast <message>", nil)
		return ext.EndGroups
	}
	messageText := strings.TrimSpace(strings.Join(args[1:], " "))
	if !validBroadcastMessage(messageText) {
		_, _ = c.Msg.Reply(c.Bot, "Message must contain text and be no longer than 4,000 characters.", nil)
		return ext.EndGroups
	}
	targetCount := len(activeBroadcastTargets())
	if targetCount == 0 {
		_, _ = c.Msg.Reply(c.Bot, "There are no active registered groups to broadcast to.", nil)
		return ext.EndGroups
	}
	if c.User == nil {
		_, _ = c.Msg.Reply(c.Bot, "Owner identity could not be verified. Please retry.", nil)
		return ext.EndGroups
	}
	ownerID := c.User.Id
	broadcastState.Lock()
	broadcastState.previews[ownerID] = broadcastPreview{
		ownerID: ownerID,
		originChatID: c.Chat.Id,
		message: messageText,
		targetCount: targetCount,
		expiresAt: time.Now().Add(broadcastPreviewTTL),
	}
	broadcastState.Unlock()

	preview := fmt.Sprintf("BROADCAST PREVIEW\n\nTargets: %d active groups\nExpires in: 2 minutes\n\n%s\n\nSend /broadcast_confirm to start. No message has been sent yet.", targetCount, messageText)
	_, err := c.Msg.Reply(c.Bot, preview, nil)
	if err != nil {
		log.Errorf("[GlobalBroadcast] preview reply failed: %v", err)
	}
	return ext.EndGroups
}

func (moduleStruct) confirmBroadcast(c *helpers.CommandContext) error {
	if c.User == nil {
		_, _ = c.Msg.Reply(c.Bot, "Owner identity could not be verified. Please retry.", nil)
		return ext.EndGroups
	}
	ownerID := c.User.Id
	broadcastState.Lock()
	if broadcastState.running {
		broadcastState.Unlock()
		_, _ = c.Msg.Reply(c.Bot, "A broadcast is already running. Please wait for its delivery summary.", nil)
		return ext.EndGroups
	}
	preview, ok := broadcastState.previews[ownerID]
	if ok {
		delete(broadcastState.previews, ownerID)
	}
	if !ok || time.Now().After(preview.expiresAt) {
		broadcastState.Unlock()
		_, _ = c.Msg.Reply(c.Bot, "No valid broadcast preview found. Create a new one with /broadcast <message>.", nil)
		return ext.EndGroups
	}
	broadcastState.running = true
	broadcastState.Unlock()

	_, _ = c.Msg.Reply(c.Bot, fmt.Sprintf("Broadcast started for %d active groups. I'll send a delivery summary when it finishes.", preview.targetCount), nil)
	go deliverBroadcast(c.Bot, preview)
	return ext.EndGroups
}

func deliverBroadcast(b *gotgbot.Bot, preview broadcastPreview) {
	targets := activeBroadcastTargets()
	sent, failed := 0, 0
	for _, chatID := range targets {
		_, err := b.SendMessage(chatID, preview.message, nil)
		if err != nil {
			failed++
			log.WithFields(log.Fields{"chat_id": chatID, "error": err}).Warn("[GlobalBroadcast] delivery failed")
		} else {
			sent++
		}
		time.Sleep(broadcastRateLimit)
	}

	summary := fmt.Sprintf("Broadcast completed. Delivered: %d | Failed: %d | Attempted: %d.", sent, failed, len(targets))
	if _, err := b.SendMessage(preview.originChatID, summary, nil); err != nil {
		log.Errorf("[GlobalBroadcast] could not send owner delivery summary: %v", err)
	}
	auditGlobalBroadcast(b, preview.ownerID, sent, failed, len(targets))
	broadcastState.Lock()
	broadcastState.running = false
	broadcastState.Unlock()
}

func auditGlobalBroadcast(b *gotgbot.Bot, ownerID int64, sent, failed, attempted int) {
	logChatID, err := getGlobalLogChat()
	if err != nil {
		log.Warnf("[GlobalBroadcast] audit skipped: %v", err)
		return
	}
	text := fmt.Sprintf("GLOBAL BROADCAST\nOwner ID: %d\nDelivered: %d\nFailed: %d\nAttempted: %d", ownerID, sent, failed, attempted)
	if _, err := b.SendMessage(logChatID, text, nil); err != nil {
		log.Errorf("[GlobalBroadcast] audit delivery failed: %v", err)
	}
}

func (moduleStruct) broadcastList(c *helpers.CommandContext) error {
	targets := activeBroadcastTargets()
	logChatID, err := getGlobalLogChat()
	logStatus := "Not configured"
	if err == nil {
		logStatus = fmt.Sprintf("Configured (%d)", logChatID)
	}
	_, sendErr := c.Msg.Reply(c.Bot, fmt.Sprintf("Broadcast mode: All active registered groups\nActive group targets: %d\nGlobal log group: %s\nBroadcast status: %s", len(targets), logStatus, map[bool]string{true: "Running", false: "Idle"}[broadcastIsRunning()]), nil)
	if sendErr != nil {
		log.Errorf("[GlobalBroadcast] list reply failed: %v", sendErr)
	}
	return ext.EndGroups
}

func broadcastIsRunning() bool {
	broadcastState.Lock()
	defer broadcastState.Unlock()
	return broadcastState.running
}

func LoadGlobalBroadcast(dispatcher *ext.Dispatcher) {
	ownerOnly := []helpers.CheckFunc{helpers.RequireBotOwner()}
	helpers.WrapCommand(dispatcher, helpers.CommandDescriptor{
		Name: "setloggc",
		RequiredChecks: []helpers.CheckFunc{helpers.RequireBotOwner(), helpers.RequireGroup()},
	}, logChannelsModule.setGlobalLogChat)
	helpers.WrapCommand(dispatcher, helpers.CommandDescriptor{
		Name: "broadcast",
		RequiredChecks: ownerOnly,
	}, logChannelsModule.broadcastPreviewCommand)
	helpers.WrapCommand(dispatcher, helpers.CommandDescriptor{
		Name: "broadcast_confirm",
		RequiredChecks: ownerOnly,
	}, logChannelsModule.confirmBroadcast)
	helpers.WrapCommand(dispatcher, helpers.CommandDescriptor{
		Name: "broadcastlist",
		RequiredChecks: ownerOnly,
	}, logChannelsModule.broadcastList)
}
