import { api } from "../api.js?v=2026.11.16-bootfix1";
import { sections } from "../sections.js?v=2026.11.17-backstack1";
import { backLink, clear, haptic, loading, setHeader, showError, textElement } from "../ui.js?v=2026.11.16-bootfix1";

const SVG_NS = "http://www.w3.org/2000/svg";

const ICONS = {
  shield: [["path", { d: "M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" }]],
  moderation: [["path", { d: "M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z" }], ["path", { d: "m9 12 2 2 4-4" }]],
  blacklist: [["circle", { cx: "12", cy: "12", r: "8.5" }], ["path", { d: "m6 6 12 12" }]],
  history: [["circle", { cx: "12", cy: "12", r: "8.5" }], ["path", { d: "M12 7v5l3 2" }]],
  members: [["path", { d: "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20" }], ["circle", { cx: "10", cy: "8", r: "3.5" }], ["path", { d: "M17 4.8a3.5 3.5 0 0 1 0 6.5M17 15h.5a3.5 3.5 0 0 1 3.5 3.5V20" }]],
  filters: [["path", { d: "M4 5h16l-6.2 7.1v5.2l-3.6 1.8v-7L4 5Z" }]],
  notes: [["path", { d: "M6 3.5h8l4 4V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V3.5Z" }], ["path", { d: "M14 3.5V8h4M9 12h6M9 16h6" }]],
  overview: [["path", { d: "M4 19.5h16M5.5 16V9m6.5 7V4.5m6.5 11.5v-5" }]],
  activity: [["path", { d: "M3.5 12h3l2-5 4 10 2.5-6 1.5 3h4" }]],
  referrals: [["circle", { cx: "9", cy: "8", r: "3" }], ["path", { d: "M3.5 20v-1.2A4.8 4.8 0 0 1 8.3 14h1.4a4.8 4.8 0 0 1 4.8 4.8V20M17 8h4m-2-2v4M17 14.5a4 4 0 0 1 3.5 4V20" }]],
  commands: [["path", { d: "m8 7-4 5 4 5M16 7l4 5-4 5M14 5l-4 14" }]],
};

const TOOL_ITEMS = {
  protect: [
    { key: "blacklists", title: "Blacklists", description: "Blocked words & actions", tone: "rose", icon: "blacklist" },
  ],
  manage: [
    { key: "timeline", title: "Moderation History", description: "Recent admin actions", tone: "amber", icon: "history" },
    { key: "members", title: "Top Members", description: "Most active members", tone: "gold", icon: "members" },
    { key: "filters", title: "Filters", description: "Keyword replies", tone: "green", icon: "filters" },
    { key: "notes", title: "Notes", description: "Saved group notes", tone: "teal", icon: "notes" },
  ],
  insights: [
    { key: "overview", title: "Group Overview", description: "Group health & stats", tone: "blue", icon: "overview" },
    { key: "activity", title: "Activity & Analytics", description: "Growth & busy times", tone: "purple", icon: "activity" },
    { key: "referrals", title: "Referrals", description: "Invite tracking", tone: "pink", icon: "referrals" },
  ],
};

function appendSvgPart(svg, [tag, attributes]) {
  const part = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) part.setAttribute(name, value);
  svg.append(part);
}

function iconNode(name, className = "ng-tool-icon-svg") {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const part of ICONS[name] || ICONS.overview) appendSvgPart(svg, part);
  return svg;
}

function iconTile(name, tone) {
  const tile = document.createElement("span");
  tile.className = `ng-tool-icon tone-${tone}`;
  tile.append(iconNode(name));
  tile.setAttribute("aria-hidden", "true");
  return tile;
}

function toolLink(chatID, item) {
  const link = document.createElement("a");
  link.className = "ng-tool-card";
  link.href = `#/chats/${encodeURIComponent(chatID)}/${item.key}`;
  link.append(iconTile(item.icon, item.tone));
  const copy = document.createElement("span");
  copy.className = "ng-tool-copy";
  copy.append(
    textElement("strong", item.title, "ng-tool-title"),
    textElement("span", item.description, "ng-tool-description"),
  );
  link.append(copy);
  link.addEventListener("click", () => haptic("light"));
  return link;
}

function featuredLink(chatID, item) {
  const link = document.createElement("a");
  link.className = `ng-feature-card tone-${item.tone}`;
  link.href = `#/chats/${encodeURIComponent(chatID)}/${item.key}`;
  link.append(iconTile(item.icon, item.tone));
  const copy = document.createElement("span");
  copy.className = "ng-feature-copy";
  copy.append(
    textElement("strong", item.title, "ng-feature-title"),
    textElement("span", item.description, "ng-feature-description"),
  );
  link.append(copy);
  link.addEventListener("click", () => haptic("light"));
  return link;
}

