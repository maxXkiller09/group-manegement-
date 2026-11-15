package panel

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/divkix/Alita_Robot/alita/db"
	"github.com/divkix/Alita_Robot/alita/db/models"
	"github.com/divkix/Alita_Robot/alita/utils/punishment"
	log "github.com/sirupsen/logrus"
)

const maxActionReasonRunes = 3000

type directActionRequest struct {
	Action    string `json:"action"`
	TargetID  int64  `json:"target_user_id"`
	Reason    string `json:"reason"`
	Confirmed bool   `json:"confirmed"`
}

type directActionResponse struct {
	Applied  bool   `json:"applied"`
	Action   string `json:"action"`
	TargetID int64  `json:"target_user_id"`
	Message  string `json:"message"`
}

// handleDirectAction runs a deliberately small allowlist of typed moderation
// actions. It never accepts command text, arguments, or arbitrary Telegram API
// methods. Authentication, current group access, rate limiting, and Telegram
// rights are rechecked on every request.
func (p *Panel) handleDirectAction(w http.ResponseWriter, r *http.Request) {
	session, access, ok := p.chatRequest(w, r)
	if !ok {
		return
	}
	if !requireWritable(w, access) {
		return
	}

	var request directActionRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_body", "body must contain action, target_user_id, reason and confirmed")
		return
	}
	request.Action = strings.ToLower(strings.TrimSpace(request.Action))
	request.Reason = strings.TrimSpace(request.Reason)
	if request.TargetID <= 0 || request.TargetID == session.User.ID || request.TargetID == p.bot.Id {
		writeJSONError(w, http.StatusBadRequest, "invalid_target", "target_user_id must be a valid user other than you or the bot")
		return
	}
	if utf8.RuneCountInString(request.Reason) > maxActionReasonRunes {
		writeJSONError(w, http.StatusBadRequest, "reason_too_long", "reason must be 3000 characters or fewer")
		return
	}
	if request.Action != "ban" && request.Action != "kick" && request.Action != "mute" && request.Action != "unban" {
		writeJSONError(w, http.StatusBadRequest, "unsupported_action", "supported actions are ban, kick, mute and unban")
		return
	}
	if !request.Confirmed {
		writeJSONError(w, http.StatusPreconditionRequired, "confirmation_required", "review the action and confirm it in the Mini App")
		return
	}
	if !p.requirePermission(w, r, access, session.User.ID, permRestrict|permBotRestrict) {
		return
	}

	target, err := p.bot.GetChatMemberWithContext(r.Context(), access.ChatID, request.TargetID, nil)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "target_lookup_failed", "Telegram could not verify this target member")
		return
	}
	targetRole, isMember := memberRole(target)
	if request.Action != "unban" {
		if !isMember {
			writeJSONError(w, http.StatusNotFound, "target_not_member", "target must be a current group member")
			return
		}
		if targetRole == RoleAdmin {
			writeJSONError(w, http.StatusForbidden, "protected_admin", "group admins and owners cannot be targeted")
			return
		}
	} else if isMember && targetRole == RoleAdmin {
		writeJSONError(w, http.StatusForbidden, "protected_admin", "group admins and owners cannot be targeted")
		return
	}

	var result punishment.Result
	switch request.Action {
	case "ban", "kick", "mute":
		mode := punishment.Mode(request.Action)
		result, err = punishment.Apply(r.Context(), p.bot, punishment.Request{
			ChatID:  access.ChatID,
			Target:  punishment.Target{ID: request.TargetID},
			Mode:    mode,
			Source:  "mini_app",
			Reason:  request.Reason,
			ActorID: session.User.ID,
		})
	case "unban":
		result, err = punishment.Lift(r.Context(), p.bot, punishment.LiftRequest{
			ChatID:  access.ChatID,
			Target:  punishment.Target{ID: request.TargetID},
			Mode:    punishment.Ban,
			ActorID: session.User.ID,
		})
	}
	if err != nil {
		log.WithError(err).WithFields(log.Fields{
			"chat_id": access.ChatID, "actor_id": session.User.ID,
			"target_user_id": request.TargetID, "action": request.Action,
		}).Warn("[Panel] Direct moderation action failed")
		writeJSONError(w, http.StatusBadGateway, "telegram_action_failed", "Telegram could not complete this action")
		return
	}
	if !result.Applied {
		writeJSONError(w, http.StatusConflict, "action_refused", "Telegram or the bot refused this action: "+result.Refusal)
		return
	}

	event := models.ModerationEvent{
		ChatId:       access.ChatID,
		ActorId:      session.User.ID,
		TargetUserId: request.TargetID,
		Action:       request.Action,
		Reason:       request.Reason,
		CreatedAt:    time.Now().UTC(),
	}
	if err := db.DB.WithContext(r.Context()).Create(&event).Error; err != nil {
		log.WithError(err).WithFields(log.Fields{
			"chat_id": access.ChatID, "actor_id": session.User.ID,
			"target_user_id": request.TargetID, "action": request.Action,
		}).Error("[Panel] Direct moderation action succeeded but timeline audit write failed")
		writeJSONError(w, http.StatusInternalServerError, "audit_write_failed", "action succeeded, but its audit record could not be saved; contact the bot owner")
		return
	}

	message := "Action successfully applied."
	writeJSON(w, http.StatusOK, directActionResponse{
		Applied: true, Action: request.Action, TargetID: request.TargetID, Message: message,
	})
}
