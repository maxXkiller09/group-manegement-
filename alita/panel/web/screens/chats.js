import { api } from "../api.js?v=2026.11.16-bootfix1";
import { classifyGroupAccess, singleEligibleGroup, GROUP_ACCESS_CACHE_MS } from "../group-access.mjs?v=2026.11.18-groups1";
import { clear, errorMessage, haptic, initials, loading, onLeave, relativeTime, setHeader, showError, textElement } from "../ui.js?v=2026.11.16-bootfix1";

const ADD_GROUP_URL = "https://t.me/NexGuardd_Bot?startgroup=true";
const SVG_NS = "http://www.w3.org/2000/svg";
const groupAccessCache = new Map();

function cachedGroupAccess(chatID) {
  const entry = groupAccessCache.get(String(chatID));
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    groupAccessCache.delete(String(chatID));
    return null;
  }
  return entry.access;
}

function cacheGroupAccess(chatID, access) {
  if (access.status === "unknown" || access.status === "checking") return;
  groupAccessCache.set(String(chatID), {
    access,
    expiresAt: Date.now() + GROUP_ACCESS_CACHE_MS,
  });
}

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
  const limit = textElement("p", "Session mein latest 50 active groups tak hi dikhte hain. Group list mein nahi hai to group mein message ya /start bhejkar Refresh karo.", "guide-footnote");
  const status = textElement("p", statusText, "guide-footnote");
  status.setAttribute("role", "status");
  status.dataset.groupRefreshStatus = "true";
  guide.append(steps, refresh, limit, status);
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

