import type { Page } from '@playwright/test';
import { test, expect, gotoCustomerView, loginAsOwner, makeBooking, seedDefaultTables, dragTableOnto } from './fixtures';

async function acceptWalkInConditions(page: Page) {
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^continue$/i }).click();
}

test.describe('Concurrency / load', () => {
  test('multiple simultaneous walk-in bookings all land correctly, with no lost writes and accurate counts', async ({ browser, seed }) => {
    // Driving 5 full browser contexts through a form + submit concurrently
    // is inherently heavier than a single-page test; give it more room,
    // especially when running as part of the full suite under load.
    test.setTimeout(60000);
    const PARTY_COUNT = 5;
    const contexts = await Promise.all(Array.from({ length: PARTY_COUNT }, () => browser.newContext()));
    const pages = await Promise.all(contexts.map((c) => c.newPage()));

    try {
      // Drive all N customers up to (but not past) the submit button first,
      // so the actual writes race each other as closely as possible.
      await Promise.all(pages.map(async (page, i) => {
        await gotoCustomerView(page);
        await acceptWalkInConditions(page);
        await page.getByPlaceholder('e.g. Chandra Bharath').fill(`Guest${i}`);
        await page.getByPlaceholder('e.g. Suryababu').fill('Concurrent');
        await page.getByPlaceholder('0412 345 678').fill(`041234${(1000 + i).toString().slice(-4)}`);
      }));

      await Promise.all(pages.map((page) => page.getByRole('button', { name: /join live waitlist/i }).click()));

      await Promise.all(pages.map((page) =>
        expect(page.getByText(/waiting for allocation|queue position/i).first()).toBeVisible({ timeout: 15000 })
      ));

      // Free up the 5 customer browser instances (and their background
      // Firestore listeners/polling) before opening a 6th for admin
      // verification, so it isn't starved for CPU under a heavy test run.
      await Promise.all(contexts.map((c) => c.close()));

      // Verify server-side truth: all 5 distinct bookings exist, none lost or merged.
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await loginAsOwner(adminPage);
      await expect(adminPage.getByText(new RegExp(`^${PARTY_COUNT} waiting$`, 'i'))).toBeVisible({ timeout: 10000 });
      for (let i = 0; i < PARTY_COUNT; i++) {
        await expect(adminPage.getByText(`Guest${i} Concurrent`, { exact: true })).toBeVisible();
      }
      await adminContext.close();
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

  test('two admin devices allocating the same table at once: no double-booking, no lost update', async ({ browser, seed }) => {
    await seedDefaultTables(seed);
    const bookingA = makeBooking({ firstName: 'RaceA', status: 'waiting', partySize: 2 });
    const bookingB = makeBooking({ firstName: 'RaceB', status: 'waiting', partySize: 2 });
    await seed.setBooking(bookingA);
    await seed.setBooking(bookingB);

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAsOwner(pageA);
      await loginAsOwner(pageB);

      // Each "device" selects a different waiting party (RaceA was seeded
      // first, so it's queue position #1 / the first "Select to Seat"
      // button; RaceB is #2), then both tap the SAME vacant table (Table 1)
      // at the same instant.
      await pageA.getByRole('button', { name: /select to seat/i }).nth(0).click();
      await pageB.getByRole('button', { name: /select to seat/i }).nth(1).click();

      await Promise.all([
        pageA.getByText('Table 1', { exact: true }).click(),
        pageB.getByText('Table 1', { exact: true }).click(),
      ]);

      // Give both optimistic-update + Firestore transaction round-trips time to settle.
      await pageA.waitForTimeout(2000);

      // Assert against authoritative Firestore state directly, rather than
      // chasing client-side re-render timing on either "device": exactly one
      // booking must be 'seated' at table 1, the other must remain 'waiting',
      // and table 1 must point at exactly that one booking (no lost update,
      // no double-booking, no orphaned reference).
      const [finalA, finalB, finalTable1] = await Promise.all([
        seed.getBooking(bookingA.id),
        seed.getBooking(bookingB.id),
        seed.getTable(1),
      ]);

      const statuses = [finalA?.status, finalB?.status].sort();
      expect(statuses).toEqual(['seated', 'waiting']);
      expect(finalTable1?.isOccupied).toBe(true);
      const seatedBooking = finalA?.status === 'seated' ? finalA : finalB;
      expect(finalTable1?.currentBookingId).toBe(seatedBooking?.id);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('50 simultaneous customer bookings all succeed as distinct documents, with accurate final counts', async ({ browser, seed }) => {
    test.setTimeout(120000);
    const PARTY_COUNT = 50;
    // 50 pages sharing one browser context (not 50 separate contexts) — far
    // lighter on this machine while still exercising 50 independent booking
    // submissions racing the same Firestore emulator.
    const context = await browser.newContext();
    const pages = await Promise.all(Array.from({ length: PARTY_COUNT }, () => context.newPage()));

    try {
      await Promise.all(pages.map(async (page, i) => {
        await gotoCustomerView(page);
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: /^continue$/i }).click();
        await page.getByPlaceholder('e.g. Chandra Bharath').fill(`Load${i}`);
        await page.getByPlaceholder('e.g. Suryababu').fill('Test');
        await page.getByPlaceholder('0412 345 678').fill(`04${(20000000 + i).toString().slice(0, 8)}`);
      }));

      await Promise.all(pages.map((page) => page.getByRole('button', { name: /join live waitlist/i }).click()));
      await Promise.all(pages.map((page) =>
        expect(page.getByText(/waiting for allocation|queue position/i).first()).toBeVisible({ timeout: 20000 })
      ));

      await Promise.all(pages.map((p) => p.close()));

      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await loginAsOwner(adminPage);
      await expect(adminPage.getByText(new RegExp(`^${PARTY_COUNT} waiting$`, 'i'))).toBeVisible({ timeout: 15000 });
      // No false "overlap detected" and no phantom counts: exactly 50 distinct rows.
      await expect(adminPage.getByText(/^\d+(st|nd|rd|th) visit$|^1st visit$/i)).toHaveCount(PARTY_COUNT);
      await adminContext.close();
    } finally {
      await context.close();
    }
  });

  test('two admin devices merging overlapping table sets at once: only one merge succeeds', async ({ browser, seed }) => {
    await seedDefaultTables(seed);
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAsOwner(pageA);
      await loginAsOwner(pageB);

      // Device A merges [1,2]; Device B simultaneously merges [2,3] — they
      // share table 2, so at most one of these can win.
      await Promise.all([
        dragTableOnto(pageA, 'Table 1', 'Table 2'),
        dragTableOnto(pageB, 'Table 2', 'Table 3'),
      ]);
      await pageA.waitForTimeout(1500);

      const [t1, t2, t3] = await Promise.all([seed.getTable(1), seed.getTable(2), seed.getTable(3)]);
      // Table 2 belongs to exactly one consistent group, never both.
      expect(t2?.mergeGroupId).toBeTruthy();
      const t2Group = t2!.mergeGroupTableIds!.slice().sort();
      if (t2Group.includes(1)) {
        expect(t2Group).toEqual([1, 2]);
        expect(t1?.mergeGroupId).toBe(t2?.mergeGroupId);
        expect(t3?.mergeGroupId).toBeFalsy();
      } else {
        expect(t2Group).toEqual([2, 3]);
        expect(t3?.mergeGroupId).toBe(t2?.mergeGroupId);
        expect(t1?.mergeGroupId).toBeFalsy();
      }
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('two staff simultaneously booking the last Kalyana Virundhu seats: exactly one succeeds', async ({ browser, seed }) => {
    await seedDefaultTables(seed);
    const SATURDAY = '2026-08-08';
    const SLOT = 'Slot 1: 11:00am-12:30pm';
    // Capacity is 40 by default; pre-book 38 so only 2 seats remain — two
    // staff each trying to add a party of 2 can't both fit.
    await seed.setBooking(makeBooking({
      firstName: 'Filler', status: 'confirmed', type: 'remote', partySize: 38,
      bookingDate: SATURDAY, bookingTime: SLOT, isKalyanaVirundhu: true, kalyanaSlot: SLOT,
    }));

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    async function fillKalyanaManualBooking(page: Page, name: string) {
      await loginAsOwner(page);
      await page.getByRole('button', { name: /\+ new booking/i }).click();
      await page.locator('input[type="date"]').fill(SATURDAY);
      await page.getByRole('button', { name: /kalyana virundhu/i }).click();
      await page.getByText(SLOT, { exact: false }).click();
      await page.getByPlaceholder('e.g. Priya').fill(name);
    }

    try {
      await fillKalyanaManualBooking(pageA, 'KalyanaA');
      await fillKalyanaManualBooking(pageB, 'KalyanaB');

      await Promise.all([
        pageA.getByRole('button', { name: /^create booking$/i }).click(),
        pageB.getByRole('button', { name: /^create booking$/i }).click(),
      ]);

      // One page shows success (modal closes), the other shows the fully-booked error.
      await expect(
        pageA.getByText(/new staff booking entry/i).or(pageB.getByText(/new staff booking entry/i))
      ).toHaveCount(1, { timeout: 10000 });
      await expect(
        pageA.getByText(/slot just filled up|fully booked/i).or(pageB.getByText(/slot just filled up|fully booked/i))
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
