//go:build testtools

package modules

import (
	"reflect"
	"testing"
	"time"

	"github.com/divkix/Alita_Robot/alita/db"
)

func TestAntifloodCounterReturnsBurstAndStartsFreshAfterPunishment(t *testing.T) {
	module := &antifloodStruct{}
	settings := &db.AntifloodSettings{Limit: 2}

	for i, messageID := range []int64{101, 102, 103} {
		punish, burst := module.updateFloodWithSettings(-100123, 456, messageID, settings)
		if punish != (i == 2) {
			t.Fatalf("message %d punishment = %v, want %v", messageID, punish, i == 2)
		}
		if i == 2 && !reflect.DeepEqual(burst.messageIDs, []int64{101, 102, 103}) {
			t.Fatalf("punished burst message IDs = %v, want [101 102 103]", burst.messageIDs)
		}
	}

	punish, nextBurst := module.updateFloodWithSettings(-100123, 456, 104, settings)
	if punish {
		t.Fatal("first message after a punished burst must start a fresh counter")
	}
	if nextBurst.messageCount != 1 || !reflect.DeepEqual(nextBurst.messageIDs, []int64{104}) {
		t.Fatalf("new burst = %+v, want count 1 and message [104]", nextBurst)
	}
}

func TestAntifloodCounterResetsAfterIdleWindow(t *testing.T) {
	module := &antifloodStruct{}
	settings := &db.AntifloodSettings{Limit: 3}
	key := floodKey{chatId: -100124, userId: 457}

	module.updateFloodWithSettings(key.chatId, key.userId, 201, settings)
	value, ok := module.syncHelperMap.Load(key)
	if !ok {
		t.Fatal("first message did not create a flood counter")
	}
	counter := value.(*floodControl)
	counter.lastActivity = time.Now().Unix() - 61

	punish, burst := module.updateFloodWithSettings(key.chatId, key.userId, 202, settings)
	if punish {
		t.Fatal("message after idle window must not trigger punishment")
	}
	if burst.messageCount != 1 || !reflect.DeepEqual(burst.messageIDs, []int64{202}) {
		t.Fatalf("counter after idle window = %+v, want a fresh one-message burst", burst)
	}
}

func TestAntifloodCleanupRemovesOnlyStaleCounters(t *testing.T) {
	module := &antifloodStruct{}
	staleKey := floodKey{chatId: -100125, userId: 458}
	freshKey := floodKey{chatId: -100125, userId: 459}
	now := time.Now().Unix()

	module.syncHelperMap.Store(staleKey, &floodControl{userId: staleKey.userId, lastActivity: now - 601})
	module.syncHelperMap.Store(freshKey, &floodControl{userId: freshKey.userId, lastActivity: now})

	module.cleanupOnce(now)

	if _, ok := module.syncHelperMap.Load(staleKey); ok {
		t.Fatal("stale flood counter was not removed")
	}
	if _, ok := module.syncHelperMap.Load(freshKey); !ok {
		t.Fatal("fresh flood counter was removed")
	}
}
