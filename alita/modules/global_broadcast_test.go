package modules

import (
	"strings"
	"testing"
)

func TestValidBroadcastMessageUsesTelegramUTF16Limit(t *testing.T) {
	tests := []struct {
		name    string
		message string
		want    bool
	}{
		{name: "empty", message: "", want: false},
		{name: "plain text", message: "NexGuard update", want: true},
		{name: "exact UTF-16 limit", message: strings.Repeat("😀", 2000), want: true},
		{name: "over UTF-16 limit", message: strings.Repeat("😀", 2001), want: false},
		{name: "invalid UTF-8", message: string([]byte{0xff}), want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validBroadcastMessage(tt.message); got != tt.want {
				t.Fatalf("validBroadcastMessage() = %v, want %v", got, tt.want)
			}
		})
	}
}
