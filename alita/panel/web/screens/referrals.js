// Referral dashboard: admin-only tracked invite performance.
import { api } from "../api.js";
import { clear, loading, showError, textElement } from "../ui.js";

function section(title, rows, emptyText, renderRow) {
	const wrapper = document.createElement("section");
	wrapper.className = "overview-recent";
	wrapper.append(textElement("h3", title));
	if (!rows.length) {
		wrapper.append(textElement("p", emptyText, "empty"));
		return wrapper;
	}
	const list = document.createElement("ul");
	list.className = "event-list";
	for (const row of rows) {
		const item = document.createElement("li");
		item.className = "event-row";
		renderRow(item, row);
		list.append(item);
	}
	wrapper.append(list);
	return wrapper;
}

function draw(root, data) {
	const summary = document.createElement("ul");
	summary.className = "overview-summary";
	const total = document.createElement("li");
	total.append(textElement("span", "Attributed members", "summary-label"));
	total.append(textElement("strong", String(Number.isFinite(data.total) ? data.total : 0)));
	summary.append(total);
	root.append(summary);

	root.append(section("Tracked invite links", Array.isArray(data.links) ? data.links : [], "No tracked invite joins yet. Create links with /referral create in the group.", (item, row) => {
		const anchor = document.createElement("a");
		anchor.href = String(row.invite_link ?? "");
		anchor.target = "_blank";
		anchor.rel = "noopener noreferrer";
		anchor.textContent = "Open invite link";
		item.append(anchor, textElement("span", `Inviter ${row.inviter_id} · ${row.joined} unique joins`, "event-parties"));
	}));

	root.append(section("Top inviters", Array.isArray(data.leaderboard) ? data.leaderboard : [], "No attributed inviters yet.", (item, row) => {
		item.append(
			textElement("strong", `User ${row.inviter_id}`),
			textElement("span", `${row.joined} unique joins`, "event-parties"),
		);
	}));
	root.append(textElement("p", "Only joins through invite links created and tracked by this bot are counted. Repeat joins are counted once per member per group.", "section-footer"));
}

export async function renderReferrals(root, chatID) {
	clear(root);
	root.append(loading("Loading referral stats…"));
	try {
		const data = await api(`chats/${encodeURIComponent(chatID)}/referrals`);
		clear(root);
		draw(root, data);
	} catch (error) {
		showError(root, error, () => void renderReferrals(root, chatID));
	}
}
