import { toast, textElement, confirmDestructive, userLabel } from "../ui.js";
import { api } from "../api.js";

const commandGroups = [
  {
    title: "Moderation",
    commands: [
      ["/ban", "Removes a member and stops them from joining again.", "admin", "/ban @username reason"],
      ["/tban", "Blocks a member for the set time.", "admin", "/tban @username 1d reason"],
      ["/unban", "Allows a blocked member to join again.", "admin", "/unban @username"],
      ["/kick", "Removes a member. They can join again.", "admin", "/kick @username reason"],
      ["/mute", "Stops a member from sending messages.", "admin", "/mute @username reason"],
      ["/tmute", "Stops a member from sending messages for a set time.", "admin", "/tmute @username 1h reason"],
      ["/unmute", "Allows a member to send messages again.", "admin", "/unmute @username"],
      ["/warn", "Sends a warning when a member breaks a group rule.", "admin", "/warn @username reason"],
      ["/warns", "Shows the warning list or your own warnings.", "member", "/warns"],
      ["/rmwarn", "Removes one warning from a member.", "admin", "/rmwarn @username"],
    ],
  },
  {
    title: "Group protection",
    commands: [
      ["/antiraid", "Turns on extra group protection during a join raid.", "admin", "/antiraid"],
      ["/setflood", "Sets what happens when someone sends too many messages.", "admin", "/setflood 5"],
      ["/setfloodmode", "Sets what happens when spam messages are detected.", "admin", "/setfloodmode mute"],
      ["/captcha", "Sets up checks for new members.", "admin", "/captcha"],
      ["/aispam", "Controls automatic spam checks.", "admin", "/aispam"],
      ["/lock", "Stops members from sending a selected type of message.", "admin", "/lock url"],
      ["/unlock", "Allows members to send that type of message again.", "admin", "/unlock url"],
      ["/blacklists", "Manages blocked words and what happens when they are sent.", "admin", "/blacklists"],
    ],
  },
  {
    title: "Group tools",
    commands: [
      ["/setrules", "Sets or updates the group rules.", "admin", "/setrules Be respectful"],
      ["/rules", "Shows the group rules.", "member", "/rules"],
      ["/setwelcome", "Sets the message new members receive.", "admin", "/setwelcome Welcome {first}"],
      ["/welcome", "Views or changes the welcome message.", "admin", "/welcome"],
      ["/filters", "Manages automatic replies to words or phrases.", "admin", "/filters"],
      ["/notes", "Shows saved notes.", "member", "/notes"],
      ["/setlog", "Connects a channel to receive group activity updates.", "admin", "/setlog"],
      ["/adminlist", "Shows the group admin list.", "member", "/adminlist"],
      ["/invitelink", "Shows the group invite link.", "member", "/invitelink"],
      ["/connect", "Starts setup to connect your private chat to a group.", "member", "/connect"],
    ],
  },
];

const manageRoutes = {
  "/filters": "filters",
  "/notes": "notes",
  "/blacklists": "blacklists",
  "/welcome": "settings",
  "/setwelcome": "settings",
  "/setrules": "settings",
  "/setlog": "settings",
  "/antiraid": "settings",
  "/captcha": "settings",
  "/aispam": "settings",
  "/setflood": "settings",
  "/setfloodmode": "settings",
  "/lock": "settings",
  "/unlock": "settings",
};

function commandCard(command, chatID) {
  const [name, description, access, example] = command;
  const card = document.createElement("article");
  card.className = "callout command-card";
  const head = document.createElement("div");
  head.className = "command-card-head";
  head.append(textElement("strong", name), textElement("span", access === "admin" ? "Admin" : "All members", "pill accent"));
  card.append(head, textElement("p", description, "command-description"));
  const exampleRow = document.createElement("div");
  exampleRow.className = "command-example";
  exampleRow.append(textElement("code", example));
  const copy = textElement("button", "Copy command");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(example);
      toast("Command copied. Paste it into your group and send it.");
    } catch {
      toast("Could not copy. Please copy the command manually.", "error");
    }
  });
  exampleRow.append(copy);
  card.append(exampleRow);
  const route = manageRoutes[name];
  if (route) {
    const manage = textElement("a", "Manage in the Mini App  ›", "command-manage");
    manage.href = `#/chats/${encodeURIComponent(chatID)}/${route}`;
    card.append(manage);
  }
  return card;
}

