// Overview: the chat's Telegram member count, a daily messages/joins/leaves
// chart for a 7, 30 or 90 day window, and the most recent moderation actions.
// Server data reaches the DOM only through textContent and SVG attributes, so
// a chat title or an action value can never become markup.
import { api } from "../api.js";
import { clear, haptic, loading, relativeTime, showError, textElement, userLabel } from "../ui.js";

const WINDOWS = [7, 30, 90];
const SVG_NS = "http://www.w3.org/2000/svg";

const SERIES = [
	{ key: "messages", label: "Messages", className: "series-messages" },
	{ key: "joins", label: "Joins", className: "series-joins" },
	{ key: "leaves", label: "Leaves", className: "series-leaves" },
];

// number renders a server count. A missing or non-finite value becomes 0 so a
// partial response shows an empty chart instead of NaN.
function number(value) {
	return Number.isFinite(value) ? String(value) : "0";
}

function count(point, key) {
	const value = point?.[key];
	return Number.isFinite(value) ? value : 0;
}

function svgNode(tag, attributes) {
	const node = document.createElementNS(SVG_NS, tag);
	for (const [name, value] of Object.entries(attributes)) {
		node.setAttribute(name, String(value));
	}
	return node;
}

// activityChart draws one line per counter over the zero-filled series: no
// chart library, no innerHTML, and the scale starts at a real zero baseline.
function activityChart(series) {
	// Sized near a phone's CSS width so the 11px labels stay legible.
	const width = 360;
	const height = 170;
	const left = 36;
	const right = 12;
	const top = 16;
	const bottom = 28;
	const plotWidth = width - left - right;
	const plotHeight = height - top - bottom;

	const chart = svgNode("svg", {
		viewBox: `0 0 ${width} ${height}`,
		class: "activity-chart",
		role: "img",
		"aria-label": "Messages, joins and leaves per day",
	});

	const peak = Math.max(1, ...series.map((point) => Math.max(count(point, "messages"), count(point, "joins"), count(point, "leaves"))));
	const x = (index) => left + (series.length > 1 ? (index / (series.length - 1)) * plotWidth : plotWidth / 2);
	const y = (value) => top + plotHeight - (value / peak) * plotHeight;

	chart.append(
		svgNode("line", {
			x1: left,
			y1: top + plotHeight,
			x2: width - right,
			y2: top + plotHeight,
			class: "chart-axis",
		}),
	);

	chart.append(
		svgNode("line", { x1: left, y1: y(peak), x2: width - right, y2: y(peak), class: "chart-grid" }),
		svgNode("line", { x1: left, y1: y(peak / 2), x2: width - right, y2: y(peak / 2), class: "chart-grid" }),
	);

	const peakLabel = svgNode("text", { x: 4, y: top + 4, class: "chart-label" });
	peakLabel.textContent = number(peak);
	chart.append(peakLabel);

	for (const counter of SERIES) {
		const points = series
			.map((point, index) => `${x(index).toFixed(1)},${y(count(point, counter.key)).toFixed(1)}`)
			.join(" ");
		chart.append(svgNode("polyline", { points, class: `series ${counter.className}` }));
	}

	const firstLabel = svgNode("text", { x: left, y: height - 8, class: "chart-label" });
	firstLabel.textContent = series[0]?.day ?? "";
	chart.append(firstLabel);

	const lastLabel = svgNode("text", {
		x: width - right,
		y: height - 8,
		class: "chart-label",
		"text-anchor": "end",
	});
	lastLabel.textContent = series[series.length - 1]?.day ?? "";
	chart.append(lastLabel);

	return chart;
}

function chartLegend() {
	const legend = document.createElement("ul");
	legend.className = "chart-legend";
	for (const counter of SERIES) {
		const item = document.createElement("li");
		const swatch = document.createElement("span");
		swatch.className = `swatch ${counter.className}`;
		item.append(swatch, document.createTextNode(counter.label));
		legend.append(item);
	}
	return legend;
}

