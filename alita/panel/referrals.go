package panel

import (
	"net/http"

	log "github.com/sirupsen/logrus"

	"github.com/divkix/Alita_Robot/alita/db/referrals"
)

type referralLinkItem struct {
	InviteLink string `json:"invite_link"`
	InviterID  int64  `json:"inviter_id"`
	Joined     int64  `json:"joined"`
}

type referralLeaderItem struct {
	InviterID int64 `json:"inviter_id"`
	Joined    int64 `json:"joined"`
}

type referralDashboardResponse struct {
	Links       []referralLinkItem   `json:"links"`
	Leaderboard []referralLeaderItem `json:"leaderboard"`
	Total      int64                `json:"total"`
}

// handleReferrals exposes tracked invite performance to verified chat admins.
// Raw invite URLs and inviter IDs are private group-management data, so
// ordinary members receive the same admin-only boundary as /referral.
func (p *Panel) handleReferrals(w http.ResponseWriter, r *http.Request) {
	_, access, ok := p.chatRequest(w, r)
	if !ok || !requireAdmin(w, access) {
		return
	}

	rows, err := referrals.ListLinkStats(access.ChatID)
	if err != nil {
		log.WithError(err).Error("[Panel] Failed to read tracked invite links")
		writeJSONError(w, http.StatusInternalServerError, "referrals_failed", "could not read this chat's referral stats")
		return
	}
	leaders, err := referrals.ListLeaderboard(access.ChatID)
	if err != nil {
		log.WithError(err).Error("[Panel] Failed to read referral leaderboard")
		writeJSONError(w, http.StatusInternalServerError, "referrals_failed", "could not read this chat's referral leaderboard")
		return
	}

	response := referralDashboardResponse{
		Links: make([]referralLinkItem, 0, len(rows)),
		Leaderboard: make([]referralLeaderItem, 0, len(leaders)),
	}
	for _, row := range rows {
		response.Links = append(response.Links, referralLinkItem{
			InviteLink: row.InviteLink,
			InviterID: row.InviterID,
			Joined: row.Joined,
		})
		response.Total += row.Joined
	}
	for _, row := range leaders {
		response.Leaderboard = append(response.Leaderboard, referralLeaderItem{
			InviterID: row.InviterID,
			Joined: row.Joined,
		})
	}
	writeJSON(w, http.StatusOK, response)
}
