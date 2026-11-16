// Telegram Mini App bootstrap: initData auth header and JSON API helper.
// Data is rendered through DOM APIs only; never innerHTML.

export const telegram = window.Telegram?.WebApp ?? null;
export const initData = telegram?.initData ?? "";

export class ApiError extends Error {
	constructor(code, message, status, payload = null) {
		super(message);
		this.name = "ApiError";
		this.code = code;
		this.status = status;
		this.payload = payload;
	}
}

export async function api(path, { method = "GET", body } = {}) {
	const headers = { "X-Telegram-Init-Data": initData };
	if (method !== "GET") {
		headers["Content-Type"] = "application/json";
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 15000);
	let response;
	let payload = null;
	try {
		response = await fetch(`/panel/api/v1/${path.replace(/^\/+/, "")}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: "omit",
			cache: "no-store",
			signal: controller.signal,
		});
		try {
			payload = await response.json();
		} catch (error) {
			if (controller.signal.aborted) throw error;
			payload = null;
		}
	} catch (error) {
		if (controller.signal.aborted) {
			throw new ApiError("timeout", "The request took too long. Please try again.", 0);
		}
		throw error;
	} finally {
		clearTimeout(timeout);
	}

	if (!response.ok) {
		const detail = payload?.error ?? {};
		throw new ApiError(detail.code ?? "http_error", detail.message ?? `Request failed (${response.status})`, response.status, payload);
	}
	return payload;
}
