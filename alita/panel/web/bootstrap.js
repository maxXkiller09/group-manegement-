import { telegram } from "./api.js?v=2026.11.16-bootfix1";
import { renderChat, renderSection } from "./screens/chat.js?v=2026.11.16-dashboard1";
import { renderChats } from "./screens/chats.js?v=2026.11.16-dashboard1";
import { renderHome } from "./screens/home.js?v=2026.11.16-bootfix1";
import { blocksLeave, confirmDestructive, haptic, leaveScreen, setLeaveGuard, supports } from "./ui.js?v=2026.11.16-bootfix1";

telegram?.ready();
telegram?.expand();
const root = document.getElementById("app");

function launchChatID() {
  const query = new URLSearchParams(window.location.search).get("chat");
  const start = /^chat_(-?\d+)$/.exec(telegram?.initDataUnsafe?.start_param ?? "")?.[1];
  const value = query || start || "";
  return /^-?\d+$/.test(value) && value !== "0" ? value : null;
}

const routePattern = /^#\/chats\/(-?\d+)(?:\/([a-z-]+))?$/;

function parentRoute(hash) {
  const match = routePattern.exec(hash);
  if (!match) return null;
  return match[2] ? `#/chats/${match[1]}` : "#/groups";
}

function syncBackButton() {
  if (!supports("6.1")) return;
  if (parentRoute(location.hash)) telegram.BackButton.show();
  else telegram.BackButton.hide();
}

function closeQuickActions() {
  document.getElementById("ng-quick-backdrop")?.remove();
  document.removeEventListener("keydown", onQuickKeydown);
}

function onQuickKeydown(event) {
  if (event.key === "Escape") closeQuickActions();
}

const NAV_ICON_PATHS = {
  home: ["M3.5 10.5 12 3.5l8.5 7M5.5 9.5v10h13v-10M9.5 19.5v-6h5v6"],
  security: ["M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"],
  moderation: ["M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z", "m9 12 2 2 4-4"],
  more: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
  plus: ["M12 5v14M5 12h14"],
  overview: ["M4 19.5h16M5.5 16V9m6.5 7V4.5m6.5 11.5v-5"],
  activity: ["M3.5 12h3l2-5 4 10 2.5-6 1.5 3h4"],
  filters: ["M4 5h16l-6.2 7.1v5.2l-3.6 1.8v-7L4 5Z"],
  commands: ["m8 7-4 5 4 5M16 7l4 5-4 5M14 5l-4 14"],
  account: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21a8 8 0 0 1 16 0"],
  groups: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"],
};

function inlineIcon(name, className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const pathData of NAV_ICON_PATHS[name] || NAV_ICON_PATHS.more) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    svg.append(path);
  }
  return svg;
}

function quickAction(href, icon, label) {
  const link = document.createElement("a");
  link.className = "ng-sheet-action";
  link.href = href;
  const symbol = document.createElement("span");
  symbol.className = "ng-sheet-icon";
  symbol.append(inlineIcon(icon, "ng-sheet-icon-svg"));
  const title = document.createElement("span");
  title.className = "ng-sheet-label";
  title.textContent = label;
  link.append(symbol, title);
  link.addEventListener("click", closeQuickActions);
  return link;
}

function selectedChatID() {
  return routePattern.exec(location.hash)?.[1] ?? null;
}

function destination(section) {
  const chatID = selectedChatID();
  return chatID
    ? `#/chats/${encodeURIComponent(chatID)}/${section}`
    : `#/groups/${section}`;
}

function openActionSheet(titleText, actions) {
  closeQuickActions();
  const backdrop = document.createElement("div");
  backdrop.id = "ng-quick-backdrop";
  backdrop.className = "ng-quick-backdrop";
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeQuickActions();
  });

  const sheet = document.createElement("section");
  sheet.className = "ng-quick-sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-labelledby", "ng-sheet-title");

  const grabber = document.createElement("div");
  grabber.className = "ng-sheet-grabber";
  grabber.setAttribute("aria-hidden", "true");

  const head = document.createElement("div");
  head.className = "ng-sheet-head";
  const title = document.createElement("h2");
  title.id = "ng-sheet-title";
  title.className = "ng-sheet-title";
  title.textContent = titleText;
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ng-sheet-close";
  close.setAttribute("aria-label", "Close menu");
  close.textContent = "×";
  close.addEventListener("click", closeQuickActions);
  head.append(title, close);

  const grid = document.createElement("div");
  grid.className = "ng-sheet-grid";
  for (const [href, icon, label] of actions) {
    grid.append(quickAction(href, icon, label));
  }
  sheet.append(grabber, head, grid);
  backdrop.append(sheet);
  document.body.append(backdrop);
  document.addEventListener("keydown", onQuickKeydown);
  close.focus();
}

function openQuickActions() {
  const chatID = selectedChatID();
  const actions = [
    ["https://t.me/NexGuardd_Bot?startgroup=true", "plus", "Add NexGuard to a group"],
    ["#/groups", "groups", "My Groups"],
  ];
  if (chatID) {
    const chat = encodeURIComponent(chatID);
    actions.push(
      [`#/chats/${chat}/overview`, "overview", "Group Overview"],
      [`#/chats/${chat}/settings`, "security", "Security Center"],
      [`#/chats/${chat}/warnings`, "moderation", "Moderation"],
    );
  } else {
    actions.push(
      ["#/groups/overview", "overview", "Group Overview"],
      ["#/groups/settings", "security", "Security Center"],
      ["#/groups/warnings", "moderation", "Moderation"],
    );
  }
  openActionSheet("Quick actions", actions);
}