function iconTile(symbol, tone = "blue") {
	const icon = textElement("span", symbol, \`ng-icon-tile tone-\${tone}\`);
	icon.setAttribute("aria-hidden", "true");
	return icon;
}

function miniStat(label, value, symbol, tone) {
	const item = document.createElement("div");
	item.className = "ng-mini-stat";
	item.append(iconTile(symbol, tone));
	const copy = document.createElement("span");
	copy.className = "ng-stat-copy";
	copy.append(textElement("span", label, "ng-stat-label"), textElement("strong", number(value), "ng-stat-value"));
	item.append(copy);
	return item;
}

function statCard(label, value, description, symbol, tone) {
	const card = document.createElement("article");
	card.className = "ng-stat-card";
	card.append(iconTile(symbol, tone));
	const copy = document.createElement("div");
	copy.className = "ng-stat-card-copy";
	copy.append(
		textElement("span", label, "ng-stat-label"),
		textElement("strong", number(value), "ng-stat-value"),
		textElement("span", description, "ng-stat-description"),
	);
	card.append(copy);
	return card;
}

function heroCard(chat) {
	const hero = document.createElement("section");
	hero.className = "ng-screen-hero";
	const eyebrow = textElement("span", "GROUP OVERVIEW", "ng-eyebrow");
	const title = textElement("h2", chat.title || "Your Telegram group", "ng-hero-title");
	const subtitle = textElement("p", "Your community health, member activity and recent actions", "ng-hero-subtitle");
	const meta = document.createElement("div");
	meta.className = "ng-hero-meta";
	meta.append(
		textElement("span", chat.role === "admin" ? "Admin access" : "View-only access", "ng-hero-chip"),
		textElement("span", chat.bot_admin ? "NexGuard active" : "Bot admin needed", chat.bot_admin ? "ng-hero-chip ok" : "ng-hero-chip warn"),
	);
	hero.append(eyebrow, title, subtitle, meta);
	return hero;
}

function overviewLinks(chatID) {
	const list = document.createElement("section");
	list.className = "ng-grouped-links";
	list.append(textElement("h3", "MANAGE YOUR GROUP", "ng-section-label"));
	const items = [
		["settings", "◈", "Security Center", "Configure protection and group safety", "blue"],
		["warnings", "⚑", "Moderation", "Review warnings and member actions", "orange"],
		["filters", "⌕", "Content Tools", "Manage filters, blocked words and notes", "green"],
		["commands", "⌘", "All Commands", "Browse available bot commands", "purple"],
	];
	for (const [section, symbol, title, subtitle, tone] of items) {
		const link = document.createElement("a");
		link.className = "ng-grouped-row";
		link.href = \`#/chats/\${encodeURIComponent(chatID)}/\${section}\`;
		link.append(iconTile(symbol, tone));
		const copy = document.createElement("span");
		copy.className = "ng-grouped-copy";
		copy.append(textElement("strong", title, "ng-grouped-title"), textElement("span", subtitle, "ng-grouped-subtitle"));
		link.append(copy, textElement("span", "›", "ng-row-chevron"));
		list.append(link);
	}
	return list;
}

function formatTime(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value == null ? "" : String(value);
	}
	return date.toLocaleString();
}

// recentSection lists action, actor, target and time. The API also carries a
// reason; the overview deliberately shows only the four fields the screen
// promises, and no message text exists to show.
function recentSection(events, names, moderationCount) {
	const section = document.createElement("section");
	section.className = "overview-recent";
	section.append(textElement("h3", "Recent moderation"));
	if (events.length === 0) {
		const message = Number(moderationCount) > 0
			? "Moderation details are available to chat admins."
			: "No moderation actions recorded yet.";
		section.append(textElement("p", message, "empty"));
		return section;
	}

	const list = document.createElement("ul");
	list.className = "event-list";
	for (const event of events) {
		const item = document.createElement("li");
		item.className = `event-row action-${event.action}`;
		const time = textElement("time", relativeTime(event.created_at) || formatTime(event.created_at), "event-time");
		time.dateTime = String(event.created_at ?? "");
		time.title = formatTime(event.created_at);
		item.append(
			textElement("span", String(event.action ?? ""), "badge"),
			textElement("span", `${partyLabel(names, event.actor_id)} → ${partyLabel(names, event.target_user_id)}`, "event-parties"),
			time,
		);
		list.append(item);
	}
	section.append(list);
	return section;
}

// partyLabel names an actor or target. Names reach admins only; a member sees
// IDs, and a non-positive actor is the bot's own automated action.
function partyLabel(names, id) {
	if (!(Number(id) > 0)) {
		return "automatic";
	}
	return userLabel(names, id);
}

function collectionNote() {
	const details = document.createElement("details");
	details.className = "collection-note";
	details.append(textElement("summary", "How this is collected"));
	details.append(
		textElement(
			"p",
			"Message, join and leave counts are kept in memory by the bot and written to the database once a minute, so a restart can lose up to a minute of counts. The member count comes from Telegram and is refreshed at most once a minute. Moderation history is taken from the actions the bot recorded; message text is never stored.",
		),
	);
	return details;
}

function drawOverview(root, data, chat, days, chatID, onWindowChange) {
	const series = Array.isArray(data.days) ? data.days : [];
	const totals = data.totals ?? {};
	const recent = Array.isArray(data.recent) ? data.recent : [];
	const messageTotal = Number(totals.messages) || 0;
	const joinsTotal = Number(totals.joins) || 0;
	const leavesTotal = Number(totals.leaves) || 0;

	root.append(heroCard(chat));

	const mini = document.createElement("div");
	mini.className = "ng-mini-stats";
	mini.append(
		miniStat("Members", data.member_count, "♙", "blue"),
		miniStat("Moderation", data.moderation_count, "⚑", "orange"),
		miniStat("Activity window", days, "◷", "purple"),
	);
	root.append(mini);

	const stats = document.createElement("section");
	stats.className = "ng-stat-grid";
	stats.append(
		statCard("Messages", messageTotal, "Recorded in this period", "▤", "blue"),
		statCard("New joins", joinsTotal, "Members who joined", "＋", "green"),
		statCard("Members left", leavesTotal, "Members who left", "↗", "orange"),
		statCard("Moderation actions", data.moderation_count, "Actions recorded", "⚑", "purple"),
	);
	root.append(stats);

	const controls = document.createElement("div");
	controls.className = "window-switch";
	controls.setAttribute("role", "group");
	controls.setAttribute("aria-label", "Activity window");
	root.append(controls);
	for (const value of WINDOWS) {
		const button = textElement("button", \`\${value} days\`);
		button.type = "button";
		button.classList.toggle("active", value === days);
		button.setAttribute("aria-pressed", String(value === days));
		button.addEventListener("click", () => {
			if (value !== days) {
				haptic("selection");
				onWindowChange(value);
			}
		});
		controls.append(button);
	}

	const hasActivity = series.some(
		(point) => count(point, "messages") > 0 || count(point, "joins") > 0 || count(point, "leaves") > 0,
	);
	if (hasActivity) {
		const card = document.createElement("div");
		card.className = "chart-card";
		card.append(textElement("h3", "ACTIVITY TREND", "ng-section-label"), activityChart(series), chartLegend());
		root.append(card);
	} else {
		root.append(textElement("p", "No messages, joins or leaves have been recorded in this window yet.", "empty"));
	}

	root.append(overviewLinks(chatID));
	root.append(recentSection(recent, data.names, data.moderation_count), collectionNote());
}

export async function renderOverview(root, chatID, chat = {}) {
	clear(root);

	let days = WINDOWS[0];
	let request = 0;

	async function load() {
		const current = ++request;
		clear(root);
		root.append(loading("Loading group overview…"));
		let data;
		try {
			data = await api(\`chats/\${encodeURIComponent(chatID)}/overview?days=\${days}\`);
		} catch (error) {
			if (current === request) showError(root, error, () => void load());
			return;
		}
		if (current !== request) return;
		clear(root);
		drawOverview(root, data, chat, days, chatID, (next) => { days = next; void load(); });
	}
	await load();
}
