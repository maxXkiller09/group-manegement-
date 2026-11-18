import { api } from "../api.js?v=2026.11.16-bootfix1";
import { clear, errorMessage, haptic, initials, loading, onLeave, relativeTime, setHeader, showError, textElement } from "../ui.js?v=2026.11.16-bootfix1";

const ADD_GROUP_URL = "https://t.me/NexGuardd_Bot?startgroup=true";
const SVG_NS = "http://www.w3.org/2000/svg";

function groupIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M4 19.5h16M5.5 16V9m6.5 7V4.5m6.5 11.5v-5");
  svg.append(path);
  return svg;
}

function addGroupButton(label = "Add NexGuard to a group", onAddGroup = () => {}) {
  const button = textElement("a", label, "primary group-add-button");
  button.href = ADD_GROUP_URL;
  button.setAttribute("aria-label", "Open Telegram and add NexGuard to your group");
  button.addEventListener("click", onAddGroup);
  return button;
}

function groupRefreshGuide(onRefresh, statusText, refreshing) {
  const guide = document.createElement("section");
  guide.className = "first-use-guide group-refresh-guide";
  guide.setAttribute("aria-labelledby", "group-refresh-title");
  guide.append(Object.assign(textElement("h2", "Group dikh nahi raha?", "guide-title"), { id: "group-refresh-title" }));
  const steps = document.createElement("ol");
  steps.className = "setup-steps";
  for (const [number, line] of [
    ["1", "NexGuard ko group admin banao"],
    ["2", "Group me ek message ya /start bhejo"],
    ["3", "Neeche Refresh dabao"],
  ]) {
    const item = document.createElement("li");
    const copy = document.createElement("span");
    copy.className = "setup-step-copy";
    copy.append(textElement("span", line));
    item.append(textElement("span", number, "setup-step-number"), copy);
    steps.append(item);
  }
  const refresh = textElement("button", refreshing ? "Refreshing…" : "Refresh", "group-add-button");
  refresh.type = "button";
  refresh.disabled = refreshing;
  refresh.setAttribute("aria-label", "Refresh group list");
  refresh.addEventListener("click", onRefresh);
  refresh.dataset.groupRefresh = "true";
  const status = textElement("p", statusText, "guide-footnote");
  status.setAttribute("role", "status");
  status.dataset.groupRefreshStatus = "true";
  guide.append(steps, refresh, status);
  return guide;
}

function firstUseGuide(onAddGroup) {
  const guide = document.createElement("section");
  guide.className = "first-use-guide";
  guide.setAttribute("aria-labelledby", "first-use-title");
  guide.append(
    textElement("span", "LET'S GET STARTED", "guide-eyebrow"),
    Object.assign(textElement("h2", "Set up your first group", "guide-title"), { id: "first-use-title" }),
    textElement("p", "You only need to do this once. Follow these three easy steps.", "guide-copy"),
  );
  const steps = document.createElement("ol");
  steps.className = "setup-steps";
  for (const [number, title, description] of [
    ["1", "Add NexGuard", "Tap the button below and choose your Telegram group."],
    ["2", "Give admin access", "Allow the permissions NexGuard needs to protect the group."],
    ["3", "Open your dashboard", "Return here and tap Refresh to update the group list."],
  ]) {
    const item = document.createElement("li");
    item.append(
      textElement("span", number, "setup-step-number"),
      Object.assign(document.createElement("span"), { className: "setup-step-copy" }),
    );
    const copy = item.lastElementChild;
    copy.append(textElement("strong", title), textElement("span", description));
    steps.append(item);
  }
  guide.append(steps, addGroupButton("Add NexGuard to a group", onAddGroup), textElement("p", "Not sure what to allow? Choose the recommended permissions shown by Telegram.", "guide-footnote"));
  return guide;
}

function groupRow(chat, pinned, targetSection) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "nav-row group-card ng-group-row";
  link.href = targetSection ? `#/chats/${encodeURIComponent(chat.id)}/${targetSection}` : `#/chats/${encodeURIComponent(chat.id)}`;
  const title = chat.title || "Telegram group";
  const avatar = document.createElement("span");
  avatar.className = "ng-tool-icon tone-blue";
  avatar.append(groupIcon());
  avatar.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  copy.className = "nav-text";
  copy.append(textElement("strong", title, "ng-group-title"));
  const subtitle = pinned ? "Opened from this group" : chat.last_activity ? `Active ${relativeTime(chat.last_activity)}` : "Open group dashboard";
  copy.append(textElement("span", subtitle, "ng-group-description"));
  if (chat.role) {
    const roleLabel = chat.role === "admin" ? "Admin" : "Member";
    copy.append(textElement("span", roleLabel, "ng-group-role-chip" + (chat.role === "admin" ? " is-admin" : "")));
  }
  link.append(avatar, copy, textElement("span", "›", "chevron"));
  link.addEventListener("click", () => haptic("light"));
  item.append(link);
  return item;
}

