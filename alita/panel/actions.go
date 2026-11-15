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

// decodeDirectAction validates the Mini App request before any Telegram API call.
func decodeDirectAction(r *http.Request, actorID, botID int64) (directActionRequest, string) {
	var request directActionRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		return request, "body must contain action, target_user_id, reason and confirmed"
	}
	request.Action = strings.ToLower(strings.TrimSpace(request.Action))
	request.Reason = strings.TrimSpace(request.Reason)
	if request.TargetID <= 0 || request.TargetID == actorID || request.TargetID == botID {
		return request, "target_user_id must be a valid user other than you or the bot"
	}
	if utf8.RuneCountInString(request.Reason) > maxActionReasonRunes {
		return request, "reason must be 3000 characters or fewer"
	}
	switch request.Action {
	case "ban", "kick", "mute", "unban":
	default:
		return request, "supported actions are ban, kick, mute and unban"
	}
	if !request.Confirmed {
		return request, "review the action and confirm it in the Mini App"
	}
	return request, ""
}

func (p *Panel) verifyDirectActionTarget(r *http.Request, w http.ResponseWriter, chatID, targetID int64, action string) bool {
	target, err := p.bot.GetChatMemberWithContext(r.Context(), chatID, targetID, nil)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "target_lookup_failed", "Telegram could not verify this target member")
		return false
	}
	role, isMember := memberRole(target)
	if action != "unban" && !isMember {
		writeJSONError(w, http.StatusNotFound, "target_not_member", "target must be a current group member")
		return false
	}
	if isMember && role == RoleAdmin {
		writeJSONError(w, http.StatusForbidden, "protected_admin", "group admins and owners cannot be targeted")
		return false
	}
	return true
}

func (p *Panel) applyDirectAction(r *http.Request, chatID, actorID int64, request directActionRequest) (punishment.Result, error) {
	target := punishment.Target{ID: request.TargetID}
	if request.Action == "unban" {
		return punishment.Lift(r.Context(), p.bot, punishment.LiftRequest{
			ChatID: chatID, Target: target, Mode: punishment.Ban, ActorID: actorID,
		})
	}
	return punishment.Apply(r.Context(), p.bot, punishment.Request{
		ChatID: chatID, Target: target, Mode: punishment.Mode(request.Action),
		Source: "mini_app", Reason: request.Reason, ActorID: actorID,
	})
}

// handleDirectAction executes a strict allowlist of typed moderation actions.
// It never accepts command text or arbitrary Telegram API methods.
func (p *Panel) handleDirectAction(w http.ResponseWriter, r *http.Request) {
	session, access, ok := p.chatRequest(w, r)
	if !ok {
		return
	}
	if !requireWritable(w, access) {
		return
	}
	request, validationError := decodeDirectAction(r, session.User.ID, p.bot.Id)
	if validationError != "" {
		status := http.StatusBadRequest
		if !request.Confirmed {
			status = http.StatusPreconditionRequired
		}
		writeJSONError(w, status, "invalid_action_request", validationError)
		return
	}
	if !p.requirePermission(w, r, access, session.User.ID, permRestrict|permBotRestrict) {
		return
	}
	if !p.verifyDirectActionTarget(r, w, access.ChatID, request.TargetID, request.Action) {
		return
	}
	result, err := p.applyDirectAction(r, access.ChatID, session.User.ID, request)
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
		ChatId: access.ChatID, ActorId: session.User.ID, TargetUserId: request.TargetID,
		Action: request.Action, Reason: request.Reason, CreatedAt: time.Now().UTC(),
	}
	if err := db.DB.WithContext(r.Context()).Create(&event).Error; err != nil {
		log.WithError(err).WithFields(log.Fields{
			"chat_id": access.ChatID, "actor_id": session.User.ID,
			"target_user_id": request.TargetID, "action": request.Action,
		}).Error("[Panel] Direct moderation action succeeded but timeline audit write failed")
		writeJSONError(w, http.StatusInternalServerError, "audit_write_failed", "action succeeded, but its audit record could not be saved; contact the bot owner")
		return
	}
	writeJSON(w, http.StatusOK, directActionResponse{
		Applied: true, Action: request.Action, TargetID: request.TargetID, Message: "Action successfully applied.",
	})
}
