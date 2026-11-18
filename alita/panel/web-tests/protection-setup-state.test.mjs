import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PROTECTION_PRESET,
  backOneProtectionStep,
  createProtectionSetupState,
} from "../web/preset-state.mjs";
import { classifyGroupAccess, singleEligibleGroup } from "../web/group-access.mjs";

test("first Protection Setup render starts with Balanced selected", () => {
  const state = createProtectionSetupState();
  assert.equal(DEFAULT_PROTECTION_PRESET, "balanced");
  assert.equal(state.preset, "balanced");
  assert.equal(state.step, 1);
});

test("Back moves one step and preserves the selected preset", () => {
  const state = createProtectionSetupState();
  state.preset = "strict";
  state.step = 3;
  assert.equal(backOneProtectionStep(state), true);
  assert.equal(state.step, 2);
  assert.equal(state.preset, "strict");
  assert.equal(backOneProtectionStep(state), true);
  assert.equal(state.step, 1);
  assert.equal(state.preset, "strict");
  assert.equal(backOneProtectionStep(state), false);
});

test("only a verified admin with a bot admin is selectable", () => {
  const full = classifyGroupAccess({
    role: "admin", bot_admin: true, rights_known: true,
    can_restrict_members: true, bot_can_restrict_members: true,
  });
  const limitedAdmin = classifyGroupAccess({
    role: "admin", bot_admin: true, rights_known: true,
    can_restrict_members: false, bot_can_restrict_members: true,
  });
  const member = classifyGroupAccess({ role: "member", bot_admin: true });
  assert.equal(full.status, "full");
  assert.equal(full.selectable, true);
  assert.equal(limitedAdmin.status, "limited");
  assert.equal(limitedAdmin.selectable, true);
  assert.equal(member.status, "limited");
  assert.equal(member.selectable, false);
  assert.equal(classifyGroupAccess({ role: "admin", bot_admin: false, bot_rights_known: true }).status, "bot_missing");
  assert.equal(classifyGroupAccess({ role: "admin", bot_admin: false, bot_rights_known: false }).status, "unknown");
  assert.equal(classifyGroupAccess(null).status, "unknown");
});

test("one eligible group auto-selects only after all candidates are known", () => {
  const full = { chat: { id: "-1001" }, access: classifyGroupAccess({
    role: "admin", bot_admin: true, rights_known: true,
    can_restrict_members: true, bot_can_restrict_members: true,
  }) };
  const limitedAdmin = { chat: { id: "-1002" }, access: classifyGroupAccess({
    role: "admin", bot_admin: true, rights_known: true,
    can_restrict_members: false, bot_can_restrict_members: true,
  }) };
  const member = { chat: { id: "-1003" }, access: classifyGroupAccess({ role: "member", bot_admin: true }) };
  assert.equal(singleEligibleGroup([full]), "-1001");
  assert.equal(singleEligibleGroup([limitedAdmin, member]), "-1002");
  assert.equal(singleEligibleGroup([full, limitedAdmin]), null);
  assert.equal(singleEligibleGroup([full, { chat: { id: "-1004" }, access: classifyGroupAccess(null) }]), null);
  assert.equal(singleEligibleGroup([full, { chat: { id: "-1005" }, access: { status: "checking" } }]), null);
});