export function renderCommands(root, chatID, chat) {
  if (chat?.role === "admin") {
    const actionBox = document.createElement("section");
    actionBox.className = "callout direct-action";
    actionBox.append(textElement("h2", "Direct moderation actions", "section-header"));
    actionBox.append(textElement("p", "Enter a member's user ID and choose an action. Check the details before you confirm. Telegram checks your permissions each time.", "command-description"));

    const action = document.createElement("select");
    action.setAttribute("aria-label", "Moderation action");
    for (const [value, label] of [["ban", "Ban"], ["tban", "Timed ban"], ["kick", "Kick"], ["mute", "Mute"], ["tmute", "Timed mute"], ["unban", "Unban"], ["unmute", "Unmute"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      action.append(option);
    }
    const memberPicker = document.createElement("select");
    memberPicker.setAttribute("aria-label", "Choose a recently active member");
    const initialOption = document.createElement("option");
    initialOption.value = "";
    initialOption.textContent = "Loading active members…";
    memberPicker.append(initialOption);

    const target = document.createElement("input");
    target.type = "number";
    target.min = "1";
    target.step = "1";
    target.placeholder = "Or enter Telegram user ID manually";
    target.setAttribute("aria-label", "Target Telegram user ID");
    memberPicker.addEventListener("change", () => {
      if (memberPicker.value) target.value = memberPicker.value;
    });
    api(`chats/${encodeURIComponent(chatID)}/top-members?days=90`).then((data) => {
      memberPicker.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Choose a member (optional)";
      memberPicker.append(placeholder);
      const members = Array.isArray(data?.members) ? data.members : [];
      for (const member of members) {
        const option = document.createElement("option");
        option.value = String(member.user_id);
        option.textContent = userLabel(data.names, member.user_id);
        memberPicker.append(option);
      }
      if (members.length === 0) {
        placeholder.textContent = "No members found yet. Enter a user ID below.";
      }
    }).catch(() => {
      memberPicker.replaceChildren();
      const fallback = document.createElement("option");
      fallback.value = "";
      fallback.textContent = "Member list is not available. Enter a user ID below.";
      memberPicker.append(fallback);
    });
    const duration = document.createElement("input");
    duration.type = "number";
    duration.min = "1";
    duration.max = String(366 * 24 * 60 * 60);
    duration.step = "1";
    duration.value = "3600";
    duration.placeholder = "Time in seconds (3600 = 1 hour)";
    duration.setAttribute("aria-label", "Timed moderation duration in seconds");
    duration.hidden = true;
    action.addEventListener("change", () => {
      duration.hidden = action.value !== "tban" && action.value !== "tmute";
    });
    const reason = document.createElement("textarea");
    reason.maxLength = 3000;
    reason.placeholder = "Reason (optional)";
    reason.setAttribute("aria-label", "Reason");
    const execute = textElement("button", "Review action");
    execute.type = "button";
    execute.addEventListener("click", async () => {
      const targetID = Number(target.value);
      if (!Number.isSafeInteger(targetID) || targetID <= 0) {
        toast("Enter a valid Telegram user ID.", "error");
        return;
      }
      const chosen = action.value;
      const timed = chosen === "tban" || chosen === "tmute";
      const durationSeconds = timed ? Number(duration.value) : 0;
      if (timed && (!Number.isSafeInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 366 * 24 * 60 * 60)) {
        toast("Enter a time from 1 to 31622400 seconds.", "error");
        return;
      }
      const approved = await confirmDestructive({
        title: chosen.toUpperCase() + " member?",
        message: "Group action: " + chosen + "\\nTarget user ID: " + targetID + (timed ? "\\nDuration: " + durationSeconds + " seconds" : "") + (reason.value.trim() ? "\\nReason: " + reason.value.trim() : ""),
        action: "Confirm " + chosen,
      });
      if (!approved) return;
      execute.disabled = true;
      try {
        const result = await api(`chats/${encodeURIComponent(chatID)}/actions`, {
          method: "POST",
          body: { action: chosen, target_user_id: targetID, reason: reason.value.trim(), duration_seconds: durationSeconds, confirmed: true },
        });
        toast(result.message || "Action successfully applied.");
      } catch (error) {
        toast(error.message || "Action failed.", "error");
      } finally {
        execute.disabled = false;
      }
    });
    actionBox.append(action, duration, memberPicker, target, reason, execute);
    root.append(actionBox);
  }
  root.append(
    textElement("p", "See what each command does. Copy an example and send it in your group. You can also change supported settings here.", "callout"),
  );

  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search commands or features…";
  search.setAttribute("aria-label", "Search commands");
  root.append(search);

  const results = document.createElement("div");
  results.className = "command-groups";
  root.append(results);

  function draw(query = "") {
    while (results.firstChild) results.removeChild(results.firstChild);
    const needle = query.trim().toLocaleLowerCase();
    let count = 0;
    for (const group of commandGroups) {
      const matches = group.commands.filter((command) =>
        (chat?.role === "admin" || command[2] !== "admin") &&
        command.join(" ").toLocaleLowerCase().includes(needle),
      );
      if (matches.length === 0) continue;
      results.append(textElement("h2", group.title, "section-header"));
      for (const command of matches) {
        results.append(commandCard(command, chatID));
        count += 1;
      }
    }
    if (count === 0) {
      results.append(textElement("p", "No commands found. Try another search.", "empty"));
    }
  }

  search.addEventListener("input", () => draw(search.value));
  draw();
}
