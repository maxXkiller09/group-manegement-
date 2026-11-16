import { api } from "../api.js?v=2026.11.16-bootfix1";
import { sections } from "../sections.js?v=2026.11.16-bootfix1";
import { backLink, clear, loading, setHeader, showError, textElement } from "../ui.js?v=2026.11.16-bootfix1";

async function loadChat(root, chatID, retry) {
  clear(root);
  root.append(loading("Loading your group…"));
  try { return await api(`chats/${encodeURIComponent(chatID)}`); }
  catch (error) { showError(root, error, retry); return null; }
}

function chatTitle(chat) { return chat.title || "Your Telegram group"; }

function accessCard(chat) {
  const card = document.createElement("section");
  card.className = "callout group-access-card";
  const heading = textElement("h2", "Group access", "section-header");
  const role = chat.role === "admin" ? "You are a group admin" : "You have view-only access";
  const bot = chat.bot_admin ? "NexGuard has admin access" : "NexGuard needs admin access";
  card.append(heading, textElement("p", role, "access-line"));
  const status = textElement("p", bot, chat.bot_admin ? "access-ok" : "access-warn");
  card.append(status);
  if (chat.role !== "admin") {
    card.append(textElement("p", "Ask a group admin to give you admin access if you need to change settings.", "setting-hint"));
  } else if (!chat.bot_admin) {
    card.append(
      textElement("p", "To turn protection on, make NexGuard an admin in Telegram. Open your group → tap its name → Edit → Administrators → Add Admin → choose NexGuard.", "access-help"),
      textElement("p", "Only allow the permissions needed for the features you want to use. You can change them later in Telegram.", "setting-hint"),
    );
  } else {
    card.append(textElement("p", "You’re ready. Choose what you want to manage below.", "setting-hint"));
  }
  return card;
}

const groups = [
  { title: "Start here", hint: "Your group at a glance", keys: ["overview"] },
  { title: "Keep your group safe", hint: "Protection and security settings", keys: ["settings"] },
  { title: "Manage members", hint: "Warnings, moderation and member activity", keys: ["warnings", "timeline", "members"] },
  { title: "Manage content", hint: "Filters, blocked words and saved notes", keys: ["filters", "blacklists", "notes"] },
  { title: "Understand activity", hint: "Growth, busy times and invitations", keys: ["activity", "referrals"] },
  { title: "Help and commands", hint: "Learn what NexGuard can do", keys: ["commands"] },
];

function sectionLink(chatID, section) {
  const link = document.createElement("a");
  link.className = "nav-row group-tool-link";
  link.href = `#/chats/${encodeURIComponent(chatID)}/${section.key}`;
  const copy = document.createElement("span");
  copy.className = "nav-text";
  copy.append(textElement("strong", section.label, "nav-title"));
  if (section.description) copy.append(textElement("span", section.description, "nav-subtitle"));
  link.append(copy, textElement("span", "›", "chevron"));
  return link;
}

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
  setHeader("Group dashboard");
  const chat = await loadChat(root, chatID, () => renderChat(root, chatID));
  if (!chat) return;
  clear(root);
  setHeader(chatTitle(chat), "Your group dashboard");
  const back = backLink("#/groups", "All groups");
  if (back) root.append(back);
  root.append(accessCard(chat));

  const available = sections.filter((section) => !section.adminOnly || chat.role === "admin");
  for (const group of groups) {
    const items = available.filter((section) => group.keys.includes(section.key));
    if (!items.length) continue;
    const block = document.createElement("section");
    block.className = "group-tool-section";
    block.append(textElement("h2", group.title, "group-tool-heading"));
    block.append(textElement("p", group.hint, "group-tool-hint"));
    const list = document.createElement("div");
    list.className = "group-tool-list";
    for (const section of items) list.append(sectionLink(chatID, section));
    block.append(list);
    root.append(block);
  }
}
