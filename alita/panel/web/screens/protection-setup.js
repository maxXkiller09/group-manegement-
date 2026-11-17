import { api } from "../api.js?v=2026.11.16-bootfix1";
import { clear, loading, setHeader, showError, textElement, toast } from "../ui.js?v=2026.11.16-bootfix1";

const PRESETS = {
  khula: {
    label: "Khula group",
    description: "Halka control. Normal chat ke liye.",
    tone: "khula",
    values: {
      "captcha.enabled": false, "captcha.mode": "math", "captcha.timeout": 2, "captcha.action": "kick", "captcha.max_attempts": 3,
      "antiflood.limit": 10, "antiflood.action": "tmute", "antiflood.action_time": 3600, "antiflood.delete_messages": false,
      "warns.limit": 5, "warns.mode": "tmute", "warns.action_time": 3600, "warns.expiry": 604800, "antiraid.auto_threshold": 0,
    },
  },
  balanced: {
    label: "Balanced - Recommended",
    description: "Spam aur flood par control.",
    tone: "balanced",
    values: {
      "captcha.enabled": true, "captcha.mode": "math", "captcha.timeout": 2, "captcha.action": "kick", "captcha.max_attempts": 3,
      "antiflood.limit": 7, "antiflood.action": "tmute", "antiflood.action_time": 3600, "antiflood.delete_messages": true,
      "warns.limit": 3, "warns.mode": "tmute", "warns.action_time": 3600, "warns.expiry": 604800, "antiraid.auto_threshold": 0,
    },
  },
  sakht: {
    label: "Sakht group",
    description: "Strict rules, naye members par nazar.",
    tone: "sakht",
    values: {
      "captcha.enabled": true, "captcha.mode": "math", "captcha.timeout": 2, "captcha.action": "kick", "captcha.max_attempts": 3,
      "antiflood.limit": 5, "antiflood.action": "tmute", "antiflood.action_time": 21600, "antiflood.delete_messages": true,
      "warns.limit": 2, "warns.mode": "tmute", "warns.action_time": 21600, "warns.expiry": 259200, "antiraid.auto_threshold": 10,
    },
  },
};

const GROUPS = [
  { key: "captcha", label: "CAPTCHA", description: "Naye members ki verification." },
  { key: "antiflood", label: "FLOOD", description: "Ek member ke message burst par control." },
  { key: "warns", label: "WARNINGS", description: "Warning threshold aur action." },
  { key: "antiraid", label: "ANTIRAID", description: "Tez aur unique joins par raid protection." },
  { key: "greetings", label: "WELCOME MESSAGE", description: "New members ke welcome toggle." },
];

const LABELS = {
  "captcha.enabled": "Captcha",
  "captcha.mode": "Captcha type",
  "captcha.timeout": "Answer time",
  "captcha.action": "Captcha fail action",
  "captcha.max_attempts": "Allowed attempts",
  "antiflood.limit": "Flood limit",
  "antiflood.action": "Flood action",
  "antiflood.action_time": "Flood action duration",
  "antiflood.delete_messages": "Delete flood messages",
  "warns.limit": "Warning limit",
  "warns.mode": "Warning action",
  "warns.action_time": "Warning action duration",
  "warns.expiry": "Warning expiry",
  "antiraid.auto_threshold": "Automatic raid threshold",
  "greetings.welcome_enabled": "Welcome message",
};

function indexFields(data) {
  const map = new Map();
  for (const module of data.modules || []) {
    for (const field of module.fields || []) map.set(module.key + "." + field.key, field);
  }
  return map;
}

function same(left, right) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
  }
  return left === right;
}

function duration(seconds) {
  if (!Number.isInteger(seconds) || seconds < 0) return "Unavailable";
  if (seconds === 0) return "0 sec";
  const parts = [];
  for (const [label, size] of [["d", 86400], ["h", 3600], ["m", 60], ["s", 1]]) {
    if (seconds >= size) {
      parts.push(Math.floor(seconds / size) + label);
      seconds %= size;
    }
  }
  return parts.join(" ");
}

