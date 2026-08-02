import { test, expect, gotoAdminLogin, enterPin, loginAsStaff, loginAsOwner, makeBooking, makeCustomer, seedDefaultTables, defaultTable, DEFAULT_STAFF_PIN, DEFAULT_OWNER_PIN } from './fixtures';

test.describe('Admin / staff flow', () => {
  test.describe('PIN login', () => {
    test('staff PIN resolves to the Staff Portal (service mode)', async ({ page, seed }) => {
      await loginAsStaff(page);
      await expect(page.getByText(/staff portal \(service mode\)/i)).toBeVisible();
      await expect(page.getByText(/manager\/founder portal/i)).toHaveCount(0);
    });

    test('owner PIN resolves to the Manager/Founder Portal with full access', async ({ page, seed }) => {
      await loginAsOwner(page);
      await expect(page.getByText(/manager\/founder portal \(full access\)/i)).toBeVisible();
      // Settings tab is owner-only.
      await expect(page.getByRole('button', { name: /settings/i })).toBeVisible();
    });

    test('an incorrect PIN is rejected with an explicit error, not silently accepted', async ({ page, seed }) => {
      await gotoAdminLogin(page);
      await enterPin(page, '0000');
      await expect(page.getByText(/access denied.*incorrect pin/i)).toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/just dosa restaurant management/i)).toHaveCount(0);
    });

    test('the PIN value itself is never rendered as visible text', async ({ page, seed }) => {
      await gotoAdminLogin(page);
      await page.getByRole('button', { name: /^login$/i }).click();
      for (const digit of DEFAULT_STAFF_PIN) {
        await page.getByRole('button', { name: digit, exact: true }).click();
        await expect(page.getByText(DEFAULT_STAFF_PIN, { exact: true })).toHaveCount(0);
      }
    });
  });

  test('allocating a table seats a waiting party and marks the table occupied', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const booking = makeBooking({ firstName: 'Deepa', status: 'waiting', partySize: 4 });
    await seed.setBooking(booking);

    await loginAsOwner(page);
    await page.getByRole('button', { name: /select to seat/i }).click();
    await expect(page.getByText(/selected \(tap table/i)).toBeVisible();

    // Table 1 (capacity 6) fits a party of 4.
    await page.getByText('Table 1', { exact: true }).click();

    await expect(page.getByText(/selecting table for/i)).toHaveCount(0);
    // Booking moves out of the waiting list once seated.
    await expect(page.getByText(/no parties currently waiting/i)).toBeVisible();
    await page.getByRole('button', { name: /seated/i }).first().click();
    await expect(page.getByText(/deepa/i).first()).toBeVisible();
  });

  test('walk-in quick seat: seating directly from a vacant table works without a prior booking', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await page.getByText('Table 3', { exact: true }).click();
    await expect(page.getByText(/quick seat — table 3/i)).toBeVisible();
    await page.getByPlaceholder('e.g., Rajesh').fill('Walk-In Test');
    await page.getByRole('button', { name: /seat party now/i }).click();

    await expect(page.getByText(/quick seat — table 3/i)).toHaveCount(0);
    await page.getByRole('button', { name: /seated/i }).first().click();
    await expect(page.getByText(/walk-in test/i).first()).toBeVisible();
  });

  test('finishing a seated party frees the table immediately, with no timer wait', async ({ page, seed }) => {
    const booking = makeBooking({
      firstName: 'Karthik', status: 'seated', tableId: 2,
      seatedAt: new Date().toISOString(),
    });
    await seed.setBooking(booking);
    await seedDefaultTables(seed, { 2: { isOccupied: true, currentBookingId: booking.id } });

    await loginAsOwner(page);
    await page.getByText('Table 2', { exact: true }).click();
    await expect(page.getByText(/table 2 details/i)).toBeVisible();
    await page.getByRole('button', { name: /mark party finished/i }).click();

    // No confirmation dialog, no delay: the table shows Available right away.
    await expect(page.getByText('Table 2', { exact: true })).toBeVisible();
    await expect(page.getByText(/^available$/i).first()).toBeVisible({ timeout: 3000 });
  });

  test('day rollover auto-finishes a stale seated party left over from a previous day', async ({ page, seed }) => {
    // Use explicit UTC ('Z') timestamps throughout and a wide (48h) gap so
    // the "stale" determination is unambiguous regardless of the test
    // machine's local timezone offset (a naive vs. explicit-UTC mismatch
    // here previously made the gap look like only ~4h instead of 48h).
    await page.clock.setFixedTime(new Date('2026-08-06T10:00:00Z'));
    const staleBooking = makeBooking({
      firstName: 'Yesterday',
      status: 'seated',
      tableId: 4,
      createdAt: '2026-08-04T09:00:00.000Z',
      seatedAt: '2026-08-04T10:00:00.000Z',
    });
    await seed.setBooking(staleBooking);
    await seedDefaultTables(seed, { 4: { isOccupied: true, currentBookingId: staleBooking.id } });

    await loginAsOwner(page);
    // The rollover toast appears ~2s after mount and stays up for 5s; give
    // this a generous window since it can shift under system load when the
    // full suite runs many browser instances back-to-back.
    await expect(page.getByText(/cleared 1 table/i)).toBeVisible({ timeout: 15000 });
  });

  // Table merging is now a drag gesture — see tests/merge.spec.ts for full
  // drag-to-merge coverage (2-table, 3-table, unmerge, finish-dissolves, etc).

  test('extra-chair override seats a party that exceeds a 2-seater\'s standard capacity', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const booking = makeBooking({ firstName: 'Overflow', status: 'waiting', partySize: 3 });
    await seed.setBooking(booking);

    await loginAsOwner(page);
    await page.getByRole('button', { name: /select to seat/i }).click();
    // Table 5 is a 2-seater with maxOverrideCapacity 3 (+1 chair override).
    await page.getByText('Table 5', { exact: true }).click();

    await expect(page.getByText(/override table 5 capacity/i)).toBeVisible();
    await page.getByRole('button', { name: /confirm \+1 override/i }).click();

    await expect(page.getByText(/override table 5 capacity/i)).toHaveCount(0);
    await page.getByRole('button', { name: /seated/i }).first().click();
    await expect(page.getByText(/overflow/i).first()).toBeVisible();
  });

  test('all 10 tables render, including Table 7 and tables with legacy/missing layout fields', async ({ page, seed }) => {
    // defaultTable() never sets x/y/position (legacy shape) -- every seeded
    // table here relies purely on FloorPlan's fallback coordinate normalizer.
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    for (let id = 1; id <= 10; id++) {
      await expect(page.getByText(`Table ${id}`, { exact: true })).toBeVisible();
    }
    // Table 7 must be active/selectable, never silently skipped or inactive.
    await expect(page.getByText(/blocked/i)).toHaveCount(0);
  });

  test('manual/phone staff booking is confirmed instantly, without pending review', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await page.getByRole('button', { name: /\+ new booking/i }).click();
    await expect(page.getByText(/new staff booking entry/i)).toBeVisible();
    await page.getByPlaceholder('e.g. Priya').fill('Manual Guest');
    await page.getByRole('button', { name: /^create booking$/i }).click();

    await expect(page.getByText(/new staff booking entry/i)).toHaveCount(0);
    await page.getByRole('button', { name: /booked/i }).click();
    await expect(page.getByText(/manual guest/i)).toBeVisible();
    // Manual bookings skip pending review and are confirmed instantly.
    await expect(page.getByText(/^confirmed$/i)).toBeVisible();
    await expect(page.getByText(/staff phone booking/i)).toBeVisible();
  });

  test('customer data view (manager role): full PII visible + CSV export available', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await seed.setCustomer(makeCustomer());
    await loginAsOwner(page);
    await page.getByRole('button', { name: /customer data/i }).click();
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
    await expect(page.getByText(/staff mode \(restricted data\)/i)).toHaveCount(0);
    await expect(page.getByText('0433 111 222')).toBeVisible();
  });

  test('customer data view (staff role): phone/last-visit are masked, no export', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await seed.setCustomer(makeCustomer());
    await loginAsStaff(page);
    await page.getByRole('button', { name: /customer data/i }).click();

    await expect(page.getByText(/staff mode \(restricted data\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).toHaveCount(0);
    await expect(page.getByText('0433 111 222')).toHaveCount(0);
    await expect(page.getByText(/manager access required/i).first()).toBeVisible();
    await expect(page.getByText(/total visits: 3/i)).toBeVisible();
  });
});
