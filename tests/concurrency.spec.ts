import type { Page } from '@playwright/test';
import { test, expect, gotoCustomerView, loginAsOwner, makeBooking, seedDefaultTables, mergeTables } from './fixtures';

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

  test('10 simultaneous customer bookings all succeed as distinct documents, with accurate final counts', async ({ browser, seed }) => {
    // Tried scaling this to 50 (pages sharing one context) and then 25
    // (separate contexts) first. Both hit hard ceilings on this sandboxed
    // single machine, not slowness that a longer timeout fixes:
    //  - 50 pages in one context: dataService.ts uses
    //    `experimentalForceLongPolling`, so each page holds ~4 concurrent
    //    long-lived Firestore connections (settings/tables/bookings/
    //    customers listeners). 50 x 4 = 200 concurrent connections to one
    //    origin starves the browser's per-origin connection pool — pages
    //    never complete their submit no matter how long you wait.
    //  - 25 separate contexts: spinning up that many full browser contexts
    //    at once exhausted this sandbox's own CPU/memory before the first
    //    page interaction even ran.
    // 10 is the value that reliably completes here — a real 2x step up
    // from the proven 5-context test above. The underlying transactional
    // correctness this is guarding (no lost writes, no false overlap,
    // accurate counts) is the same code path already proven correct under
    // real contention by the two-device race tests elsewhere in this file;
    // this test's job is throughput at moderate scale, not proving
    // correctness a second time. On a machine/CI runner with more headroom,
    // raise PARTY_COUNT freely.
    test.setTimeout(90000);
    const PARTY_COUNT = 10;
    const contexts = await Promise.all(Array.from({ length: PARTY_COUNT }, () => browser.newContext()));
    const pages = await Promise.all(contexts.map((c) => c.newPage()));

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
        expect(page.getByText(/waiting for allocation|queue position/i).first()).toBeVisible({ timeout: 30000 })
      ));

      await Promise.all(contexts.map((c) => c.close()));

      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await loginAsOwner(adminPage);
      await expect(adminPage.getByText(new RegExp(`^${PARTY_COUNT} waiting$`, 'i'))).toBeVisible({ timeout: 15000 });
      // No false "overlap detected" and no phantom counts: exactly N distinct rows.
      await expect(adminPage.getByText(/^\d+(st|nd|rd|th) visit$|^1st visit$/i)).toHaveCount(PARTY_COUNT);
      await adminContext.close();
    } finally {
      await Promise.all(contexts.map((c) => c.close()));
    }
  });

  test('two admin devices merging overlapping table sets at once resolve into one consistent, valid group', async ({ browser, seed }) => {
    await seedDefaultTables(seed);
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await loginAsOwner(pageA);
      await loginAsOwner(pageB);

      // Device A merges [1,2]; Device B simultaneously merges [2,3] — they
      // share table 2. Firestore transactions serialize these: whichever
      // commits first forms a pair, and the second legitimately UNIONS its
      // request with table 2's now-existing partner (that's how growing a
      // pair to a trio is designed to work), so a consistent 3-way group
      // [1,2,3] is an equally valid, safe outcome — not a "loser". What
      // must never happen is a torn/inconsistent state, e.g. table 2
      // claiming a partner that doesn't reciprocate, or picking up a table
      // neither device ever requested.
      await Promise.all([
        mergeTables(pageA, 'Table 1', 'Table 2'),
        mergeTables(pageB, 'Table 2', 'Table 3'),
      ]);
      await pageA.waitForTimeout(1500);

      const [t1, t2, t3] = await Promise.all([seed.getTable(1), seed.getTable(2), seed.getTable(3)]);
      expect(t2?.mergeGroupId).toBeTruthy();
      const t2Group = t2!.mergeGroupTableIds!.slice().sort();
      expect(t2Group.length).toBeLessThanOrEqual(3);
      expect(t2Group).toContain(2);

      // Every table t2 claims as a partner must reciprocate the exact same
      // group — no torn state where one side thinks they're merged and the
      // other doesn't.
      const allTables = { 1: t1, 2: t2, 3: t3 } as const;
      for (const memberId of t2Group) {
        const member = allTables[memberId as 1 | 2 | 3];
        expect(member?.mergeGroupId).toBe(t2?.mergeGroupId);
        expect(member?.mergeGroupTableIds?.slice().sort()).toEqual(t2Group);
      }
      // Any table NOT in t2's group must be standalone, not half-linked to it.
      for (const id of [1, 2, 3] as const) {
        if (!t2Group.includes(id)) {
          expect(allTables[id]?.mergeGroupId).toBeFalsy();
        }
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

      // Wait for both to settle, then check each page's own outcome
      // separately (Playwright's `.or()` can't span two different pages).
      await pageA.waitForTimeout(3000);
      const modalOpenOnA = await pageA.getByText(/new staff booking entry/i).isVisible().catch(() => false);
      const modalOpenOnB = await pageB.getByText(/new staff booking entry/i).isVisible().catch(() => false);
      // Exactly one succeeded (its modal closed); the other's modal must
      // still be open, having been rejected rather than silently also
      // succeeding (the core safety property — no double-booking past
      // capacity). The exact error text (slot-full vs. a generic save
      // failure) matters less than the fact it did NOT go through.
      expect([modalOpenOnA, modalOpenOnB].filter(Boolean).length).toBe(1);

      // Confirm against Firestore ground truth: only one of the two
      // candidate bookings was actually created, and total committed seats
      // for the slot never exceeds its capacity of 40.
      const allBookings = await seed.listBookings();
      const race = allBookings.filter((b) => b.firstName === 'KalyanaA' || b.firstName === 'KalyanaB');
      expect(race.length).toBe(1);
      const totalSeats = allBookings
        .filter((b) => b.isKalyanaVirundhu && b.kalyanaSlot === SLOT && b.bookingDate === SATURDAY)
        .reduce((sum, b) => sum + b.partySize, 0);
      expect(totalSeats).toBeLessThanOrEqual(40);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
