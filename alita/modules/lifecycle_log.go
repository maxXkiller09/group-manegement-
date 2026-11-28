package modules

import (
	"errors"
	"fmt"
	"html"
	"strings"
	"sync"
	"time"

	"github.com/PaulSonOfLars/gotgbot/v2"
	log "github.com/sirupsen/logrus"

	"github.com/divkix/Alita_Robot/alita/config"
	"github.com/divkix/Alita_Robot/alita/utils/formatting"
)

const (
	lifecycleLogRequestTimeout      = 5 * time.Second
	lifecycleLogMemberCountTimeout   = time.Second
	lifecycleLogMinInterval          = time.Second
	lifecycleLogDedupeWindow   = 24 * time.Hour
	lifecycleLogQueueSize      = 64
)

type lifecycleLogTask struct {
	bot      *gotgbot.Bot
	chatID   int64
	eventKey string
	message  string
	prepare  func() string
	sendAt   time.Time
}

var (
	lifecycleLogQueue      = make(chan lifecycleLogTask, lifecycleLogQueueSize)
	lifecycleLogWorkerOnce sync.Once
	lifecycleLogState      = struct {
		sync.Mutex
		seen       map[string]time.Time
		nextSend   time.Time
		pending    int
		disabled   bool
		warnedOnce bool
	}{seen: make(map[string]time.Time)}
)

func startLifecycleLogWorker() {
	lifecycleLogWorkerOnce.Do(func() {
		go func() {
			for task := range lifecycleLogQueue {
				deliverLifecycleLog(task)
				lifecycleLogState.Lock()
				lifecycleLogState.pending--
				lifecycleLogState.Unlock()
			}
		}()
	})
}

// enqueueLifecycleLog schedules a content-free operational event in
// MESSAGE_DUMP. The bounded worker serializes delivery and rate-limits sends.
func enqueueLifecycleLog(b *gotgbot.Bot, eventKey, message string) {
	enqueueLifecycleLogWithBuilder(b, eventKey, func() string { return message })
}

func enqueueLifecycleLogWithBuilder(b *gotgbot.Bot, eventKey string, prepare func() string) {
	if b == nil || config.AppConfig == nil || config.AppConfig.MessageDump == 0 || eventKey == "" || prepare == nil {
		return
	}

	now := time.Now()
	lifecycleLogState.Lock()
	if lifecycleLogState.disabled {
		lifecycleLogState.Unlock()
		return
	}
	for key, created := range lifecycleLogState.seen {
		if now.Sub(created) > lifecycleLogDedupeWindow {
			delete(lifecycleLogState.seen, key)
		}
	}
	if _, exists := lifecycleLogState.seen[eventKey]; exists {
		lifecycleLogState.Unlock()
		return
	}
	lifecycleLogState.seen[eventKey] = now

	sendAt := now
	if lifecycleLogState.nextSend.After(sendAt) {
		sendAt = lifecycleLogState.nextSend
	}
	lifecycleLogState.nextSend = sendAt.Add(lifecycleLogMinInterval)
	lifecycleLogState.pending++
	task := lifecycleLogTask{
		bot: b, chatID: config.AppConfig.MessageDump, eventKey: eventKey,
		prepare: prepare, sendAt: sendAt,
	}
	lifecycleLogState.Unlock()

	startLifecycleLogWorker()
	select {
	case lifecycleLogQueue <- task:
	default:
		lifecycleLogState.Lock()
		lifecycleLogState.pending--
		lifecycleLogState.Unlock()
		log.Warn("[LifecycleLog] MESSAGE_DUMP queue is full; dropping lifecycle notice")
	}
}

func deliverLifecycleLog(task lifecycleLogTask) {
	defer func() {
		if recovered := recover(); recovered != nil {
			log.Errorf("[LifecycleLog] Recovered from lifecycle delivery panic: %v", recovered)
		}
	}()

	if delay := time.Until(task.sendAt); delay > 0 {
		time.Sleep(delay)
	}
	lifecycleLogState.Lock()
	disabled := lifecycleLogState.disabled
	lifecycleLogState.Unlock()
	if disabled {
		return
	}

	message := task.message
	if task.prepare != nil {
		message = task.prepare()
	}
	if message == "" {
		return
	}
	_, err := task.bot.SendMessage(task.chatID, message, &gotgbot.SendMessageOpts{
		ParseMode: formatting.HTML,
		RequestOpts: &gotgbot.RequestOpts{
			Timeout: lifecycleLogRequestTimeout,
		},
	})
	if err == nil {
		return
	}

	var telegramErr *gotgbot.TelegramError
	if errors.As(err, &telegramErr) && telegramErr.Code == 400 &&
		strings.Contains(strings.ToLower(telegramErr.Description), "chat not found") {
		lifecycleLogState.Lock()
		shouldWarn := !lifecycleLogState.warnedOnce
		lifecycleLogState.warnedOnce = true
		lifecycleLogState.disabled = true
		lifecycleLogState.Unlock()
		if shouldWarn {
			log.WithError(err).Warn("[LifecycleLog] MESSAGE_DUMP chat not found; lifecycle event delivery disabled until restart")
		}
		return
	}
	log.WithError(err).Warn("[LifecycleLog] Failed to deliver lifecycle event; bot update processing will continue")
}

func lifecycleUserLabel(user *gotgbot.User) string {
	if user == nil {
		return "unknown"
	}
	name := strings.TrimSpace(user.FirstName + " " + user.LastName)
	if name == "" {
		name = "Unknown user"
	}
	label := fmt.Sprintf("%s (<code>%d</code>)", html.EscapeString(name), user.Id)
	if user.Username != "" {
		label += " @" + html.EscapeString(user.Username)
	}
	return label
}

func lifecycleEventTime(unixSeconds int64) string {
	if unixSeconds <= 0 {
		return time.Now().UTC().Format("2006-01-02 15:04:05 UTC")
	}
	return time.Unix(unixSeconds, 0).UTC().Format("2006-01-02 15:04:05 UTC")
}

func lifecycleGroupTitle(chat *gotgbot.Chat) string {
	if chat == nil || chat.Title == "" {
		return "Untitled group"
	}
	return html.EscapeString(chat.Title)
}