function statusHeader(chat) {
  const status = document.createElement("section");
  status.className = "ng-group-status";
  status.setAttribute("aria-label", "Group access status");
  const chips = document.createElement("div");
  chips.className = "ng-status-chips";

  const userAdmin = chat.role === "admin";
  const botAdmin = Boolean(chat.bot_admin);
  const userChip = textElement("span", userAdmin ? "You: Admin ✓" : "You: View only", userAdmin ? "ng-status-chip ok" : "ng-status-chip warn");
  const botChip = textElement("span", botAdmin ? "Bot: Admin ✓" : "Bot: Needs admin", botAdmin ? "ng-status-chip ok" : "ng-status-chip warn");
  chips.append(userChip, botChip);
  status.append(chips);

  if (!userAdmin) {
    status.append(textElement("p", "Ask a group admin to give you admin access if you need to change settings.", "ng-fix-line warn"));
  } else if (!botAdmin) {
    status.append(textElement("p", "To turn protection on, make NexGuard an admin in Telegram. Open your group → tap its name → Edit → Administrators → Add Admin → choose NexGuard.", "ng-fix-line warn"));
  } else {
    status.append(textElement("p", "You’re ready. Choose what you want to manage below.", "ng-fix-line"));
  }
  return status;
}

function dashboardSkeleton() {
  const skeleton = document.createElement("div");
  skeleton.className = "ng-dashboard-skeleton";
  for (const width of ["wide", "half", "half", "wide"]) {
    const block = document.createElement("span");
    block.className = `ng-skeleton-block ${width}`;
    skeleton.append(block);
  }
  skeleton.setAttribute("role", "status");
  skeleton.setAttribute("aria-label", "Loading group dashboard");
  return skeleton;
}

async function loadChat(root, chatID, retry, dashboard = false) {
  clear(root);
  root.append(dashboard ? dashboardSkeleton() : loading("Loading your group…"));
  try { return await api(`chats/${encodeURIComponent(chatID)}`); }
  catch (error) { showError(root, error, retry); return null; }
}

function chatTitle(chat) { return chat.title || "Your Telegram group"; }

export async function renderSection(root, chatID, key) {
  const section = sections.find((entry) => entry.key === key);
  if (!section) return renderChat(root, chatID);
  setHeader(section.label);
  const chat = await loadChat(root, chatID, () => renderSection(root, chatID, key));
  if (!chat) return;
  clear(root);
  setHeader(section.label, chatTitle(chat));
  const back = backLink(`#/chats/${encodeURIComponent(chatID)}`, "Back to group");
  if (back) root.append(back);
  const content = document.createElement("div");
  content.className = "section-content";
  root.append(content);
  if (section.adminOnly && chat.role !== "admin") {
    content.append(textElement("p", "This page is for group admins. Ask an admin to give you admin access.", "callout warn"));
    return;
  }
  await section.render(content, chatID, chat);
}

export async function renderChat(root, chatID) {
  const chat = await loadChat(root, chatID, () => renderChat(root, chatID), true);
  if (!chat) return;
  clear(root);
  setHeader(chatTitle(chat), "YOUR GROUP");

  const back = backLink("#/groups", "All groups");
  if (back) root.append(back);
  root.append(statusHeader(chat));

  const availableKeys = new Set(
    sections.filter((section) => !section.adminOnly || chat.role === "admin").map((section) => section.key),
  );

  const featured = document.createElement("div");
  featured.className = "ng-feature-grid";
  const security = sections.find((section) => section.key === "settings");
  const moderation = sections.find((section) => section.key === "warnings");
  if (security) {
    featured.append(featuredLink(chatID, {
      key: "protection-setup",
      title: "Protection Setup",
      description: "Choose a preset with preview and undo",
      icon: "shield",
      tone: "blue",
    }));
    featured.append(featuredLink(chatID, {
      key: security.key,
      title: "Security Center",
      description: "Protection settings",
      icon: "shield",
      tone: "blue",
    }));
  }
  if (moderation && availableKeys.has("warnings")) {
    featured.append(featuredLink(chatID, {
      key: moderation.key,
      title: "Moderation",
      description: "Manage members",
      icon: "moderation",
      tone: "orange",
    }));
  }
  root.append(featured);

  const groups = [
    { label: "PROTECT", items: TOOL_ITEMS.protect },
    { label: "MANAGE", items: TOOL_ITEMS.manage },
    { label: "INSIGHTS", items: TOOL_ITEMS.insights },
  ];

  for (const group of groups) {
    const items = group.items.filter((item) => availableKeys.has(item.key));
    if (!items.length) continue;
    const block = document.createElement("section");
    block.className = "ng-tool-section";
    block.append(textElement("h2", group.label, "ng-tool-section-label"));
    const grid = document.createElement("div");
    grid.className = "ng-tool-grid";
    for (const item of items) grid.append(toolLink(chatID, item));
    block.append(grid);
    root.append(block);
  }

  const commands = sections.find((section) => section.key === "commands");
  if (commands) {
    const link = document.createElement("a");
    link.className = "ng-commands-card";
    link.href = `#/chats/${encodeURIComponent(chatID)}/commands`;
    link.append(iconTile("commands", "cyan"));
    const copy = document.createElement("span");
    copy.className = "ng-commands-copy";
    copy.append(
      textElement("strong", "All Commands", "ng-commands-title"),
      textElement("span", "Simple guide for every command", "ng-commands-description"),
    );
    link.append(copy);
    link.addEventListener("click", () => haptic("light"));
    root.append(link);
  }
}
