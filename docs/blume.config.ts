import { defineConfig } from "blume";

// NexGuard documentation site configuration.
// See https://useblume.dev/docs/configuration for the full reference.
export default defineConfig({
	title: "NexGuard",
	description:
		"NexGuard — Smart Protection. Better Communities. A Telegram group management bot with moderation, anti-spam protection, CAPTCHA, automation, analytics, and a mobile-friendly Mini App.",
	logo: { image: "/favicon.svg", text: "NexGuard" },
	github: { owner: "maxXkiller09", repo: "group-manegement-" },

	content: { root: "src/content/docs" },
	// Keep the currently configured docs hosting URL until a NexGuard domain is configured.
	deployment: { site: "https://alita-docs.divkix.me" },

	agents: { llmsTxt: true },
	seo: {
		og: { enabled: true },
		sitemap: true,
		robots: true,
		structuredData: true,
	},
	navigation: { sidebar: { display: "group" } },
});
