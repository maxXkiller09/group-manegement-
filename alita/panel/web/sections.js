import { renderActivity } from "./screens/activity.js";
import { renderBlacklists, renderFilters, renderNotes } from "./screens/lists.js";
import { renderMembers } from "./screens/members.js";
import { renderOverview } from "./screens/overview.js";
import { renderSettings } from "./screens/settings.js";
import { renderTimeline } from "./screens/timeline.js";
import { renderWarnings } from "./screens/warnings.js";
import { renderReferrals } from "./screens/referrals.js";
import { renderCommands } from "./screens/commands.js";
export const sections=[
{key:"overview",label:"Group Overview",description:"Group health, member activity and recent actions",render:renderOverview},
{key:"settings",label:"Security Center",description:"Welcome, captcha, antiflood, locks and protection",render:renderSettings},
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