function openMoreMenu() {
  openActionSheet("More", [
    [selectedChatID() ? destination("activity") : "#/activity", "activity", "Activity & Analytics"],
    [destination("filters"), "filters", "Content Tools"],
    [destination("commands"), "commands", "All Commands"],
    ["#/account", "account", "Account"],
  ]);
}

function renderNavigation() {
  document.getElementById("nexguard-nav")?.remove();
  const nav = document.createElement("nav");
  nav.id = "nexguard-nav";
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Main navigation");

  const hash = location.hash;
  const route = routePattern.exec(hash);
  const section = route?.[2] ?? "";
  const groupTarget = /^#\/groups\/([a-z-]+)$/.exec(hash)?.[1] ?? "";
  const moreDestinations = [
    "overview", "activity", "filters", "blacklists", "notes", "commands",
    "timeline", "members", "referrals",
  ];
  const isMoreDestination = hash === "#/account" || hash === "#/activity" ||
    moreDestinations.includes(section) || moreDestinations.includes(groupTarget);
  const active = section === "settings" || groupTarget === "settings" ? "security"
    : section === "warnings" || groupTarget === "warnings" ? "moderation"
      : isMoreDestination ? "more"
        : "home";

  const entries = [
    { key: "home", icon: "home", label: "Home", href: "#/" },
    { key: "security", icon: "security", label: "Security", href: destination("settings") },
    { key: "add", icon: "plus", label: "Quick actions" },
    { key: "moderation", icon: "moderation", label: "Moderation", href: destination("warnings") },
    { key: "more", icon: "more", label: "More" },
  ];

  for (const entry of entries) {
    const isAction = entry.key === "add" || entry.key === "more";
    const item = document.createElement(isAction ? "button" : "a");
    item.className = "bottom-nav-item" +
      (entry.key === active ? " active" : "") +
      (entry.key === "add" ? " add-tab" : "");
    if (isAction) {
      item.type = "button";
      item.setAttribute("aria-label", entry.label);
      item.setAttribute("aria-haspopup", "dialog");
      item.addEventListener("click", () => {
        haptic("light");
        (entry.key === "add" ? openQuickActions : openMoreMenu)();
      });
    } else {
      item.href = entry.href;
      item.setAttribute("aria-label", entry.label);
      if (entry.key === active) item.setAttribute("aria-current", "page");
      item.addEventListener("click", () => haptic("light"));
    }
    item.append(inlineIcon(entry.icon, "bottom-nav-icon"));
    if (entry.key !== "add") {
      const caption = document.createElement("span");
      caption.textContent = entry.label;
      item.append(caption);
    }
    nav.append(item);
  }
  document.body.append(nav);
}
function render() {
  leaveScreen();
  closeQuickActions();
  syncBackButton();
  renderNavigation();
  window.scrollTo(0, 0);
  const hash = location.hash;
  const match = routePattern.exec(hash);
  if (match && match[2]) return renderSection(root, match[1], match[2]);
  if (match) return renderChat(root, match[1]);
  const groupRoute = /^#\/groups(?:\/([a-z-]+))?$/.exec(hash);
  if (groupRoute) return renderChats(root, groupRoute[1] || "");
  if (hash === "#/account") return renderHome(root, "account");
  if (hash === "#/activity") return renderHome(root, "activity");
  return renderHome(root);
}

let currentHash = "";
let confirming = false;

async function navigate() {
  const target = location.hash;
  if (target === currentHash) return;
  if (blocksLeave()) {
    history.replaceState(null, "", currentHash || location.pathname + location.search);
    if (confirming) return;
    confirming = true;
    const ok = await confirmDestructive({
      title: "Discard changes?",
      message: "You have unsaved changes on this screen. Leaving now loses them.",
      action: "Discard",
    }).finally(() => { confirming = false; });
    if (!ok) return;
    setLeaveGuard(null);
    location.hash = target;
    return;
  }
  currentHash = target;
  render();
}

if (root) {
  if (!location.hash) {
    const id = launchChatID();
    if (id) history.replaceState(null, "", `#/chats/${id}`);
  }
  if (supports("6.1")) {
    telegram.BackButton.onClick(() => {
      // Close an open sheet before leaving its screen.
      const sheetClose = document.querySelector(
        "#ng-quick-backdrop .ng-sheet-close, .ng-command-backdrop .ng-sheet-close",
      );
      if (sheetClose) {
        haptic("light");
        sheetClose.click();
        return;
      }

      // The command guide has its own module -> command-list level.
      const commandBack = document.querySelector(".ng-command-back:not([hidden])");
      if (commandBack) {
        haptic("light");
        commandBack.click();
        return;
      }

      const parent = parentRoute(location.hash);
      if (parent) {
        haptic("light");
        location.hash = parent;
      }
    });
  }
  window.addEventListener("hashchange", navigate);
  currentHash = location.hash;
  render();
}

// Hide the floating navigation while the keyboard is open, including iOS
// visual viewport changes.
const visualViewport = window.visualViewport;
function syncKeyboardState() {
  const active = document.activeElement;
  const editing = active instanceof HTMLElement &&
    (active.matches("input,textarea,select") || active.isContentEditable);
  const keyboardOpen = Boolean(editing && visualViewport && window.innerHeight - visualViewport.height > 140);
  document.body.classList.toggle("keyboard-open", keyboardOpen);
}
for (const event of ["focusin", "focusout"]) {
  document.addEventListener(event, () => requestAnimationFrame(syncKeyboardState));
}
visualViewport?.addEventListener("resize", syncKeyboardState);
visualViewport?.addEventListener("scroll", syncKeyboardState);
window.addEventListener("resize", syncKeyboardState);
