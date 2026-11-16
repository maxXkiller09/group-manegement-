// Warnings: admin-only pages of warned users with all their entries, expired
// ones labelled, and a remove button that runs the same repository call as
// /unwarn. Server data reaches the DOM only through textContent.
import { api } from "../api.js";
import { confirmDestructive, errorMessage, haptic, relativeTime, textElement, userLabel } from "../ui.js";

const PAGE_SIZE = 50;

function formatTime(value) {
	if (!value) {
		return "no timestamp";
	}
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function issuerLabel(entry, names) {
	if (entry.anonymous) {
		return "anonymous admin";
	}
	if (entry.automatic) {
		return "automatic";
	}
	return entry.warned_by ? `by ${userLabel(names, entry.warned_by)}` : "unknown issuer";
}

export async function renderWarnings(root, chatID, chat) {
	const container = document.createElement("div");
	container.className = "warnings-screen";
	root.append(container);

	const readOnly = chat.role !== "admin" || !chat.bot_admin;
	const status = textElement("p", "", "status");
	const list = document.createElement("ul");
	list.className = "list-rows";
	const loadMore = textElement("button", "Load more");
	loadMore.type = "button";
	loadMore.hidden = true;
	container.append(status);
	if (!readOnly) {
		const issueBox = document.createElement("section");
		issueBox.className = "callout warning-create";
		issueBox.append(textElement("h3", "Issue a warning"));
		const target = document.createElement("input");
		target.type = "number";
		target.min = "1";
		target.step = "1";
		target.inputMode = "numeric";
		target.placeholder = "Member Telegram user ID";
		target.setAttribute("aria-label", "Member Telegram user ID");
		const memberPicker = document.createElement("select");
		memberPicker.setAttribute("aria-label", "Choose a tracked member");
		memberPicker.append(new Option("Choose a tracked member (optional)", ""));
		memberPicker.addEventListener("change", () => {
			if (memberPicker.value) target.value = memberPicker.value;
		});
		api(`chats/${encodeURIComponent(chatID)}/top-members?days=90&limit=50`).then((data) => {
			memberPicker.replaceChildren(new Option("Choose a tracked member (optional)", ""));
			for (const member of data.members ?? []) {
				memberPicker.append(new Option(userLabel(data.names, member.user_id), String(member.user_id)));
			}
		}).catch(() => {
			memberPicker.replaceChildren(new Option("Member list unavailable — enter ID below", ""));
		});
		const reason = document.createElement("textarea");
		reason.maxLength = 3000;
		reason.rows = 2;
		reason.placeholder = "Reason (optional)";
		reason.setAttribute("aria-label", "Warning reason");
		const issue = textElement("button", "Review warning");
		issue.type = "button";
		issue.addEventListener("click", async () => {
			const userID = Number(target.value);
			if (!Number.isSafeInteger(userID) || userID <= 0) {
				status.className = "error";
				status.textContent = "Enter a valid Telegram user ID.";
				return;
			}
			const approved = await confirmDestructive({
				title: "Issue warning?",
					message: `Warning for Telegram user ${userID}${reason.value.trim() ? `\nReason: ${reason.value.trim()}` : ""}. The group's configured warn-limit action may also apply.`,
				action: "Issue warning",
			});
			if (!approved) return;
			issue.disabled = true;
			try {
				const result = await api(`chats/${encodeURIComponent(chatID)}/warnings`, {
					method: "POST",
					body: { user_id: userID, reason: reason.value.trim() },
				});
				target.value = "";
				reason.value = "";
				await loadPage(true);
				haptic("success");
				status.textContent = `${result.message} Current warnings: ${result.warnings}/${result.warn_limit}.`;
			} catch (error) {
				haptic("error");
				status.className = "error";
				status.textContent = errorMessage(error, "Could not issue this warning.");
			} finally {
				issue.disabled = false;
			}
		});
		issueBox.append(memberPicker, target, reason, issue);
		container.append(issueBox);
	} else {
		container.append(textElement("p", "Read-only: warnings cannot be changed in this chat.", "muted"));
	}
	container.append(list, loadMore);

	const state = { cursor: 0, loading: false };

	async function loadPage(reset) {
		if (state.loading) {
			return;
		}
		state.loading = true;
		status.className = "status";
		status.textContent = "Loading warnings…";
		try {
			const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
			if (!reset && state.cursor > 0) {
				params.set("cursor", String(state.cursor));
			}
			const data = await api(`chats/${encodeURIComponent(chatID)}/warnings?${params}`);
			if (reset) {
				list.replaceChildren();
				state.cursor = 0;
			}
			for (const user of data.users ?? []) {
				list.append(userRow(user, data.names));
			}
			state.cursor = data.next_cursor ?? 0;
			loadMore.hidden = !state.cursor;
			status.textContent = list.childElementCount === 0
				? "No warnings in this chat."
				: `${list.childElementCount} warned ${list.childElementCount === 1 ? "member" : "members"} shown`;
		} catch (error) {
			status.className = "error";
			status.textContent = error?.message ?? "Could not load warnings.";
		} finally {
			state.loading = false;
		}
	}

	function userRow(user, names) {
		const item = document.createElement("li");
		item.className = "warn-user";

		const head = document.createElement("div");
		head.className = "warn-head";
		head.append(
			textElement("span", userLabel(names, user.user_id), "list-name"),
			textElement("span", `${user.active} active`, "badge"),
		);
		item.append(head);

		const entries = document.createElement("ul");
		entries.className = "warn-entries";
		for (const entry of user.entries ?? []) {
			const row = document.createElement("li");
			row.className = entry.expired ? "warn-entry expired" : "warn-entry";
			row.append(textElement("span", entry.reason || "(no reason)", "warn-reason"));
			const when = entry.warned_at ? relativeTime(entry.warned_at) || formatTime(entry.warned_at) : formatTime(entry.warned_at);
			const meta = [issuerLabel(entry, names), when];
			if (entry.expired) {
				meta.push("expired");
			}
			const line = textElement("span", meta.join(" · "), "muted");
			line.title = formatTime(entry.warned_at);
			row.append(line);
			entries.append(row);
		}
		item.append(entries);

		if (!readOnly) {
			const remove = textElement("button", "Remove newest warning", "danger");
			remove.type = "button";
			remove.addEventListener("click", async () => {
				const confirmed = await confirmDestructive({
					title: "Remove warning?",
					message: `The newest warning of ${userLabel(names, user.user_id)} will be removed, as /rmwarn does.`,
					action: "Remove",
				});
				if (!confirmed) {
					return;
				}
				remove.disabled = true;
				try {
					const result = await api(`chats/${encodeURIComponent(chatID)}/warnings`, {
						method: "DELETE",
						body: { user_id: user.user_id },
					});
					await loadPage(true);
					haptic(result.removed ? "success" : "warning");
					status.textContent = result.removed
						? `Removed one warning for ${userLabel(names, user.user_id)}.`
						: `${userLabel(names, user.user_id)} has no warnings left.`;
				} catch (error) {
					remove.disabled = false;
					haptic("error");
					status.className = "error";
					status.textContent = errorMessage(error, "Could not remove this warning.");
				}
			});
			item.append(remove);
		}

		return item;
	}

	loadMore.addEventListener("click", () => loadPage(false));

	await loadPage(true);
}