export async function renderChats(root, targetSection = "") {
  setHeader("My Groups", "Choose a group to manage");
  let disposed = false;
  let pendingAddGroupReturn = false;
  let hiddenAfterAddGroup = false;
  let requestID = 0;
  let refreshing = false;
  let refreshMessage = "";

  function markAddGroupClick() {
    pendingAddGroupReturn = true;
    hiddenAfterAddGroup = false;
  }

  async function loadGroups(isRefresh = false) {
    const currentRequest = ++requestID;
    refreshing = isRefresh;
    refreshMessage = isRefresh ? "Refreshing groups…" : "";
    if (isRefresh) {
      updateRefreshGuide();
    } else {
      clear(root);
      root.append(loading("Finding your groups…"));
    }

    try {
      const data = await api("session", { method: "POST" });
      if (disposed || currentRequest !== requestID) return;
      refreshing = false;
      refreshMessage = isRefresh ? "Groups refreshed." : "";
      renderGroups(data);
    } catch (error) {
      if (disposed || currentRequest !== requestID) return;
      refreshing = false;
      refreshMessage = isRefresh ? errorMessage(error, "Could not refresh groups.") : "";
      if (isRefresh) updateRefreshGuide();
      else showError(root, error, () => void loadGroups(false));
    }
  }

  function updateRefreshGuide() {
    const button = root.querySelector("[data-group-refresh]");
    const status = root.querySelector("[data-group-refresh-status]");
    if (button) {
      button.disabled = refreshing;
      button.textContent = refreshing ? "Refreshing…" : "Refresh";
    }
    if (status) status.textContent = refreshMessage;
  }

  function renderGroups(data) {
    clear(root);
    if (data.user?.first_name) setHeader("My Groups", `Hello, ${data.user.first_name}`);
    const chats = Array.isArray(data.chats) ? data.chats : [];
    if (chats.length === 0) {
      root.append(firstUseGuide(markAddGroupClick));
    } else {
      const pinnedID = data.pinned_chat_id == null ? null : String(data.pinned_chat_id);
      const ordered = [...chats].sort((left, right) => Number(String(right.id) === pinnedID) - Number(String(left.id) === pinnedID));
      const intro = document.createElement("div");
      intro.className = "groups-intro";
      intro.append(
        textElement("h2", "Your groups", "groups-heading"),
        textElement("p", "Tap any group to open its controls.", "groups-hint"),
        addGroupButton("＋ Add another group", markAddGroupClick),
      );
      const search = document.createElement("input");
      search.type = "search";
      search.className = "group-search";
      search.placeholder = "Search your groups";
      search.setAttribute("aria-label", "Search your Telegram groups");
      search.autocomplete = "off";
      const list = document.createElement("ul");
      list.className = "group-list ng-groups-list";
      const empty = textElement("p", "No group matches that name.", "empty search-empty");
      empty.hidden = true;
      const rows = ordered.map((chat) => {
        const row = groupRow(chat, String(chat.id) === pinnedID, targetSection);
        list.append(row);
        return { row, title: String(chat.title || "").toLocaleLowerCase() };
      });
      search.addEventListener("input", () => {
        const query = search.value.trim().toLocaleLowerCase();
        let visible = 0;
        for (const item of rows) {
          const show = item.title.includes(query);
          item.row.hidden = !show;
          if (show) visible++;
        }
        empty.hidden = visible !== 0;
      });
      root.append(intro, search, list, empty);
    }
    root.append(groupRefreshGuide(() => void loadGroups(true), refreshMessage, refreshing));
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (pendingAddGroupReturn) hiddenAfterAddGroup = true;
      return;
    }
    if (pendingAddGroupReturn && hiddenAfterAddGroup) {
      pendingAddGroupReturn = false;
      hiddenAfterAddGroup = false;
      void loadGroups(true);
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  onLeave(() => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisibilityChange);
  });

  await loadGroups(false);
}
