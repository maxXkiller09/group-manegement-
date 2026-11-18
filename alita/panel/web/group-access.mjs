export const GROUP_ACCESS_CACHE_MS = 45_000;

export function classifyGroupAccess(chat) {
  if (!chat || typeof chat !== "object") {
    return { status: "unknown", label: "Unknown", selectable: false };
  }
  if (chat.role !== "admin") {
    return { status: "limited", label: "Limited rights", selectable: false };
  }
  if (chat.bot_admin !== true) {
    return { status: "bot_missing", label: "Bot admin nahi hai", selectable: false };
  }
  return { status: "full", label: "Full rights", selectable: true };
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