function showValue(key, value) {
  if (value === null || value === undefined) return "Unavailable";
  if (key.endsWith(".enabled") || key.endsWith(".delete_messages")) return value ? "ON" : "OFF";
  if (key === "captcha.timeout") return value + " min";
  if (key === "antiflood.limit") return value === 0 ? "OFF" : value + " messages";
  if (key === "antiraid.auto_threshold") return value === 0 ? "OFF" : value + " joins / 60 sec";
  if (key === "antiraid.raid_time" || key === "antiraid.raid_action_time" ||
      key === "antiflood.action_time" || key === "warns.action_time" || key === "warns.expiry") {
    return value === 0 && key === "warns.expiry" ? "Never" : duration(value);
  }
  if (key === "antiflood.action" || key === "warns.mode" || key === "captcha.action") {
    const labels = { tmute: "Timed mute", mute: "Mute", kick: "Kick", tban: "Timed ban", ban: "Ban" };
    return labels[value] || String(value);
  }
  if (key === "captcha.mode") return value === "math" ? "Math" : String(value);
  return String(value);
}

function lessProtection(key, before, after) {
  if (typeof before === "boolean" && typeof after === "boolean") return before && !after;
  if (["antiflood.limit", "warns.limit", "captcha.timeout", "captcha.max_attempts"].includes(key)) {
    return Number(after) > Number(before);
  }
  if (key === "antiraid.auto_threshold") {
    return Number(before) > 0 && (Number(after) === 0 || Number(after) > Number(before));
  }
  if (key === "warns.expiry") {
    return Number(after) > 0 && (Number(before) === 0 || Number(after) < Number(before));
  }
  if (["antiflood.action_time", "warns.action_time"].includes(key)) {
    return Number(after) < Number(before);
  }
  if (["antiflood.action", "warns.mode"].includes(key)) {
    return (before === "mute" && after === "tmute") || (before === "ban" && after === "tban");
  }
  return false;
}

function svgIcon(kind) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ng-setup-svg", "ng-setup-svg-" + kind);

  if (kind === "check" || kind === "cross") {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "9");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", kind === "check" ? "m8 12 2.5 2.5L16 9" : "m9 9 6 6m0-6-6 6");
    svg.append(circle, path);
  } else if (kind === "info") {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", "12");
    circle.setAttribute("r", "9");
    const line = document.createElementNS(ns, "path");
    line.setAttribute("d", "M12 11v5m0-8h.01");
    svg.append(circle, line);
  } else {
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z");
    svg.append(path);
  }
  return svg;
}

function sectionLabel(text) {
  return textElement("h3", text, "ng-tool-section-label ng-setup-section-label");
}

function glassCard() {
  const card = document.createElement("section");
  card.className = "ng-tool-card ng-setup-glass";
  return card;
}

function actionButton(label, variant, onClick, disabled = false) {
  const button = textElement("button", label, variant + " ng-setup-action");
  button.type = "button";
  button.disabled = disabled;
  if (disabled) button.setAttribute("aria-disabled", "true");
  button.addEventListener("click", onClick);
  return button;
}

function actionBar(root, buttons, stacked = false) {
  const bar = document.createElement("div");
  bar.className = "ng-setup-actionbar" + (stacked ? " stacked" : "");
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Wizard actions");
  for (const item of buttons) bar.append(actionButton(item.label, item.variant, item.onClick, item.disabled));
  root.append(bar);
}

function statusRow(title, detail, ok) {
  const row = document.createElement("div");
  row.className = "ng-setup-access-row";
  row.append(svgIcon(ok ? "check" : "cross"));
  const copy = document.createElement("span");
  copy.className = "ng-setup-access-copy";
  copy.append(textElement("strong", title, "ng-setup-access-title"), textElement("span", detail, "ng-setup-muted"));
  row.append(copy);
  return row;
}

function levelIcon(tone) {
  const icon = document.createElement("span");
  icon.className = "ng-tool-icon ng-setup-level-icon tone-" + tone;
  icon.append(svgIcon("shield"));
  return icon;
}

function protectionOff(fields) {
  const required = [
    ["captcha.enabled", false],
    ["antiflood.limit", 0],
    ["antiraid.auto_threshold", 0],
    ["antispam.aispam_enabled", false],
    ["antispam.spamdb_enabled", false],
    ["antispam.probation_enabled", false],
  ];
  return required.every(([key, value]) => fields.has(key) && same(fields.get(key).value, value));
}

