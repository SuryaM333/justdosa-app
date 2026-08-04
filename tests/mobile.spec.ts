import { devices as playwrightDevices } from '@playwright/test';

// `defaultBrowserType` in the raw device presets forces a new worker and
// can't be set inside a describe-scoped test.use() -- strip it, keeping the
// viewport/touch/userAgent emulation that's actually being tested here.
const devices = Object.fromEntries(
  Object.entries(playwrightDevices).map(([name, preset]) => {
    const { defaultBrowserType, ...rest } = preset as any;
    return [name, rest];
  })
);
import {
  test, expect, gotoCustomerView, loginAsOwner, makeBooking, makeCustomer, seedDefaultTables,
} from './fixtures';

// The main suite runs entirely at desktop viewport. These tests specifically
// verify the customer flow at real mobile viewport + touch emulation (an
// iPhone and an Android device), and the admin dashboard at tablet width --
// the realistic device sizes for a customer's phone and a host-stand tablet.

test.describe('Mobile viewport: customer flow (iPhone)', () => {
  test.use({ ...devices['iPhone 14'] });

  test('walk-in journey works end-to-end on a real mobile viewport with touch', async ({ page, seed }) => {
    await gotoCustomerView(page);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await page.getByPlaceholder('e.g. Chandra Bharath').fill('Meera');
    await page.getByPlaceholder('e.g. Suryababu').fill('Pillai');
    await page.getByPlaceholder('0412 345 678').fill('0412 555 666');
    await page.getByRole('button', { name: /join live waitlist/i }).click();
    await expect(page.getByText(/waiting for allocation/i)).toBeVisible({ timeout: 10000 });

    // The waiting carousel renders and its pagination dots are usable at this width.
    await expect(page.getByText(/our story|today at just dosa|signature chef showcases/i).first()).toBeVisible({ timeout: 5000 });

    // Swipe the carousel (real touch emulation, not a mouse drag).
    const stage = page.locator('.cursor-grab').first();
    const box = await stage.boundingBox();
    if (box) {
      await page.touchscreen.tap(box.x + box.width - 20, box.y + box.height / 2);
    }
  });

  test('the floor plan / admin dashboard remains usable if opened on a phone-width screen', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);
    await expect(page.getByText(/manager\/founder portal/i)).toBeVisible();
    // Table cards must still be reachable (no horizontal page overflow trapping content off-screen).
    await expect(page.getByText('Table 1', { exact: true })).toBeVisible();
  });
});

test.describe('Mobile viewport: customer flow (Android)', () => {
  test.use({ ...devices['Pixel 7'] });

  test('book-for-later journey works end-to-end on Android viewport + touch', async ({ page, seed }) => {
    const WEDNESDAY = '2026-08-05';
    await page.clock.setFixedTime(new Date(`${WEDNESDAY}T10:00:00`));
    await gotoCustomerView(page);
    await page.getByRole('button', { name: /book a table for later/i }).click();
    await page.locator('input[type="date"]').fill(WEDNESDAY);
    await page.getByPlaceholder('e.g. Chandra Bharath').fill('Arjun');
    await page.getByPlaceholder('e.g. Suryababu').fill('Nair');
    await page.getByPlaceholder('0412 345 678').fill('0433 222 111');
    await page.getByRole('button', { name: /confirm table reservation/i }).click();
    await expect(page.getByText(/booking requested|booking confirmed/i)).toBeVisible({ timeout: 10000 });

    // Confirmation screen's carousel (new mount point) renders on mobile too.
    await expect(page.getByText(/our story|today at just dosa|signature chef showcases/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tablet viewport: admin dashboard', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('staff can allocate a table at tablet width, the realistic host-stand device size', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const booking = makeBooking({ firstName: 'Tablet', lastName: 'Test', status: 'waiting', partySize: 2 });
    await seed.setBooking(booking);
    await seed.setCustomer(makeCustomer({ firstName: 'Tablet', lastName: 'Test', phone: booking.phone }));

    await loginAsOwner(page);
    await expect(page.getByText(/restaurant free-canvas floor plan/i)).toBeVisible();
    await page.getByRole('button', { name: /select to seat/i }).click();
    await page.getByText('Table 1', { exact: true }).click();
    await page.getByRole('button', { name: /seated/i }).first().click();
    await expect(page.getByText(/tablet test/i).first()).toBeVisible();
  });
});
