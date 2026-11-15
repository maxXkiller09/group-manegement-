package panel

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/divkix/Alita_Robot/alita/db/models"
	"github.com/divkix/Alita_Robot/alita/db/warns"
	chatsettings "github.com/divkix/Alita_Robot/alita/settings"
	"github.com/divkix/Alita_Robot/alita/utils/punishment"
	log "github.com/sirupsen/logrus"
)

type issueWarningRequest struct {
	UserID int64  `json:"user_id"`
	Reason string `json:"reason"`
}

type issueWarningResponse struct {
	Added       bool   `json:"added"`
	UserID      int64  `json:"user_id"`
	Warnings    int    `json:"warnings"`
	WarnLimit   int    `json:"warn_limit"`
	LimitAction string `json:"limit_action,omitempty"`
	Message     string `json:"message"`
}

// handleIssueWarning follows the same persistence and warn-limit punishment
// path as the /warn command. The Mini App never sends command text.
func (p *Panel) handleIssueWarning(w http.ResponseWriter, r *http.Request) {
	session, access, ok := p.chatRequest(w, r)
	if !ok {
		return
	}
	if !p.requirePermission(w, r, access, session.User.ID, permRestrict|permBotRestrict) {
		return
	}

	var request issueWarningRequest
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&request); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid_body", "body must contain user_id and optional reason")
		return
	}
	request.Reason = strings.TrimSpace(request.Reason)
	if request.UserID <= 0 || request.UserID == session.User.ID || request.UserID == p.bot.Id {
		writeJSONError(w, http.StatusBadRequest, "invalid_user_id", "choose a valid group member other than yourself or the bot")
		return
	}
	if len([]rune(request.Reason)) > maxActionReasonRunes {
		writeJSONError(w, http.StatusBadRequest, "reason_too_long", "reason must be 3000 characters or fewer")
		return
	}

	member, err := p.bot.GetChatMemberWithContext(r.Context(), access.ChatID, request.UserID, nil)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, "target_lookup_failed", "Telegram could not verify this member")
		return
	}
	role, isMember := memberRole(member)
	if !isMember {
		writeJSONError(w, http.StatusNotFound, "target_not_member", "target must be a current group member")
		return
	}
	if role == RoleAdmin {
		writeJSONError(w, http.StatusForbidden, "protected_admin", "group admins and owners cannot be warned")
		return
	}

	count, _, err := warns.WarnUser(request.UserID, access.ChatID, models.WarnEntry{
		WarnedBy: session.User.ID,
		Reason: request.Reason,
	})
	if err != nil {
		log.WithError(err).WithFields(log.Fields{"chat_id": access.ChatID, "actor_id": session.User.ID, "target_user_id": request.UserID}).Error("[Panel] Failed to add warning")
		writeJSONError(w, http.StatusInternalServerError, "warning_failed", "could not save this warning")
		return
	}

	preferences := chatsettings.ReadWarnsContext(r.Context(), access.ChatID)
	response := issueWarningResponse{
		Added: true, UserID: request.UserID, Warnings: count, WarnLimit: preferences.WarnLimit,
		Message: "Warning added.",
	}
	if count >= preferences.WarnLimit {
		mode, timed := chatsettings.PunishmentMode(preferences.WarnMode)
		if mode != "" {
			punishRequest := punishment.Request{
				ChatID: access.ChatID, Target: punishment.Target{ID: request.UserID},
				Mode: mode, Source: models.BanSourceWarn, Reason: request.Reason,
				ActorID: session.User.ID,
			}
			if timed {
				punishRequest.Duration = time.Duration(preferences.WarnActionTime) * time.Second
			}
			result, applyErr := punishment.Apply(r.Context(), p.bot, punishRequest)
			if applyErr != nil {
				log.WithError(applyErr).WithFields(log.Fields{"chat_id": access.ChatID, "target_user_id": request.UserID, "warn_mode": preferences.WarnMode}).Error("[Panel] Warn-limit action failed")
				writeJSONError(w, http.StatusBadGateway, "warn_limit_action_failed", "warning was saved, but the configured limit action failed")
				return
			}
			if result.Applied {
				if _, resetErr := warns.ResetUserWarns(request.UserID, access.ChatID); resetErr != nil {
					log.WithError(resetErr).Error("[Panel] Warn-limit action succeeded but warnings could not be reset")
					writeJSONError(w, http.StatusInternalServerError, "warn_reset_failed", "limit action succeeded, but warning reset failed; contact the bot owner")
					return
				}
				response.LimitAction = preferences.WarnMode
				response.Message = "Warning added; configured limit action applied and warnings reset."
			} else {
				response.Message = "Warning added; configured limit action was not applied: " + result.Refusal
			}
		}
	}
	writeJSON(w, http.StatusOK, response)
}
