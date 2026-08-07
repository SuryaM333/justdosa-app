/**
 * Client-side PIN attempt lockout. There is no backend to enforce this (the
 * app has no Firebase Auth — see the architecture note in firestore.rules) so
 * this is a deterrent, not a guarantee: clearing localStorage resets it. It
 * still meaningfully raises the bar over an unlimited-attempts keypad.
 */

const STORAGE_KEY = 'just_dosa_pin_lockout';
const FAIL_THRESHOLD = 5;
const COOLDOWNS_MS = [30_000, 60_000, 120_000, 300_000]; // escalates per lockout, caps at 5 min

interface LockoutState {
  failCount: number;
  lockoutTier: number;
  lockUntil: number;
}

function readState(): LockoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { failCount: 0, lockoutTier: 0, lockUntil: 0 };
    const parsed = JSON.parse(raw);
    return {
      failCount: typeof parsed.failCount === 'number' ? parsed.failCount : 0,
      lockoutTier: typeof parsed.lockoutTier === 'number' ? parsed.lockoutTier : 0,
      lockUntil: typeof parsed.lockUntil === 'number' ? parsed.lockUntil : 0,
    };
  } catch {
    return { failCount: 0, lockoutTier: 0, lockUntil: 0 };
  }
}

function writeState(state: LockoutState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage unavailable (private browsing, quota) — lockout just won't persist.
  }
}

export function getLockoutState(): { locked: boolean; remainingMs: number } {
  const state = readState();
  const remainingMs = state.lockUntil - Date.now();
  if (remainingMs > 0) {
    return { locked: true, remainingMs };
  }
  return { locked: false, remainingMs: 0 };
}

export function recordFailure(): { locked: boolean; remainingMs: number } {
  const state = readState();
  state.failCount += 1;
  if (state.failCount >= FAIL_THRESHOLD) {
    const cooldown = COOLDOWNS_MS[Math.min(state.lockoutTier, COOLDOWNS_MS.length - 1)];
    state.lockUntil = Date.now() + cooldown;
    state.lockoutTier += 1;
    state.failCount = 0;
  }
  writeState(state);
  return getLockoutState();
}

export function recordSuccess() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
