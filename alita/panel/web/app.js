import { telegram } from "./api.js";
import { renderChat, renderSection } from "./screens/chat.js";
import { renderChats } from "./screens/chats.js";
import { renderHome } from "./screens/home.js";
import { blocksLeave, confirmDestructive, haptic, leaveScreen, setLeaveGuard, supports } from "./ui.js";

telegram?.ready();
telegram?.expand();
if (supports("6.1")) {
  telegram.setHeaderColor("#0b1b34");
  telegram.setBackgroundColor("#071326");
}

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
  return match[2] ? \`#/chats/\${match[1]}\` : "#/groups";
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

function quickAction(href, icon, label) {
  const link = document.createElement("a");
  link.className = "ng-sheet-action";
  link.href = href;
  const symbol = document.createElement("span");
  symbol.className = "ng-sheet-icon";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = icon;
  const title = document.createElement("span");
  title.className = "ng-sheet-label";
  title.textContent = label;
  link.append(symbol, title);
  link.addEventListener("click", closeQuickActions);
  return link;
}

function openQuickActions() {
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
  title.textContent = "Quick actions";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ng-sheet-close";
  close.setAttribute("aria-label", "Close quick actions");
  close.textContent = "×";
  close.addEventListener("click", closeQuickActions);
  head.append(title, close);

  const grid = document.createElement("div");
  grid.className = "ng-sheet-grid";
  grid.append(
    quickAction("https://t.me/NexGuardd_Bot?startgroup=true", "+", "Add NexGuard to a group"),
    quickAction("#/groups", "▦", "My Groups"),
  );

  const match = routePattern.exec(location.hash);
  if (match) {
    const chat = encodeURIComponent(match[1]);
    grid.append(
      quickAction(\`#/chats/\${chat}/overview\`, "◫", "Group Overview"),
      quickAction(\`#/chats/\${chat}/settings\`, "◈", "Security Center"),
      quickAction(\`#/chats/\${chat}/warnings\`, "⚑", "Moderation"),
      quickAction(\`#/chats/\${chat}/activity\`, "⌁", "Activity & Analytics"),
      quickAction(\`#/chats/\${chat}/commands\`, "⌘", "All Commands"),
    );
  }

  sheet.append(grabber, head, grid);
  backdrop.append(sheet);
  document.body.append(backdrop);
  document.addEventListener("keydown", onQuickKeydown);
  close.focus();
}

function renderNavigation() {
  document.getElementById("nexguard-nav")?.remove();
  const nav = document.createElement("nav");
  nav.id = "nexguard-nav";
  nav.className = "bottom-nav";
  nav.setAttribute("aria-label", "Main navigation");

  const hash = location.hash;
  const active = hash.startsWith("#/chats/") || hash === "#/groups" ? "groups"
    : hash === "#/account" ? "account"
      : hash === "#/activity" ? "inbox" : "home";

  for (const [key, glyph, label, href] of [
    ["home", "⌂", "Home", "#/"],
    ["groups", "▦", "Groups", "#/groups"],
    ["add", "+", "Add", ""],
    ["inbox", "▤", "Inbox", "#/activity"],
    ["account", "◉", "Account", "#/account"],
  ]) {
    const item = document.createElement(key === "add" ? "button" : "a");
    item.className = "bottom-nav-item" + (key === active ? " active" : "") + (key === "add" ? " add-tab" : "");
    if (key === "add") {
      item.type = "button";
      item.setAttribute("aria-label", "Open quick actions");
      item.setAttribute("aria-haspopup", "dialog");
      item.addEventListener("click", openQuickActions);
    } else {
      item.href = href;
      item.setAttribute("aria-label", label);
    }
    item.append(document.createTextNode(glyph));
    const caption = document.createElement("span");
    caption.textContent = label;
    item.append(caption);
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
    if (id) history.replaceState(null, "", \`#/chats/\${id}\`);
  }
  if (supports("6.1")) {
    telegram.BackButton.onClick(() => {
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
