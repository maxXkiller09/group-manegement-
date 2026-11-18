export const DEFAULT_PROTECTION_PRESET = "balanced";

export function createProtectionSetupState() {
  return { step: 1, preset: DEFAULT_PROTECTION_PRESET };
}

export function backOneProtectionStep(state) {
  if (!state || !Number.isInteger(state.step) || state.step <= 1 || state.step > 4) {
    return false;
  }
  state.step -= 1;
  return true;
}