function fieldGroup(key) {
  if (key.startsWith("captcha.")) return "captcha";
  if (key.startsWith("antiflood.")) return "antiflood";
  if (key.startsWith("warns.")) return "warns";
  if (key.startsWith("antiraid.")) return "antiraid";
  return "greetings";
}

function descriptionFor(key, value) {
  const descriptions = {
    "captcha.enabled": value ? "Naye members ko verify karna hoga." : "Captcha verification band rahega.",
    "captcha.mode": "Verification ka sawal kis type ka hoga.",
    "captcha.timeout": "Member ko verification ke liye itna waqt milega.",
    "captcha.action": "Verification fail hone par ye action hoga.",
    "captcha.max_attempts": "Member ko itni attempts milengi.",
    "antiflood.action": "Message limit cross hone par ye action hoga.",
    "antiflood.action_time": "Flood action itni der tak rahega.",
    "antiflood.delete_messages": value ? "Flood burst ke messages delete honge." : "Flood messages auto-delete nahi honge.",
    "warns.limit": "Itni warnings par configured action trigger hoga.",
    "warns.mode": "Warning limit poori hone par ye action hoga.",
    "warns.action_time": "Warning action itni der tak rahega.",
    "warns.expiry": "Warnings is duration ke baad expire hongi.",
    "antiraid.auto_threshold": value === 0 ? "Automatic raid trigger band rahega." : value + " unique joins in 60 seconds par raid trigger hoga.",
    "greetings.welcome_enabled": value ? "New members ke liye welcome message enabled hoga." : "Welcome message disabled rahega.",
  };
  if (key === "antiflood.limit") {
    return value === 0
      ? "Antiflood band rahega."
      : "Ek user ke 60 sec ke andar lagatar " + (Number(value) + 1) + " messages par action hoga.";
  }
  return descriptions[key] || "Ye setting update hogi.";
}

function changedRow(key, before, after) {
  const row = document.createElement("div");
  row.className = "ng-setup-diff-row";
  const head = document.createElement("div");
  head.className = "ng-setup-diff-head";
  const values = document.createElement("span");
  values.className = "ng-setup-values";
  values.append(
    textElement("span", showValue(key, before), "ng-setup-old-value"),
    textElement("span", "→", "ng-setup-arrow"),
    textElement("strong", showValue(key, after), "ng-setup-new-value"),
  );
  head.append(textElement("strong", LABELS[key] || key, "ng-setup-diff-title"), values);
  row.append(head, textElement("p", descriptionFor(key, after), "ng-setup-muted"));
  if (lessProtection(key, before, after)) {
    row.append(textElement("span", "Protection kam hogi", "ng-setup-chip ng-setup-chip-amber"));
  }
  return row;
}

function groupCard(label, description) {
  const wrap = document.createElement("section");
  wrap.className = "ng-setup-group";
  wrap.append(sectionLabel(label));
  const card = glassCard();
  card.append(textElement("p", description, "ng-setup-group-description"));
  wrap.append(card);
  return { wrap, card };
}