function groupRow(chat, pinned, targetSection, access) {
  const item = document.createElement("li");
  item.dataset.chatId = String(chat.id);
  const selectable = access.selectable === true;
  const link = document.createElement(selectable ? "a" : "div");
  link.className = "nav-row group-card ng-group-row";
  if (selectable) {
    link.href = targetSection
      ? "#/chats/" + encodeURIComponent(chat.id) + "/" + targetSection
      : "#/chats/" + encodeURIComponent(chat.id);
  } else {
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("aria-busy", String(access.status === "checking"));
  }

  const title = chat.title || "Telegram group";
  const avatar = document.createElement("span");
  avatar.className = "ng-tool-icon tone-blue";
  avatar.append(groupIcon());
  avatar.setAttribute("aria-hidden", "true");
  const copy = document.createElement("span");
  copy.className = "nav-text";
  copy.append(textElement("strong", title, "ng-group-title"));
  const subtitle = pinned ? "Opened from this group" : chat.last_activity ? "Active " + relativeTime(chat.last_activity) : "Open group dashboard";
  copy.append(textElement("span", subtitle, "ng-group-description"));
  copy.append(textElement("span", access.label, "ng-status-chip " + (selectable ? "ok" : "warn")));
  if (access.hint) {
    copy.append(textElement("span", access.hint, "ng-group-description"));
  }
  link.append(avatar, copy);
  if (selectable) {
    link.append(textElement("span", "›", "chevron"));
    link.addEventListener("click", () => haptic("light"));
  }
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
  let accessObserver = null;
  let fallbackScrollHandler = null;

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
    const listRequestID = requestID;
    accessObserver?.disconnect();
    accessObserver = null;
    if (fallbackScrollHandler) window.removeEventListener("scroll", fallbackScrollHandler);
    fallbackScrollHandler = null;
    clear(root);
    if (data.user?.first_name) setHeader("My Groups", "Hello, " + data.user.first_name);
    const chats = Array.isArray(data.chats) ? data.chats.slice(0, 50) : [];
    if (chats.length === 0) {
      root.append(firstUseGuide(markAddGroupClick));
    } else {
      const pinnedID = data.pinned_chat_id == null ? null : String(data.pinned_chat_id);
      const ordered = [...chats].sort((left, right) => Number(String(right.id) === pinnedID) - Number(String(left.id) === pinnedID));
      const intro = document.createElement("div");
      intro.className = "groups-intro";
      intro.append(
        textElement("h2", "Your groups", "groups-heading"),
        textElement("p", "Sirf verified admin + bot-admin groups open ho sakte hain.", "groups-hint"),
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
      const entries = ordered.map(chat => {
        const access = cachedGroupAccess(chat.id) || { status: "checking", label: "Checking", selectable: false };
        const entry = { chat, access, verified: access.status !== "checking", verifying: false, row: null };
        entry.row = groupRow(chat, String(chat.id) === pinnedID, targetSection, access);
        list.append(entry.row);
        return entry;
      });
      const byID = new Map(entries.map(entry => [String(entry.chat.id), entry]));
      let searchQuery = "";
      let autoNavigated = false;

      function applySearch(entry) {
        entry.row.hidden = !String(entry.chat.title || "").toLocaleLowerCase().includes(searchQuery);
      }

      function updateEntry(entry) {
        const next = groupRow(entry.chat, String(entry.chat.id) === pinnedID, targetSection, entry.access);
        entry.row.replaceWith(next);
        entry.row = next;
        applySearch(entry);
      }

      function maybeAutoSelect() {
        if (autoNavigated || disposed || listRequestID !== requestID) return;
        if (!/^#\/groups(?:\/[a-z-]+)?$/.test(window.location.hash)) return;
        const eligibleID = singleEligibleGroup(entries);
        if (!eligibleID) return;
        autoNavigated = true;
        window.location.hash = targetSection
          ? "#/chats/" + encodeURIComponent(eligibleID) + "/" + targetSection
          : "#/chats/" + encodeURIComponent(eligibleID);
      }

      async function verifyEntry(entry) {
        if (entry.verified || entry.verifying || disposed || listRequestID !== requestID) return;
        const cached = cachedGroupAccess(entry.chat.id);
        if (cached) {
          entry.access = cached;
          entry.verified = true;
          updateEntry(entry);
          maybeAutoSelect();
          return;
        }
        entry.verifying = true;
        entry.access = { status: "checking", label: "Checking", selectable: false };
        updateEntry(entry);
        let access;
        try {
          let details = await api("chats/" + encodeURIComponent(entry.chat.id));
          if (details.role === "admin") {
            try {
              const settings = await api("chats/" + encodeURIComponent(entry.chat.id) + "/settings");
              const rights = settings.rights;
              const rightsKnown = rights !== null && rights !== undefined && typeof rights === "object";
              details = {
                ...details,
                bot_rights_known: rightsKnown,
                rights_known: rightsKnown,
                can_restrict_members: rightsKnown && rights.can_restrict_members === true,
                bot_can_restrict_members: rightsKnown && rights.bot_can_restrict_members === true,
              };
            } catch (error) {
              details = { ...details, bot_rights_known: false, rights_known: false };
            }
          }
          access = classifyGroupAccess(details);
        } catch (error) {
          access = classifyGroupAccess(null);
        }
        if (disposed || listRequestID !== requestID) return;
        entry.verifying = false;
        entry.verified = true;
        entry.access = access;
        cacheGroupAccess(entry.chat.id, access);
        updateEntry(entry);
        maybeAutoSelect();
      }

      search.addEventListener("input", () => {
        searchQuery = search.value.trim().toLocaleLowerCase();
        let visible = 0;
        for (const entry of entries) {
          applySearch(entry);
          if (!entry.row.hidden) visible++;
        }
        empty.hidden = visible !== 0;
      });
      root.append(intro, search, list, empty);

      if (chats.length === 1) {
        void verifyEntry(entries[0]);
      } else if (typeof IntersectionObserver === "function") {
        accessObserver = new IntersectionObserver(observed => {
          for (const item of observed) {
            if (!item.isIntersecting) continue;
            const entry = byID.get(item.target.dataset.chatId);
            accessObserver?.unobserve(item.target);
            if (entry) void verifyEntry(entry);
          }
        }, { rootMargin: "160px 0px" });
        for (const entry of entries) {
          if (!entry.verified) accessObserver.observe(entry.row);
        }
      } else {
        fallbackScrollHandler = () => {
          for (const entry of entries) {
            if (entry.verified || entry.verifying) continue;
            const bounds = entry.row.getBoundingClientRect();
            if (bounds.top < window.innerHeight + 160 && bounds.bottom > -160) {
              void verifyEntry(entry);
            }
          }
        };
        window.addEventListener("scroll", fallbackScrollHandler, { passive: true });
        fallbackScrollHandler();
      }
      maybeAutoSelect();
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
    accessObserver?.disconnect();
    accessObserver = null;
    if (fallbackScrollHandler) window.removeEventListener("scroll", fallbackScrollHandler);
    fallbackScrollHandler = null;
  });

  await loadGroups(false);
}
