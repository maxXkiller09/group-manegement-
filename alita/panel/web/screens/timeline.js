// Moderation timeline: newest first, keyset cursor pages appended on scroll or
// with "Load more" so the reading position never moves, and filters by action
// and actor. It carries actions only, never message text.
import { api } from "../api.js?v=2026.11.16-bootfix1";
import { relativeTime, textElement, userLabel } from "../ui.js?v=2026.11.16-bootfix1";

const PAGE_SIZE = 50;
const ACTION_FILTERS = [
	{ value: "", label: "All", icon: "◉" },
	{ value: "ban", label: "Ban", icon: "⛔" },
	{ value: "kick", label: "Kick", icon: "↗" },
	{ value: "mute", label: "Mute", icon: "🔇" },
	{ value: "unban", label: "Unban", icon: "✓" },
];

function formatTime(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export async function renderTimeline(root, chatID, chat) {
	const container = document.createElement("div");
	container.className = "timeline-screen";
	root.append(container);

	const form = document.createElement("form");
	form.className = "timeline-filters";
	const actionFilters = document.createElement("div");
	actionFilters.className = "timeline-action-filters";
	actionFilters.setAttribute("role", "group");
	actionFilters.setAttribute("aria-label", "Filter by moderation action");
	const actionButtons = new Map();

	const state = { cursor: "", action: "", actor: "", loading: false, done: false, reloadAfterLoad: false };

	for (const filter of ACTION_FILTERS) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "timeline-filter-chip";
		button.dataset.action = filter.value;
		button.setAttribute("aria-pressed", String(filter.value === ""));
		if (filter.value === "") button.classList.add("active");
		const icon = textElement("span", filter.icon, "timeline-chip-icon");
		icon.setAttribute("aria-hidden", "true");
		button.append(icon, document.createTextNode(filter.label));
		button.addEventListener("click", () => {
			state.action = filter.value;
			for (const [value, chip] of actionButtons) {
				const selected = value === filter.value;
				chip.classList.toggle("active", selected);
				chip.setAttribute("aria-pressed", String(selected));
			}
			loadPage(true);
		});
		actionButtons.set(filter.value, button);
		actionFilters.append(button);
	}

	const actorInput = document.createElement("input");
	actorInput.type = "text";
	actorInput.autocomplete = "off";
	actorInput.placeholder = "Admin ID";
	actorInput.setAttribute("aria-label", "Filter by numeric admin ID");
	const actorHint = textElement("span", "Abhi sirf numeric Admin ID se filter hota hai. @username support PR B mein aayega.", "timeline-filter-hint");
	const filterFields = document.createElement("div");
	filterFields.className = "timeline-admin-filter";
	filterFields.append(actorInput, actorHint);
	form.append(actionFilters, filterFields);

	const status = textElement("p", "", "status");
	const list = document.createElement("ol");
	list.className = "timeline";
	const loadMore = textElement("button", "Load more");
	loadMore.type = "button";
	loadMore.hidden = true;
	container.append(form, status, list, loadMore);

	function actionLabel(action) {
		const match = ACTION_FILTERS.find((filter) => filter.value === action);
		return match ? match.label : "Action";
	}

	function eventRow(event, names) {
		const item = document.createElement("li");
		item.className = "timeline-event action-" + event.action;
		const head = document.createElement("div");
		head.className = "timeline-head";
		head.append(
			textElement("span", actionLabel(event.action), "badge timeline-action-badge action-" + event.action),
			textElement("span", event.actor_id <= 0 ? "automatic" : userLabel(names, event.actor_id), "list-name"),
			textElement("span", "→ " + userLabel(names, event.target_user_id), "list-name"),
		);
		item.append(head);
		if (event.reason) item.append(textElement("p", event.reason, "timeline-reason muted"));
		const time = textElement("time", relativeTime(event.created_at) || formatTime(event.created_at), "muted");
		time.dateTime = event.created_at;
		time.title = formatTime(event.created_at);
		item.append(time);
		return item;
	}

	function emptyRow(action) {
		const item = document.createElement("li");
		item.className = "timeline-empty";
		const badge = textElement("span", action ? actionLabel(action) : "All actions", "badge timeline-action-badge");
		if (action) badge.classList.add("action-" + action);
		item.append(badge, textElement("p", "No moderation events found for this filter.", "timeline-empty-copy"));
		return item;
	}

	async function loadPage(reset) {
		if (state.loading) {
			if (reset) state.reloadAfterLoad = true;
			return;
		}
		state.loading = true;
		if (reset) {
			state.cursor = "";
			state.done = false;
			list.replaceChildren();
		}
		status.className = "status loading";
		status.textContent = "Loading…";
		try {
			const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
			if (state.action) params.set("action", state.action);
			if (state.actor) params.set("actor", state.actor);
			if (!reset && state.cursor) params.set("cursor", state.cursor);
			const data = await api("chats/" + encodeURIComponent(chatID) + "/timeline?" + params, { method: "GET" });
			for (const event of data.events ?? []) list.append(eventRow(event, data.names));
			state.cursor = data.next_cursor ?? "";
			state.done = !state.cursor;
			loadMore.hidden = state.done;
			if (list.childElementCount === 0) list.append(emptyRow(state.action));
			status.textContent = list.querySelectorAll(".timeline-event").length + " shown";
		} catch (error) {
			status.className = "error";
			status.textContent = error?.message ?? "Could not load the timeline.";
		} finally {
			state.loading = false;
			if (state.reloadAfterLoad) {
				state.reloadAfterLoad = false;
				loadPage(true);
			}
		}
	}

	form.addEventListener("submit", (event) => {
		event.preventDefault();
		const actor = actorInput.value.trim();
		if (actor && !actor.split("").every((character) => character >= "0" && character <= "9")) {
			status.className = "error";
			status.textContent = "Abhi sirf numeric Admin ID chalta hai. @username support PR B mein aayega.";
			return;
		}
		state.actor = actor;
		loadPage(true);
	});
	loadMore.addEventListener("click", () => loadPage(false));
	const observer = new IntersectionObserver((entries) => {
		if (entries.some((entry) => entry.isIntersecting) && !state.done && !state.loading) loadPage(false);
	});
	observer.observe(loadMore);
	await loadPage(true);
}
