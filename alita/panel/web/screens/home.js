import { clear, textElement } from "../ui.js";

function tile(title, description, href, symbol) {
  const link = document.createElement("a");
  link.className = "home-tile";
  link.href = href;
  link.append(textElement("span", symbol, "home-tile-icon"));
  const copy = document.createElement("span");
  copy.className = "nav-text";
  copy.append(textElement("strong", title, "nav-title"), textElement("span", description, "nav-subtitle"));
  link.append(copy, textElement("span", "›", "chevron"));
  return link;
}

export function renderHome(root, mode = "home") {
  clear(root);
  const title = mode === "account" ? "Account" : mode === "activity" ? "Inbox" : "NexGuard";
  const subtitle = mode === "home" ? "Smart Protection. Better Communities." : mode === "account" ? "Your NexGuard account and access" : "Your recent group activity";
  root.append(textElement("p", subtitle, "home-welcome"), textElement("h2", title, "home-heading"));

  if (mode === "account") {
    root.append(tile("My Groups", "Manage the groups you administer", "#/groups", "▦"));
    root.append(textElement("p", "Your access is verified by Telegram for every group action.", "section-footer"));
    return;
  }
  if (mode === "activity") {
    root.append(tile("Activity & Analytics", "Choose a group to view its activity", "#/groups/activity", "▤"));
    return;
  }

  const hero = document.createElement("section");
  hero.className = "home-hero";
  hero.append(
    textElement("span", "🛡️", "home-shield"),
    textElement("h3", "Protect your community", "home-hero-title"),
    textElement("p", "Simple tools to keep your Telegram groups safe, organised and welcoming.", "home-hero-copy"),
  );
  root.append(hero);

  const grid = document.createElement("section");
  grid.className = "home-grid";
  grid.append(
    tile("My Groups", "Open group dashboards", "#/groups", "▦"),
    tile("Security Center", "Protection settings and filters", "#/groups/settings", "◈"),
    tile("Moderation", "Warnings and member moderation", "#/groups/warnings", "⚑"),
    tile("Content Tools", "Filters, blacklists and notes", "#/groups/filters", "▤"),
    tile("Activity & Analytics", "Group activity and insights", "#/groups/activity", "▥"),
    tile("All Commands", "Hinglish guide and available actions", "#/groups/commands", "⌘"),
    tile("Account", "Your profile and access", "#/account", "◉"),
  );
  root.append(grid);
}
