import { clear, textElement } from "../ui.js";

function tile(title, description, href, symbol, className = "") {
  const link = document.createElement("a");
  link.className = `home-tile ${className}`.trim();
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
    root.append(textElement("p", "Your NexGuard account and access", "home-welcome"), textElement("h2", "Account", "home-heading"), tile("My Groups", "Manage the groups you administer", "#/groups", "▦"), textElement("p", "Your access is verified by Telegram for every group action.", "section-footer"));
    return;
  }
  if (mode === "activity") {
    root.append(textElement("p", "Your recent group activity", "home-welcome"), textElement("h2", "Inbox", "home-heading"), tile("Activity & Analytics", "Choose a group to view its activity and insights", "#/groups/activity", "▤"));
    return;
  }
  const top = document.createElement("div");
  top.className = "home-topline";
  top.append(textElement("span", "NEXGUARD", "home-eyebrow"), textElement("span", "● SMART PROTECTION", "home-live-status"));
  root.append(top, textElement("h2", "Your communities.\nUnder control.", "home-heading"), textElement("p", "Smart Protection. Better Communities.", "home-welcome"));
  const hero = document.createElement("section");
  hero.className = "home-hero";
  hero.append(textElement("span", "🛡️", "home-shield"), textElement("h3", "Protect what you build", "home-hero-title"), textElement("p", "Manage security, members and conversations from one simple dashboard.", "home-hero-copy"), tile("Open My Groups", "View your connected communities", "#/groups", "▦", "home-primary-tile"));
  root.append(hero, textElement("h3", "MANAGE YOUR WORKSPACE", "home-section-label"));
  const grid = document.createElement("section");
  grid.className = "home-grid";
  grid.setAttribute("aria-label", "NexGuard tools");
  grid.append(tile("Security", "Protection & filters", "#/groups/settings", "◈"), tile("Moderation", "Warnings & actions", "#/groups/warnings", "⚑"), tile("Content Tools", "Filters & blacklists", "#/groups/filters", "▤"), tile("Analytics", "Activity & insights", "#/groups/activity", "▥"), tile("Commands", "Guides & quick actions", "#/groups/commands", "⌘"));
  root.append(grid);
  const footer = document.createElement("section");
  footer.className = "home-quick-actions";
  footer.append(textElement("strong", "Need a quick start?", "home-quick-title"), textElement("span", "Add NexGuard to a group and open its dashboard to configure protection.", "home-quick-copy"), tile("Add to Telegram Group", "Start protecting a community", "https://t.me/NexGuardd_Bot?startgroup=true", "＋", "home-add-tile"));
  root.append(footer);
}
