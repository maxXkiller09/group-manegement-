import { api } from "../api.js?v=2026.11.16-bootfix1";
import { clear, loading, showError, textElement } from "../ui.js?v=2026.11.16-bootfix1";

function tile(title, description, href, symbol) {
  const link = document.createElement("a");
  link.className = "home-tile";
  link.href = href;
  const icon = document.createElement("span");
  icon.className = "home-tile-icon";
  icon.setAttribute("aria-hidden", "true");
  if (symbol === "shield") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("class", "home-shield-icon");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z");
    svg.append(path);
    icon.append(svg);
  } else {
    icon.textContent = symbol;
  }
  const copy = document.createElement("span");
  copy.className = "nav-text";
  copy.append(textElement("strong", title, "nav-title"), textElement("span", description, "nav-subtitle"));
  link.append(icon, copy, textElement("span", "›", "chevron"));
  return link;
}

function groupLink(chat, label, description, section = "activity") {
  return tile(chat.title || "Telegram group", description, `#/chats/${encodeURIComponent(chat.id)}/${section}`, "▦");
}

async function loadSession(root, retry) {
  clear(root);
  root.append(loading("Loading your Telegram account…"));
  try { return await api("session", { method: "POST" }); }
  catch (error) { showError(root, error, retry); return null; }
}

export async function renderHome(root, mode = "home") {
  clear(root);
  if (mode === "account") {
    const data = await loadSession(root, () => void renderHome(root, mode));
    if (!data) return;
    clear(root);
    const user = data.user || {};
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Telegram user";
    root.append(textElement("h2", "Your account", "home-heading"), textElement("p", "This profile comes from your verified Telegram account.", "home-welcome"));
    const card = document.createElement("section");
    card.className = "callout account-profile";
    card.append(textElement("span", "TELEGRAM PROFILE", "guide-eyebrow"), textElement("h3", name, "account-name"));
    if (user.username) card.append(textElement("p", `@${user.username}`, "account-detail"));
    card.append(textElement("p", `Telegram ID: ${user.id}`, "account-detail"));
    if (user.language_code) card.append(textElement("p", `Language: ${user.language_code}`, "account-detail"));
    card.append(textElement("p", `${(data.chats || []).length} connected group(s)`, "account-detail"));
    root.append(card, textElement("p", "Your group permissions are checked again whenever you open or change a group setting.", "section-footer"), tile("My Groups", "Open your connected groups", "#/groups", "▦"));
    return;
  }
  if (mode === "activity") {
    const data = await loadSession(root, () => void renderHome(root, mode));
    if (!data) return;
    clear(root);
    root.append(textElement("h2", "Group updates", "home-heading"), textElement("p", "Choose a group to see its recent activity and insights.", "home-welcome"));
    const chats = Array.isArray(data.chats) ? data.chats : [];
    if (!chats.length) {
      root.append(textElement("p", "Your connected groups will appear here after you add NexGuard to a group.", "empty"), tile("Connect a group", "Follow the simple setup steps", "#/groups", "＋"));
      return;
    }
    const list = document.createElement("section");
    list.className = "home-grid inbox-groups";
    for (const chat of chats) list.append(groupLink(chat, "Activity & Analytics", "Open this group's updates and insights"));
    root.append(list);
    return;
  }

  const intro = document.createElement("section");
  intro.className = "home-intro";
  intro.append(textElement("span", "🛡️", "home-shield"), textElement("h2", "Welcome to NexGuard", "home-heading"), textElement("p", "Manage and protect your Telegram groups in a few simple steps.", "home-welcome"), tile("My Groups", "Start here to connect and manage a group", "#/groups", "▦"));
  root.append(intro, tile("Protection Setup", "Choose a group and review a protection preset", "#/groups/protection-setup", "shield"), textElement("p", "Start with My Groups. Choose a group to see simple, step-by-step controls.", "section-footer"));
}
