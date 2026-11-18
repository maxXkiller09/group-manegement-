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
  assert.equal(classifyGroupAccess({ role: "admin", bot_admin: true }).status, "full");
  assert.equal(classifyGroupAccess({ role: "member", bot_admin: true }).status, "limited");
  assert.equal(classifyGroupAccess({ role: "admin", bot_admin: false }).status, "bot_missing");
  assert.equal(classifyGroupAccess(null).status, "unknown");
});

test("one eligible group auto-selects only after all candidates are known", () => {
  const full = { chat: { id: "-1001" }, access: classifyGroupAccess({ role: "admin", bot_admin: true }) };
  const limited = { chat: { id: "-1002" }, access: classifyGroupAccess({ role: "member", bot_admin: true }) };
  assert.equal(singleEligibleGroup([full]), "-1001");
  assert.equal(singleEligibleGroup([full, limited]), "-1001");
  assert.equal(singleEligibleGroup([full, { chat: { id: "-1003" }, access: classifyGroupAccess(null) }]), null);
  assert.equal(singleEligibleGroup([full, { chat: { id: "-1004" }, access: { status: "checking" } }]), null);
});
