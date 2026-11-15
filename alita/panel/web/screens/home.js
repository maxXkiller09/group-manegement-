import { clear, textElement } from "../ui.js";

function tile(title, description, href, symbol) {
  const link = document.createElement("a");
  link.className = "home-tile";
  link.href = href;
  const icon = textElement("span", symbol, "home-tile-icon");
  icon.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  copy.className = "nav-text";
  copy.append(textElement("strong", title, "nav-title"), textElement("span", description, "nav-subtitle"));
  link.append(icon, copy, textElement("span", "›", "chevron"));
  return link;
}

export function renderHome(root, mode = "home") {
  clear(root);
  if (mode === "account") {
    root.append(textElement("h2", "Account", "home-heading"), textElement("p", "Your profile and access settings.", "home-welcome"), tile("My Groups", "Manage your Telegram groups", "#/groups", "▦"));
    return;
  }
  if (mode === "activity") {
    root.append(textElement("h2", "Inbox", "home-heading"), textElement("p", "Updates and recent group activity.", "home-welcome"), tile("Activity & Analytics", "View group activity and insights", "#/groups/activity", "▤"));
    return;
  }

  const intro = document.createElement("section");
  intro.className = "home-intro";
  intro.append(textElement("span", "🛡️", "home-shield"), textElement("h2", "Welcome to NexGuard", "home-heading"), textElement("p", "Manage and protect your Telegram groups in a few simple steps.", "home-welcome"), tile("My Groups", "Start here to connect and manage a group", "#/groups", "▦"));
  root.append(intro, textElement("h3", "What would you like to do?", "home-section-label"));

  const grid = document.createElement("section");
  grid.className = "home-grid";
  grid.setAttribute("aria-label", "NexGuard tools");
  grid.append(
    tile("Security", "Keep your group safe", "#/groups/settings", "◈"),
    tile("Moderation", "Manage member issues", "#/groups/warnings", "⚑"),
    tile("Content Tools", "Filters and blocked words", "#/groups/filters", "▤"),
    tile("Activity", "See group activity", "#/groups/activity", "▥"),
    tile("All Commands", "Simple step-by-step guide", "#/groups/commands", "⌘"),
  );
  root.append(grid, textElement("p", "You can come back here anytime. Your group settings stay in your dashboard.", "section-footer"));
}
