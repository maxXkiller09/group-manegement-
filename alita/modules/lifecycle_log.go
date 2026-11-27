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
	lifecycleLogRequestTimeout = 5 * time.Second
	lifecycleLogMinInterval    = time.Second
	lifecycleLogDedupeWindow   = 24 * time.Hour
)

var lifecycleLogState = struct {
	sync.Mutex
	seen       map[string]time.Time
	nextSend   time.Time
	disabled   bool
	warnedOnce bool
}{seen: make(map[string]time.Time)}

// enqueueLifecycleLog schedules a short operational event in MESSAGE_DUMP.
// It reserves a dedupe key and rate-limit slot before handing delivery to the
// existing bounded async-update worker, so Telegram I/O never blocks handlers.
func enqueueLifecycleLog(b *gotgbot.Bot, eventKey, message string) {
	if b == nil || config.AppConfig == nil || config.AppConfig.MessageDump == 0 || eventKey == "" || message == "" {
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
	dumpChatID := config.AppConfig.MessageDump
	lifecycleLogState.Unlock()

	spawnAsyncUpdate(func() {
		if delay := time.Until(sendAt); delay > 0 {
			time.Sleep(delay)
		}
		lifecycleLogState.Lock()
		disabled := lifecycleLogState.disabled
		lifecycleLogState.Unlock()
		if disabled {
			return
		}

		_, err := b.SendMessage(dumpChatID, message, &gotgbot.SendMessageOpts{
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
	})
}

func lifecycleUserLabel(user *gotgbot.User) string {
	if user == nil {
		return "unknown"
	}
	name := strings.TrimSpace(strings.TrimSpace(user.FirstName + " " + user.LastName))
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
