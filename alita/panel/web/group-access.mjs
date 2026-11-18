export const GROUP_ACCESS_CACHE_MS = 45_000;

export function classifyGroupAccess(chat) {
  if (!chat || typeof chat !== "object") {
    return { status: "unknown", label: "Unknown", selectable: false, hint: "Telegram se access verify nahi ho paya." };
  }
  if (chat.role !== "admin") {
    return { status: "limited", label: "Limited rights", selectable: false, hint: "Aap is group ke admin nahi ho." };
  }
  if (chat.bot_admin !== true) {
    if (chat.bot_rights_known === true) {
      return { status: "bot_missing", label: "Bot admin nahi hai", selectable: false, hint: "NexGuard ko group admin banao." };
    }
    return { status: "unknown", label: "Unknown", selectable: false, hint: "Telegram bot rights verify nahi kar paya." };
  }
  if (chat.rights_known !== true) {
    return { status: "unknown", label: "Unknown", selectable: false, hint: "Telegram rights snapshot available nahi hai." };
  }
  if (chat.can_restrict_members === true && chat.bot_can_restrict_members === true) {
    return { status: "full", label: "Full rights", selectable: true, hint: "" };
  }
  return {
    status: "limited",
    label: "Limited rights",
    selectable: true,
    hint: "Admin access hai, lekin kuch Telegram permissions limited hain. Available settings apply kar sakte ho.",
  };
}

export function singleEligibleGroup(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  if (entries.some(entry => !entry || !entry.access ||
      entry.access.status === "checking" || entry.access.status === "unknown")) {
    return null;
  }
  const eligible = entries.filter(entry => entry.access.status === "full");
  return eligible.length === 1 ? String(eligible[0].chat.id) : null;
}