export async function renderProtectionSetup(root, chatID, chat = {}) {
  clear(root);
  setHeader("Protection Setup", chat.title || "Your Telegram group");
  root.append(loading("Loading protection settings…"));
  const route = window.location.hash;
  let initial;
  try {
    initial = await api("chats/" + encodeURIComponent(chatID) + "/settings");
  } catch (error) {
    if (window.location.hash === route) showError(root, error, () => renderProtectionSetup(root, chatID, chat));
    return;
  }
  if (window.location.hash !== route) return;

  const original = indexFields(initial);
  const accessOK = chat.role === "admin" && Boolean(chat.bot_admin) && !initial.read_only;
  const state = {
    step: 1,
    preset: "balanced",
    welcome: "unchanged",
    targetChanges: new Map(),
    saved: [],
    failed: {},
    applied: {},
    undo: null,
  };

  function planned() {
    const changes = new Map();
    const values = PRESETS[state.preset].values;
    for (const [key, value] of Object.entries(values)) {
      const field = original.get(key);
      if (field && field.writable && !same(field.value, value)) changes.set(key, value);
    }
    if (state.welcome !== "unchanged") {
      const key = "greetings.welcome_enabled";
      const value = state.welcome === "on";
      const field = original.get(key);
      if (field && field.writable && !same(field.value, value)) changes.set(key, value);
    }
    return changes;
  }

  const settingsURL = "chats/" + encodeURIComponent(chatID) + "/settings";
  const getSettings = () => api(settingsURL);
  const patch = changes => api(settingsURL, { method: "PATCH", body: { changes } });

  function pageHeader(step, title, subtitle) {
    const head = document.createElement("header");
    head.className = "ng-setup-page-head";
    head.append(
      textElement("p", "Step " + step + " of 4", "ng-setup-step-label"),
      textElement("h1", title, "ng-setup-page-title"),
      textElement("p", subtitle, "ng-setup-page-subtitle"),
    );
    return head;
  }

  function renderAccess() {
    root.append(pageHeader(1, "Access check", "Presets sirf group admin apply kar sakte hain."));
    const card = glassCard();
    card.append(
      statusRow("Admin access", chat.role === "admin" ? "Aap group admin ho." : "Aap group admin nahi ho.", chat.role === "admin"),
      statusRow("NexGuard bot admin hai", Boolean(chat.bot_admin) ? "Bot ko group mein admin access mila hai." : "NexGuard ko group admin banana zaroori hai.", Boolean(chat.bot_admin)),
    );
    root.append(card);

    if (!accessOK) {
      const info = glassCard();
      info.classList.add("ng-setup-info-card");
      info.append(svgIcon("info"), textElement("p", "Abhi aap sirf settings dekh sakte ho, badal nahi sakte.", "ng-setup-info-copy"));
      root.append(info);
    }
    if (protectionOff(original)) {
      const suggestion = glassCard();
      suggestion.classList.add("ng-setup-suggestion-card");
      suggestion.append(textElement("strong", "Protections abhi OFF hain", "ng-setup-access-title"));
      suggestion.append(textElement("p", "Balanced preset se basic protection enable kar sakte ho. Apply se pehle changes review honge.", "ng-setup-muted"));
      root.append(suggestion);
    }

    actionBar(root, [{
      label: accessOK ? "Continue" : "Presets disabled",
      variant: "primary",
      disabled: !accessOK,
      onClick: () => { if (accessOK) { state.step = 2; draw(); } },
    }]);
  }

  function renderLevels() {
    root.append(pageHeader(2, "Protection level", "Apne group ke liye level chuno."));
    const choices = document.createElement("div");
    choices.className = "ng-setup-levels";
    for (const [key, preset] of Object.entries(PRESETS)) {
      const label = document.createElement("label");
      label.className = "ng-setup-level-card" + (state.preset === key ? " selected" : "");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "ng-setup-level";
      radio.value = key;
      radio.checked = state.preset === key;
      radio.setAttribute("aria-label", preset.label);
      radio.addEventListener("change", () => { state.preset = key; draw(); });
      const radioVisual = document.createElement("span");
      radioVisual.className = "ng-setup-radio-visual";
      radioVisual.setAttribute("aria-hidden", "true");
      const copy = document.createElement("span");
      copy.className = "ng-setup-level-copy";
      copy.append(textElement("strong", preset.label, "ng-setup-level-title"), textElement("span", preset.description, "ng-setup-muted"));
      label.append(radio, levelIcon(preset.tone), copy, radioVisual);
      choices.append(label);
    }
    root.append(choices);

    const welcome = glassCard();
    const welcomeHead = document.createElement("div");
    welcomeHead.className = "ng-setup-welcome-head";
    welcomeHead.append(
      textElement("strong", "Welcome message", "ng-setup-welcome-title"),
      textElement("span", "Optional. Abhi: " + (original.get("greetings.welcome_enabled")?.value ? "ON" : "OFF"), "ng-setup-muted"),
    );
    welcome.append(welcomeHead);
    const segments = document.createElement("div");
    segments.className = "ng-setup-segments";
    for (const [value, label] of [["unchanged", "Unchanged"], ["on", "ON"], ["off", "OFF"]]) {
      const button = textElement("button", label, "ng-setup-segment" + (state.welcome === value ? " selected" : ""));
      button.type = "button";
      button.setAttribute("aria-pressed", String(state.welcome === value));
      button.addEventListener("click", () => { state.welcome = value; draw(); });
      segments.append(button);
    }
    welcome.append(segments);
    root.append(welcome);
    root.append(textElement("p", "Locks ke liye Security Center ya /lock command use karo.", "ng-setup-footnote"));
    root.append(textElement("p", "AI Spam ke liye global AI setup chahiye.", "ng-setup-footnote"));
    actionBar(root, [
      { label: "Back", variant: "secondary", onClick: () => { state.step = 1; draw(); } },
      { label: "Continue", variant: "primary", onClick: () => { state.targetChanges = planned(); state.step = 3; draw(); } },
    ]);
  }

  function renderReview() {
    root.append(pageHeader(3, "Review changes", "Confirm karne se pehle har change check kar lo."));
    const presetChip = textElement("span", PRESETS[state.preset].label, "ng-setup-chip ng-setup-chip-preset");
    root.append(presetChip);

    const changes = state.targetChanges;
    let shown = 0;
    for (const group of GROUPS) {
      const rows = Array.from(changes.entries()).filter(([key]) => fieldGroup(key) === group.key);
      if (!rows.length) continue;
      const section = groupCard(group.label, group.description);
      for (const [key, value] of rows) section.card.append(changedRow(key, original.get(key)?.value, value));
      if (group.key === "antiraid" && changes.has("antiraid.auto_threshold") && changes.get("antiraid.auto_threshold") > 0) {
        section.card.append(textElement("strong", "Raid ke dauran naye members kuch der ke liye ban honge", "ng-setup-raid-title"));
        section.card.append(textElement("p", "Raid duration: " + duration(original.get("antiraid.raid_time")?.value) + " (current)", "ng-setup-muted"));
        section.card.append(textElement("p", "New-member ban duration: " + duration(original.get("antiraid.raid_action_time")?.value) + " (current)", "ng-setup-muted"));
        const info = document.createElement("div");
        info.className = "ng-setup-info-line";
        info.append(svgIcon("info"), textElement("span", "Antiraid ke liye Redis chahiye", "ng-setup-muted"));
        section.card.append(info);
      }
      root.append(section.wrap);
      shown += rows.length;
    }

    if (shown === 0) {
      const empty = glassCard();
      empty.append(textElement("strong", "Koi setting change nahi hogi", "ng-setup-access-title"));
      empty.append(textElement("p", "Current values is preset ke saath already match karti hain.", "ng-setup-muted"));
      root.append(empty);
    }

    actionBar(root, [
      { label: "Back", variant: "secondary", onClick: () => { state.step = 2; draw(); } },
      { label: "Confirm", variant: "primary", disabled: changes.size === 0, onClick: () => void apply(false) },
    ]);
  }

  function resultGroups() {
    const keys = Array.from(state.targetChanges.keys());
    return GROUPS.map(group => ({ group, keys: keys.filter(key => fieldGroup(key) === group.key) })).filter(item => item.keys.length);
  }

  function renderResult() {
    root.append(pageHeader(4, "Apply result", "Settings ka latest GET result verify kiya gaya hai."));
    const chips = document.createElement("div");
    chips.className = "ng-setup-result-chips";
    chips.append(
      textElement("span", state.saved.length + " saved", "ng-setup-chip ng-setup-chip-saved"),
      textElement("span", Object.keys(state.failed).length + " failed", "ng-setup-chip ng-setup-chip-failed"),
    );
    root.append(chips);

    for (const item of resultGroups()) {
      const section = groupCard(item.group.label, item.group.description);
      for (const key of item.keys) {
        const ok = state.saved.includes(key);
        const row = document.createElement("div");
        row.className = "ng-setup-result-row";
        row.append(svgIcon(ok ? "check" : "cross"));
        const detail = ok ? "Saved" : "Save nahi hua. Dobara try karo.";
        const copy = document.createElement("span");
        copy.className = "ng-setup-result-copy";
        copy.append(textElement("strong", LABELS[key] || key, "ng-setup-result-title"), textElement("span", detail, "ng-setup-muted"));
        row.append(copy);
        section.card.append(row);
      }
      root.append(section.wrap);
    }

    if (state.undo) {
      const undoCard = glassCard();
      undoCard.append(textElement("strong", "Undo verification", "ng-setup-access-title"));
      undoCard.append(textElement("p", "Restored: " + state.undo.restored.length, "ng-setup-muted"));
      if (state.undo.skipped.length) {
        undoCard.append(textElement("p", "Skipped — value apply ke baad badal gayi: " + state.undo.skipped.map(key => LABELS[key] || key).join(", "), "ng-setup-chip ng-setup-chip-amber"));
      }
      if (state.undo.failed.length) {
        undoCard.append(textElement("p", "Restore verify nahi hua: " + state.undo.failed.map(key => LABELS[key] || key).join(", "), "ng-setup-chip ng-setup-chip-failed"));
      }
      root.append(undoCard);
    }

    actionBar(root, [
      { label: "Retry failed", variant: "primary", disabled: Object.keys(state.failed).length === 0, onClick: () => void apply(true) },
      { label: "Undo saved changes", variant: "secondary", disabled: state.saved.length === 0, onClick: () => void undo() },
    ], true);
  }

  async function verifyTargets(patchErrors = {}) {
    let latest;
    try {
      latest = indexFields(await getSettings());
    } catch (error) {
      state.saved = [];
      state.failed = {};
      for (const key of state.targetChanges.keys()) state.failed[key] = "GET verify failed";
      toast("GET verification failed. Result ko saved nahi mark kiya.", "error");
      return;
    }

    state.saved = [];
    state.failed = {};
    state.applied = {};
    for (const [key, expected] of state.targetChanges) {
      const field = latest.get(key);
      if (field && same(field.value, expected)) {
        state.saved.push(key);
        state.applied[key] = field.value;
      } else {
        state.failed[key] = patchErrors[key] || "GET value expected value se match nahi hui";
      }
    }
  }

  async function apply(retryOnly) {
    const pending = retryOnly
      ? new Map(Array.from(state.targetChanges).filter(([key]) => Object.prototype.hasOwnProperty.call(state.failed, key)))
      : new Map(state.targetChanges);
    if (!pending.size) return;

    let patchErrors = {};
    try {
      const response = await patch(Object.fromEntries(pending));
      patchErrors = response.failed || {};
    } catch (error) {
      patchErrors = error.payload?.failed || {};
      if (!Object.keys(patchErrors).length) {
        for (const key of pending.keys()) patchErrors[key] = error.message || "Save request failed";
      }
    }
    await verifyTargets(patchErrors);
    state.undo = null;
    state.step = 4;
    draw();
  }

  async function undo() {
    const restored = [];
    const skipped = [];
    const failed = [];

    for (const key of state.saved) {
      if (!Object.prototype.hasOwnProperty.call(state.applied, key) || !original.has(key)) {
        skipped.push(key);
        continue;
      }
      try {
        const beforeRestore = indexFields(await getSettings());
        const current = beforeRestore.get(key);
        if (!current || !same(current.value, state.applied[key])) {
          skipped.push(key);
          continue;
        }

        const response = await patch({ [key]: original.get(key).value });
        if (response.failed && response.failed[key]) {
          failed.push(key);
          continue;
        }
        const afterRestore = indexFields(await getSettings());
        const restoredField = afterRestore.get(key);
        if (restoredField && same(restoredField.value, original.get(key).value)) restored.push(key);
        else failed.push(key);
      } catch (error) {
        failed.push(key);
      }
    }

    try {
      const finalFields = indexFields(await getSettings());
      for (const key of restored.slice()) {
        const field = finalFields.get(key);
        if (!field || !same(field.value, original.get(key).value)) {
          restored.splice(restored.indexOf(key), 1);
          failed.push(key);
        }
      }
    } catch (error) {
      for (const key of restored.splice(0)) failed.push(key);
    }

    state.undo = { restored, skipped, failed: Array.from(new Set(failed)) };
    state.step = 4;
    draw();
  }

  function draw() {
    clear(root);
    root.classList.add("ng-setup-page");
    if (state.step === 1) renderAccess();
    else if (state.step === 2) renderLevels();
    else if (state.step === 3) renderReview();
    else renderResult();
  }

  draw();
}
