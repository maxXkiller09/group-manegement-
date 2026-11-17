import { renderActivity } from "./screens/activity.js?v=2026.11.16-bootfix1";
import { renderBlacklists, renderFilters, renderNotes } from "./screens/lists.js?v=2026.11.16-bootfix1";
import { renderMembers } from "./screens/members.js?v=2026.11.16-bootfix1";
import { renderOverview } from "./screens/overview.js?v=2026.11.16-bootfix1";
import { renderSettings } from "./screens/settings.js?v=2026.11.16-bootfix1";
import { renderTimeline } from "./screens/timeline.js?v=2026.11.16-bootfix1";
import { renderWarnings } from "./screens/warnings.js?v=2026.11.16-bootfix1";
import { renderReferrals } from "./screens/referrals.js?v=2026.11.16-bootfix1";
import { renderProtectionSetup } from "./screens/protection-setup.js?v=2026.11.17-backstack1";
import { renderCommands } from "./screens/commands.js?v=2026.11.17-backstack1";
export const sections=[
{key:"overview",label:"Group Overview",description:"Group health, member activity and recent actions",render:renderOverview},
{key:"settings",label:"Security Center",description:"Welcome, captcha, antiflood, locks and protection",render:renderSettings},
{key:"protection-setup",label:"Protection Setup",description:"Apply a reviewed protection preset",render:renderProtectionSetup},
{key:"warnings",label:"Moderation",description:"Warnings and member moderation",render:renderWarnings,adminOnly:true},
{key:"commands",label:"All Commands",description:"Simple guide to commands and quick actions",render:renderCommands},
{key:"filters",label:"Content Tools · Filters",description:"Automatic keyword replies",render:renderFilters},
{key:"blacklists",label:"Content Tools · Blacklists",description:"Blocked words and automatic actions",render:renderBlacklists},
{key:"notes",label:"Content Tools · Notes",description:"Saved messages for members",render:renderNotes},
{key:"activity",label:"Activity & Analytics",description:"Busiest hours and member growth",render:renderActivity},
{key:"timeline",label:"Moderation History",description:"Ban, kick, mute and unban audit trail",render:renderTimeline,adminOnly:true},
{key:"members",label:"Top Members",description:"Most active tracked members",render:renderMembers,adminOnly:true},
{key:"referrals",label:"Referrals",description:"Tracked invite links and inviters",render:renderReferrals,adminOnly:true},
];