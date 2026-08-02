import { test as base, expect, type Page } from '@playwright/test';
import { initializeApp, deleteApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, type Firestore } from 'firebase/firestore';
import type { Booking, Table, Customer } from '../src/types';

export const PROJECT_ID = 'just-dosa';
export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORT = 8080;

/** Default PINs the app self-seeds on first boot (see dataService.ts migratePlaintextPins). */
export const DEFAULT_STAFF_PIN = '1357';
export const DEFAULT_OWNER_PIN = '2468';

/** Wipes all Firestore emulator data so every test starts from a clean slate. */
export async function resetEmulatorData(): Promise<void> {
  const url = `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) {
    throw new Error(`Failed to reset Firestore emulator data: ${res.status} ${await res.text()}`);
  }
}

let seedCounter = 0;

/** A short-lived Firestore client pointed at the emulator, for seeding/inspecting data directly (bypassing the app's UI). */
export class SeedClient {
  app: FirebaseApp;
  db: Firestore;

  constructor() {
    seedCounter += 1;
    this.app = initializeApp({ projectId: PROJECT_ID, apiKey: 'test-key' }, `seed-${Date.now()}-${seedCounter}`);
    this.db = getFirestore(this.app);
    connectFirestoreEmulator(this.db, EMULATOR_HOST, EMULATOR_PORT);
  }

  async setTable(table: Table): Promise<void> {
    await setDoc(doc(this.db, 'tables', table.id.toString()), table);
  }

  async setBooking(booking: Booking): Promise<void> {
    await setDoc(doc(this.db, 'bookings', booking.id), booking);
  }

  async setCustomer(customer: Customer): Promise<void> {
    const phoneKey = customer.phone.replace(/\D/g, '');
    await setDoc(doc(this.db, 'customers', phoneKey), customer);
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const snap = await getDoc(doc(this.db, 'bookings', id));
    return snap.exists() ? (snap.data() as Booking) : undefined;
  }

  async getTable(id: number): Promise<Table | undefined> {
    const snap = await getDoc(doc(this.db, 'tables', id.toString()));
    return snap.exists() ? (snap.data() as Table) : undefined;
  }

  async setSettings(partial: Record<string, any>): Promise<void> {
    await setDoc(doc(this.db, 'settings', 'global'), partial, { merge: true });
  }

  async close(): Promise<void> {
    await deleteApp(this.app);
  }
}

let bookingIdCounter = 0;
export function nextBookingId(prefix = 'bk-test'): string {
  bookingIdCounter += 1;
  return `${prefix}-${Date.now()}-${bookingIdCounter}`;
}

export function makeBooking(overrides: Partial<Booking> = {}): Booking {
  const id = overrides.id || nextBookingId();
  return {
    id,
    phone: '0412 345 678',
    firstName: 'Test',
    lastName: 'Guest',
    partySize: 2,
    childSeats: 0,
    whatsappOptIn: false,
    type: 'walk-in',
    status: 'waiting',
    createdAt: new Date().toISOString(),
    branchId: 'millpark',
    isNewAlert: true,
    ...overrides,
  };
}

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    phone: '0433 111 222',
    firstName: 'Priv',
    lastName: 'Acy',
    totalVisits: 3,
    lastVisitDate: new Date().toISOString(),
    noShowCount: 0,
    whatsappOptIn: false,
    branchId: 'millpark',
    ...overrides,
  };
}

/** The 10 default tables, matching dataService.ts INITIAL_TABLES (id/capacity/shape only — layout coords omitted, not test-relevant). */
export function defaultTable(id: number, patch: Partial<Table> = {}): Table {
  const isTwoSeater = [5, 6, 7].includes(id);
  return {
    id,
    name: `Table ${id}`,
    capacity: isTwoSeater ? 2 : 6,
    maxOverrideCapacity: isTwoSeater ? 3 : 6,
    isOccupied: false,
    isInactive: false,
    branchId: 'millpark',
    ...patch,
  };
}

/** Seeds all 10 default tables (id 1-10), with optional per-id overrides. */
export async function seedDefaultTables(seed: SeedClient, overrides: Record<number, Partial<Table>> = {}): Promise<void> {
  for (let id = 1; id <= 10; id++) {
    await seed.setTable(defaultTable(id, overrides[id] || {}));
  }
}

/**
 * Waits for the app shell to render. Firestore's long-polling listener keeps
 * a connection open forever, so 'networkidle' never fires here — wait on
 * visible content instead.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(page.getByText(/just dosa/i).first()).toBeVisible({ timeout: 15000 });
}

/**
 * Sets an active booking id in localStorage *before* the app's first script
 * runs, so CustomerView routes straight to that booking's status screen on
 * load — used to simulate a returning customer (e.g. from a saved WhatsApp
 * link) without needing to drive the booking form. Must be called before
 * navigating.
 */
export async function primeActiveBooking(page: Page, bookingId: string): Promise<void> {
  await page.addInitScript((id) => {
    window.localStorage.setItem('just_dosa_active_customer_booking_id', id);
  }, bookingId);
}

/** Navigates to '/' and, on the dual-mode build, clicks through the mode-choice screen into CustomerView, without asserting which state CustomerView lands on. */
export async function gotoCustomerViewRaw(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  const customerViewBtn = page.getByRole('button', { name: /customer view/i });
  try {
    await customerViewBtn.waitFor({ state: 'visible', timeout: 4000 });
    await customerViewBtn.click();
  } catch {
    // Already on the customer-only build (no mode-choice screen) — continue.
  }
}

/** Navigates to '/' and, on the dual-mode build, clicks through to the customer booking flow (fresh session, no active booking). */
export async function gotoCustomerView(page: Page): Promise<void> {
  await gotoCustomerViewRaw(page);
  await expect(page.getByText(/join live waitlist|book a table for later|before you book/i).first()).toBeVisible({ timeout: 10000 });
}

/** Navigates to '/' and clicks through to the Staff/Admin PIN lock screen (does not enter a PIN). */
export async function gotoAdminLogin(page: Page): Promise<void> {
  await page.goto('/');
  await waitForAppReady(page);
  const staffBtn = page.getByRole('button', { name: /staff\s*\/\s*admin/i });
  try {
    await staffBtn.waitFor({ state: 'visible', timeout: 4000 });
    await staffBtn.click();
  } catch {
    // No mode-choice screen (e.g. already an admin device) — continue.
  }
  // Intro splash auto-advances to the lock screen after ~1.8s.
  await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible({ timeout: 6000 });
}

/** Completes the PIN pad entry (assumes the 'Login' lock screen or PIN pad is already visible). */
export async function enterPin(page: Page, pin: string): Promise<void> {
  const loginBtn = page.getByRole('button', { name: /^login$/i });
  try {
    await loginBtn.waitFor({ state: 'visible', timeout: 6000 });
    await loginBtn.click();
  } catch {
    // Already on the PIN pad (e.g. re-entering after a wrong attempt) — continue.
  }
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

/**
 * Full staff login: PIN entry, then (staff role only) the "Who's working?"
 * name-selection grid that gates the dashboard until a staff member is
 * picked. Lands on the admin dashboard.
 */
export async function loginAsStaff(page: Page, opts: { pin?: string; staffName?: string } = {}): Promise<void> {
  await gotoAdminLogin(page);
  await enterPin(page, opts.pin ?? DEFAULT_STAFF_PIN);
  const staffName = opts.staffName ?? 'Amrit';
  const staffButton = page.getByRole('button', { name: staffName, exact: false });
  try {
    await staffButton.waitFor({ state: 'visible', timeout: 6000 });
    await staffButton.click();
  } catch {
    // Staff-name grid didn't appear (e.g. staff already picked in this session) — continue.
  }
  await expect(page.getByText(/just dosa restaurant management/i)).toBeVisible({ timeout: 10000 });
}

/** Full owner/manager login: PIN entry straight to the dashboard (no staff-name gate for owners). */
export async function loginAsOwner(page: Page, opts: { pin?: string } = {}): Promise<void> {
  await gotoAdminLogin(page);
  await enterPin(page, opts.pin ?? DEFAULT_OWNER_PIN);
  await expect(page.getByText(/just dosa restaurant management/i)).toBeVisible({ timeout: 10000 });
}

/**
 * Simulates the floor plan's drag-to-merge gesture with real mouse events
 * (matching the raw pointer-event drag implementation in FloorPlan.tsx —
 * not Framer Motion's `drag` prop). Locates each table card by its exact
 * visible text (its current combined name, e.g. "Table 1" or "Table 1+2"),
 * so callers must pass whatever name is currently showing at that step.
 */
export async function dragTableOnto(page: Page, fromName: string, toName: string): Promise<void> {
  const fromBox = await page.getByText(fromName, { exact: true }).boundingBox();
  const toBox = await page.getByText(toName, { exact: true }).boundingBox();
  if (!fromBox || !toBox) throw new Error(`dragTableOnto: could not locate "${fromName}" or "${toName}"`);

  const startX = fromBox.x + fromBox.width / 2;
  const startY = fromBox.y + fromBox.height / 2;
  const endX = toBox.x + toBox.width / 2;
  const endY = toBox.y + toBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 20, startY + 10, { steps: 5 }); // cross the 8px drag threshold
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
}

type Fixtures = {
  seed: SeedClient;
};

export const test = base.extend<Fixtures>({
  // Every test starts from a fully empty emulator, then gets a seed client
  // to optionally pre-populate specific bookings/tables before navigating.
  // eslint-disable-next-line no-empty-pattern
  seed: async ({}, use) => {
    await resetEmulatorData();
    const client = new SeedClient();
    await use(client);
    await client.close();
  },
});

export { expect };
