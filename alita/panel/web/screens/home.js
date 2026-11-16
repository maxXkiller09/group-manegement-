import { api } from "../api.js";
import { clear, loading, showError, textElement } from "../ui.js";

const ADD_GROUP_URL = "https://t.me/NexGuardd_Bot?startgroup=true";

function linkCard(title, description, href, symbol, external = false) {
  const link = document.createElement("a");
  link.className = "home-tile";
  link.href = href;
  if (external) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  const icon = textElement("span", symbol, "home-tile-icon");
  icon.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  copy.className = "nav-text";
  copy.append(
    textElement("strong", title, "nav-title"),
    textElement("span", description, "nav-subtitle"),
  );
  link.append(icon, copy, textElement("span", "›", "chevron"));
  return link;
}

function renderDashboard(root, session) {
  clear(root);
  const user = session?.user ?? {};
  const chats = Array.isArray(session?.chats) ? session.chats : [];
  const firstName = typeof user.first_name === "string" && user.first_name.trim()
    ? user.first_name.trim()
    : "there";

  const intro = document.createElement("section");
  intro.className = "home-intro";
  intro.append(
    textElement("span", "🛡️", "home-shield"),
    textElement("p", "NEXGUARD · SMART PROTECTION", "home-eyebrow"),
    textElement("h2", `Welcome, ${firstName}`, "home-heading"),
    textElement("p", "Smart Protection. Better Communities.", "home-welcome"),
  );

  const summary = document.createElement("section");
  summary.className = "callout home-summary";
  summary.setAttribute("aria-label", "Connected groups");
  summary.append(
    textElement("span", "YOUR WORKSPACE", "guide-eyebrow"),
    textElement("strong", String(chats.length), "home-summary-count"),
    textElement("span", chats.length === 1 ? "connected group" : "connected groups", "home-summary-label"),
  );

  const actions = document.createElement("section");
  actions.className = "home-grid";
  actions.setAttribute("aria-label", "NexGuard navigation");
  actions.append(
    linkCard("My Groups", "Open group dashboards and settings", "#/groups", "▦"),
    linkCard("Inbox", "View activity across your groups", "#/activity", "▤"),
    linkCard("Account", "View your verified Telegram profile", "#/account", "◉"),
    linkCard("Add to Telegram", "Connect NexGuard to another group", ADD_GROUP_URL, "＋", true),
  );

  root.append(intro, summary, actions);
}

export async function renderHome(root, mode = "home") {
  clear(root);
  root.append(loading(mode === "account" ? "Loading your Telegram account…" : "Loading your NexGuard workspace…"));

  let session;
  try {
    session = await api("session", { method: "POST" });
  } catch (error) {
    showError(root, error, () => void renderHome(root, mode));
    return;
  }

  if (mode === "account") {
    const user = session?.user ?? {};
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Telegram user";
    clear(root);
    root.append(
      textElement("h2", "Your account", "home-heading"),
      textElement("p", "This profile comes from your verified Telegram account.", "home-welcome"),
    );
    const card = document.createElement("section");
    card.className = "callout account-profile";
    card.append(
      textElement("span", "TELEGRAM PROFILE", "guide-eyebrow"),
      textElement("h3", name, "account-name"),
    );
    if (user.username) card.append(textElement("p", `@${user.username}`, "account-detail"));
    if (user.id != null) card.append(textElement("p", `Telegram ID: ${user.id}`, "account-detail"));
    if (user.language_code) card.append(textElement("p", `Language: ${user.language_code}`, "account-detail"));
    const chats = Array.isArray(session?.chats) ? session.chats : [];
    card.append(textElement("p", `${chats.length} connected group(s)`, "account-detail"));
    root.append(
      card,
      textElement("p", "Group permissions are checked by the server whenever you open or change a group setting.", "section-footer"),
      linkCard("My Groups", "Open your connected groups", "#/groups", "▦"),
    );
    return;
  }

  if (mode === "activity") {
    clear(root);
    root.append(
      textElement("h2", "Group updates", "home-heading"),
      textElement("p", "Choose a group to see its recent activity and insights.", "home-welcome"),
    );
    const chats = Array.isArray(session?.chats) ? session.chats : [];
    if (chats.length === 0) {
      root.append(
        textElement("p", "Your connected groups will appear here after NexGuard is added to a group.", "empty"),
        linkCard("Connect a group", "Add NexGuard to a Telegram group", ADD_GROUP_URL, "＋", true),
      );
      return;
    }
    const list = document.createElement("section");
    list.className = "home-grid inbox-groups";
    for (const chat of chats) {
      const title = chat.title || "Telegram group";
      list.append(linkCard(title, "Open this group's activity and insights", `#/chats/${encodeURIComponent(chat.id)}/activity`, "▦"));
    }
    root.append(list);
    return;
  }

  renderDashboard(root, session);
}
