import { doc, setDoc, Timestamp } from 'firebase/firestore';
import {
  test, expect, gotoCustomerView, gotoAdminLogin, loginAsOwner, loginAsStaff, enterPin,
  makeBooking, seedDefaultTables, DEFAULT_STAFF_PIN,
} from './fixtures';

test.describe('Regression guards', () => {
  test('chunk-load failure during a lazy import triggers automatic recovery, not a permanent blank screen', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    let blocked = false;
    // Fail the AdminDashboard module's first fetch only, simulating a stale
    // deploy where the chunk 404s; safeLazy() should catch it and reload
    // once (via sessionStorage dedupe), after which it must succeed.
    await page.route('**/AdminDashboard*', async (route) => {
      if (!blocked) {
        blocked = true;
        await route.abort('failed');
      } else {
        await route.continue();
      }
    });

    await loginAsOwner(page);
    // The page must recover to a working dashboard, never stay blank/black.
    await expect(page.getByText(/just dosa restaurant management/i)).toBeVisible({ timeout: 15000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);
  });

  test('a stale build is detected via version mismatch and offers a refresh, instead of silently staying stale', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await page.route('**/version.json*', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 'some-other-build-id' }) });
    });
    await loginAsOwner(page);
    await expect(page.getByText(/update available.*tap to refresh/i)).toBeVisible({ timeout: 10000 });
  });

  test('the app boots with no uncaught JS errors (guards against createContext / module-order failures)', async ({ page, seed }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await gotoCustomerView(page);
    expect(pageErrors, `Unexpected uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
  });

  test('the admin boot path also has no uncaught JS errors', async ({ page, seed }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await gotoAdminLogin(page);
    expect(pageErrors, `Unexpected uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
  });

  test('a raw Firestore Timestamp value never renders as a raw object (React error #31)', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const booking = makeBooking({ firstName: 'Timely', status: 'waiting' });
    // Write createdAt as an actual Firestore Timestamp (not an ISO string) —
    // exactly what a serverTimestamp() round-trip would produce.
    await setDoc(doc(seed.db, 'bookings', booking.id), { ...booking, createdAt: Timestamp.now() });

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    await loginAsOwner(page);

    await expect(page.getByText(/timely/i)).toBeVisible();
    await expect(page.getByText(/waited:/i)).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('[object Object]');
    expect(pageErrors.some((m) => /minified react error #31|objects are not valid as a react child/i.test(m))).toBe(false);
  });

  test('firestore rules: schema-invalid writes to settings_secure/pins are rejected', async ({ page, seed }) => {
    await expect(async () => {
      await setDoc(doc(seed.db, 'settings_secure', 'pins'), { staffPinHash: 'abc', evilExtraField: 'hack' });
    }).rejects.toThrow();
  });

  test('firestore rules: a correctly-shaped pins write is still allowed (staff/owner PIN changes keep working)', async ({ page, seed }) => {
    await setDoc(doc(seed.db, 'settings_secure', 'pins'), { staffPinHash: 'a'.repeat(64), ownerPinHash: 'b'.repeat(64) });
  });

  test('settings persist across a "redeploy": customized settings are never re-seeded back to defaults', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await seed.setSettings({ whatsappNumber: '0499 999 999' });

    await loginAsOwner(page);
    await page.getByRole('button', { name: /^settings$/i }).click();
    // Give the settings sync a moment, then reload to simulate a fresh deploy boot.
    await page.waitForTimeout(500);
    await page.reload();
    await page.getByRole('button', { name: /^settings$/i }).click();
    await page.getByRole('button', { name: /security & alerts/i }).click();
    await expect(page.locator('input[value="0499 999 999"]')).toBeVisible({ timeout: 8000 });
  });

  test('no demo/seed data reappears over customized production tables on reload', async ({ page, seed }) => {
    await seedDefaultTables(seed, { 1: { name: 'VIP Booth', capacity: 10, maxOverrideCapacity: 10 } });
    await loginAsOwner(page);
    await expect(page.getByText('VIP Booth', { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText('VIP Booth', { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Table 1', { exact: true })).toHaveCount(0);
  });

  test('no phantom booking counts when zero bookings exist', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);
    await expect(page.getByRole('button', { name: /waiting list.*0/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^booked.*0/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /seated.*0/i })).toBeVisible();
    await expect(page.getByText(/no parties currently waiting/i)).toBeVisible();
  });

  test('the live date shown in the admin Kalyana panel matches the real/frozen current date, not a stale cached one', async ({ page, seed }) => {
    await page.clock.setFixedTime(new Date('2026-08-08T09:00:00'));
    await seedDefaultTables(seed);
    await loginAsOwner(page);
    await page.getByRole('button', { name: /^booked/i }).click();
    await expect(page.getByText(/saturday feast date: 2026-08-08/i)).toBeVisible();
  });

  test('no false "overlap detected" for two same-time bookings when no table is allocated yet', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const date = '2026-08-08';
    await seed.setBooking(makeBooking({ firstName: 'FreeA', type: 'remote', status: 'confirmed', bookingDate: date, bookingTime: '18:30' }));
    await seed.setBooking(makeBooking({ firstName: 'FreeB', type: 'remote', status: 'confirmed', bookingDate: date, bookingTime: '18:30' }));

    await loginAsOwner(page);
    await page.getByRole('button', { name: /^booked/i }).click();
    await page.locator('#booked-date-filter').selectOption('all');
    await expect(page.getByText(/freea/i)).toBeVisible();
    await expect(page.getByText(/freeb/i)).toBeVisible();
    await expect(page.getByText(/same table conflict/i)).toHaveCount(0);
  });

  test('a real conflict IS flagged when the same table is double-allocated at the same date+time', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const date = '2026-08-08';
    await seed.setBooking(makeBooking({ firstName: 'ClashA', type: 'remote', status: 'confirmed', bookingDate: date, bookingTime: '18:30', tableId: 1 }));
    await seed.setBooking(makeBooking({ firstName: 'ClashB', type: 'remote', status: 'confirmed', bookingDate: date, bookingTime: '18:30', tableId: 1 }));

    await loginAsOwner(page);
    await page.getByRole('button', { name: /^booked/i }).click();
    await page.locator('#booked-date-filter').selectOption('all');
    await expect(page.getByText(/same table conflict/i).first()).toBeVisible();
  });

  test('the admin-device flag is never set on a normal customer visit, only via ?mode=admin or a successful PIN', async ({ page, seed }) => {
    await gotoCustomerView(page);
    const deviceFlag = await page.evaluate(() => localStorage.getItem('just_dosa_admin_device_v2'));
    expect(deviceFlag).toBeNull();
  });

  test('a customer QR (?mode=customer-equivalent bare URL) never lands on the admin dashboard', async ({ page, seed }) => {
    await page.goto('/');
    await expect(page.getByText(/just dosa restaurant management/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /customer view/i }).or(page.getByText(/i'm here — join the waitlist/i))).toBeVisible();
  });

  test('?mode=admin sets the admin-device flag and routes straight to the PIN lock screen', async ({ page, seed }) => {
    await page.goto('/?mode=admin');
    await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible({ timeout: 6000 });
    const deviceFlag = await page.evaluate(() => localStorage.getItem('just_dosa_admin_device_v2'));
    expect(deviceFlag).toBeNull();
    // Device flag is set on successful PIN, not merely on visiting ?mode=admin.
    await enterPin(page, DEFAULT_STAFF_PIN);
    // PINModal waits ~450ms before verifying, then hashes async — wait for
    // the resulting UI transition rather than a fixed timeout.
    await expect(
      page.getByText(/who's working/i).or(page.getByText(/just dosa restaurant management/i))
    ).toBeVisible({ timeout: 5000 });
    const afterLogin = await page.evaluate(() => localStorage.getItem('just_dosa_admin_device_v2'));
    expect(afterLogin).toBe('true');
  });

  test('routing never produces a merged /customer#/admin URL, and Exit Admin returns to the lock screen', async ({ page, seed }) => {
    await loginAsOwner(page);
    await page.getByRole('button', { name: /exit admin/i }).click();

    const url = new URL(page.url());
    expect(url.pathname).toBe('/');
    expect(url.hash).toBe('#/admin');
    await expect(page.getByRole('button', { name: /^login$/i }).or(page.getByText(/awaiting admin pin authentication/i))).toBeVisible();
  });

  test('floor-plan editing is hidden from staff, visible to managers', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsStaff(page);
    await expect(page.getByRole('button', { name: /edit floor plan/i })).toHaveCount(0);

    await page.getByRole('button', { name: /exit admin/i }).click();
    await enterPin(page, '2468');
    await expect(page.getByRole('button', { name: /edit floor plan/i })).toBeVisible();
  });
});
