import type { Page } from '@playwright/test';
import {
  test, expect, gotoCustomerView, loginAsOwner, loginAsStaff, enterPin, DEFAULT_OWNER_PIN,
  makeBooking, makeCustomer, seedDefaultTables, mergeTables,
} from './fixtures';

// Fixed reference dates (shared with the rest of the suite):
//   2026-08-04 = Tuesday   (closed all day)
//   2026-08-05 = Wednesday (dinner-only: 17:30-22:00, 30-min closing buffer)
//   2026-08-08 = Saturday  (lunch + dinner, Kalyana Virundhu available)
const TUESDAY = '2026-08-11';
const WEDNESDAY = '2026-08-05';
const SATURDAY = '2026-08-08';

// Several journeys below drag tables in the bottom row (8/9/10). At the
// default 1280x720 viewport that row sits right at the fold, so a source
// and target read+drag can straddle a scroll boundary and land on stale
// coordinates (observed: dragging Table 9 onto Table 10 instead merged 9
// into Table 6's group). A taller viewport keeps the whole floor plan
// visible at once, matching how a real desktop/tablet screen renders it.
test.use({ viewport: { width: 1280, height: 1600 } });

async function acceptWalkInConditions(page: Page) {
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^continue$/i }).click();
}

async function joinWaitlist(page: Page, firstName: string, lastName: string, phone: string) {
  await gotoCustomerView(page);
  await acceptWalkInConditions(page);
  await page.getByPlaceholder('e.g. Chandra Bharath').fill(firstName);
  await page.getByPlaceholder('e.g. Suryababu').fill(lastName);
  await page.getByPlaceholder('0412 345 678').fill(phone);
  await page.getByRole('button', { name: /join live waitlist/i }).click();
  await expect(page.getByText(/waiting for allocation|queue position/i).first()).toBeVisible({ timeout: 10000 });
}

test.describe('Full customer + staff journeys', () => {
  test('1. Walk-in journey: agree-gate -> queue -> staff allocates -> live update -> seat -> finish, verified on both screens', async ({ browser, seed }) => {
    await seedDefaultTables(seed);
    const customerCtx = await browser.newContext();
    const staffCtx = await browser.newContext();
    const customerPage = await customerCtx.newPage();
    const staffPage = await staffCtx.newPage();

    try {
      await joinWaitlist(customerPage, 'Aishwarya', 'Reddy', '0423 556 781');

      // Staff logs in and sees the new party show up live in the waiting list.
      await loginAsStaff(staffPage);
      await expect(staffPage.getByText(/aishwarya reddy/i)).toBeVisible({ timeout: 10000 });

      // Staff allocates a table (party of 2 -> any standard table fits).
      await staffPage.getByRole('button', { name: /select to seat/i }).click();
      await staffPage.getByText('Table 8', { exact: true }).click();

      // The customer's own screen updates live — no reload.
      await expect(customerPage.getByText(/welcome to just dosa, aishwarya/i)).toBeVisible({ timeout: 10000 });
      await expect(customerPage.getByText('Table 8', { exact: true })).toBeVisible();

      // Staff sees the party under Seated.
      await staffPage.getByRole('button', { name: /seated/i }).first().click();
      await expect(staffPage.getByText(/aishwarya/i).first()).toBeVisible();

      // Staff finishes the party — table frees immediately.
      await staffPage.getByText('Table 8', { exact: true }).click();
      await staffPage.getByRole('button', { name: /mark party finished/i }).click();
      await expect(staffPage.getByText('Table 8', { exact: true })).toBeVisible();
      await expect(staffPage.getByText(/^available$/i).first()).toBeVisible({ timeout: 3000 });

      const finalTable = await seed.getTable(8);
      expect(finalTable?.isOccupied).toBe(false);
      expect(finalTable?.currentBookingId).toBeFalsy();

      // The customer's screen reflects the finish too.
      await expect(customerPage.getByText(/thank you for dining with us, aishwarya/i)).toBeVisible({ timeout: 10000 });
    } finally {
      await customerCtx.close();
      await staffCtx.close();
    }
  });

  test('2. Book-for-later journey: books ahead -> manager confirms live -> arrives -> seated -> finished, verified on both screens', async ({ browser, seed }) => {
    await seedDefaultTables(seed);
    const customerCtx = await browser.newContext();
    const staffCtx = await browser.newContext();
    const customerPage = await customerCtx.newPage();
    const staffPage = await staffCtx.newPage();
    await customerPage.clock.setFixedTime(new Date(`${WEDNESDAY}T10:00:00`));

    try {
      await gotoCustomerView(customerPage);
      await customerPage.getByRole('button', { name: /book a table for later/i }).click();
      await customerPage.locator('input[type="date"]').fill(WEDNESDAY);
      await customerPage.getByPlaceholder('e.g. Chandra Bharath').fill('Nikhil');
      await customerPage.getByPlaceholder('e.g. Suryababu').fill('Varma');
      await customerPage.getByPlaceholder('0412 345 678').fill('0433 987 654');
      await customerPage.getByRole('button', { name: /confirm table reservation/i }).click();
      await expect(customerPage.getByText(/booking requested/i)).toBeVisible({ timeout: 10000 });

      await loginAsOwner(staffPage);
      await staffPage.getByRole('button', { name: /^booked/i }).click();
      await staffPage.locator('#booked-date-filter').selectOption('all');
      await expect(staffPage.getByText(/nikhil varma/i)).toBeVisible();
      await staffPage.getByRole('button', { name: /^confirm$/i }).click();

      // Customer sees the confirmation live, no reload.
      await expect(customerPage.getByText(/booking confirmed/i)).toBeVisible({ timeout: 10000 });

      // Guest arrives: staff moves the confirmed reservation into the live walk-in queue.
      await staffPage.getByRole('button', { name: /arrived/i }).click();
      await staffPage.getByRole('button', { name: /waiting list/i }).click();
      await expect(staffPage.getByText(/nikhil/i)).toBeVisible();

      // The customer's still-open confirmation tab must follow the booking onto the live queue screen.
      await expect(customerPage.getByText(/waiting for allocation/i)).toBeVisible({ timeout: 10000 });

      await staffPage.getByRole('button', { name: /select to seat/i }).click();
      await staffPage.getByText('Table 3', { exact: true }).click();
      await expect(customerPage.getByText(/welcome to just dosa, nikhil/i)).toBeVisible({ timeout: 10000 });
      await expect(customerPage.getByText('Table 3', { exact: true })).toBeVisible();

      await staffPage.getByText('Table 3', { exact: true }).click();
      await staffPage.getByRole('button', { name: /mark party finished/i }).click();
      await expect(customerPage.getByText(/thank you for dining with us, nikhil/i)).toBeVisible({ timeout: 10000 });

      const bookings = await seed.listBookings();
      const nikhil = bookings.find((b) => b.firstName === 'Nikhil');
      expect(nikhil?.status).toBe('finished');
      expect(nikhil?.type).toBe('remote'); // type is permanent metadata; only status progresses.
    } finally {
      await customerCtx.close();
      await staffCtx.close();
    }
  });

  test.describe('3. Random date/day coverage: accept/reject is correct for every case', () => {
    test('a normal in-hours weekday slot is accepted end-to-end', async ({ page, seed }) => {
      await page.clock.setFixedTime(new Date(`${WEDNESDAY}T10:00:00`));
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      await page.locator('input[type="date"]').fill(WEDNESDAY);
      await page.getByPlaceholder('e.g. Chandra Bharath').fill('Karan');
      await page.getByPlaceholder('e.g. Suryababu').fill('Malhotra');
      await page.getByPlaceholder('0412 345 678').fill('0411 222 987');
      await page.getByRole('button', { name: /confirm table reservation/i }).click();
      await expect(page.getByText(/booking requested|booking confirmed/i)).toBeVisible({ timeout: 10000 });

      const bookings = await seed.listBookings();
      expect(bookings.some((b) => b.firstName === 'Karan')).toBe(true);
    });

    test('a weekend lunch slot (Saturday, non-Kalyana) is accepted end-to-end', async ({ page, seed }) => {
      await page.clock.setFixedTime(new Date(`${SATURDAY}T09:00:00`));
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      await page.locator('input[type="date"]').fill(SATURDAY);
      // Saturday defaults to the Kalyana menu type; switch back to the regular menu to reach the normal date/time picker.
      await page.getByRole('button', { name: /^regular menu$/i }).click();
      await page.getByPlaceholder('e.g. Chandra Bharath').fill('Sneha');
      await page.getByPlaceholder('e.g. Suryababu').fill('Pillai');
      await page.getByPlaceholder('0412 345 678').fill('0411 333 555');
      await page.getByRole('button', { name: /confirm table reservation/i }).click();
      await expect(page.getByText(/booking requested|booking confirmed/i)).toBeVisible({ timeout: 10000 });

      const bookings = await seed.listBookings();
      expect(bookings.some((b) => b.firstName === 'Sneha')).toBe(true);
    });

    test('Tuesday is rejected: submission is blocked and no booking is created', async ({ page, seed }) => {
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      await page.locator('input[type="date"]').fill(TUESDAY);
      await expect(page.getByText(/we're closed on tuesdays/i)).toBeVisible();
      await page.getByPlaceholder('e.g. Chandra Bharath').fill('Rejected');
      await page.getByPlaceholder('e.g. Suryababu').fill('Tuesday');
      await page.getByPlaceholder('0412 345 678').fill('0411 444 555');
      await expect(page.getByRole('button', { name: /confirm table reservation/i })).toBeDisabled();

      const bookings = await seed.listBookings();
      expect(bookings.some((b) => b.firstName === 'Rejected')).toBe(false);
    });

    test('a past date is rejected: no slots are offered and submission is blocked', async ({ page, seed }) => {
      // Freeze "now" on WEDNESDAY and try to book the Wednesday exactly one
      // week earlier -- same open day-type (dinner-only, isolating "in the
      // past" as the actual rejection reason, not a closed-day coincidence
      // or the Saturday/Kalyana-menu-type default complicating the picker).
      await page.clock.setFixedTime(new Date(`${WEDNESDAY}T10:00:00`));
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      const pastWednesday = '2026-07-29';
      const dateInput = page.locator('input[type="date"]');
      await dateInput.fill(pastWednesday);
      await expect(page.getByText(/no times available for this day/i)).toBeVisible();

      await page.getByPlaceholder('e.g. Chandra Bharath').fill('Past');
      await page.getByPlaceholder('e.g. Suryababu').fill('Date');
      await page.getByPlaceholder('0412 345 678').fill('0411 777 888');
      await page.getByRole('button', { name: /confirm table reservation/i }).click();
      // Two independent layers both reject this: the native `min` constraint
      // blocks the form's own submit event outright (shown as a browser
      // validation bubble, not app UI, so not assertable via text), and even
      // if that layer were bypassed, handleSubmit's own slot re-check would
      // reject it too (covered by the near-midnight test above). Either way
      // the observable, durable outcome is the same: no booking gets created.
      await expect(dateInput).toHaveJSProperty('validity.valid', false);

      const bookings = await seed.listBookings();
      expect(bookings.some((b) => b.firstName === 'Past')).toBe(false);
    });

    test('near-midnight (after the closing buffer has fully passed): no slots offered, and a stale time cannot sneak a booking through', async ({ page, seed }) => {
      // 11:58 PM on the Wednesday under test -- dinner (17:30-22:00, 30-min
      // buffer) closed for new bookings hours ago, but the picker's default
      // bookingTime state was set earlier in the session and is now stale.
      await page.clock.setFixedTime(new Date(`${WEDNESDAY}T23:58:00`));
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      await page.locator('input[type="date"]').fill(WEDNESDAY);
      await expect(page.getByText(/no times available for this day/i)).toBeVisible();

      await page.getByPlaceholder('e.g. Chandra Bharath').fill('Midnight');
      await page.getByPlaceholder('e.g. Suryababu').fill('Guest');
      await page.getByPlaceholder('0412 345 678').fill('0411 555 666');
      await page.getByRole('button', { name: /confirm table reservation/i }).click();
      await expect(page.getByText(/that time is no longer available/i)).toBeVisible({ timeout: 5000 });

      const bookings = await seed.listBookings();
      expect(bookings.some((b) => b.firstName === 'Midnight')).toBe(false);
    });

    test('the last bookable slot before the closing buffer still succeeds end-to-end', async ({ page, seed }) => {
      // Dinner ends 22:00 with a 30-min buffer -> last slot is 9:30 PM. Freeze
      // "now" just before it so it's still offered and selected by default.
      await page.clock.setFixedTime(new Date(`${WEDNESDAY}T21:16:00`));
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      await page.locator('input[type="date"]').fill(WEDNESDAY);
      await expect(page.getByText('9:30 PM', { exact: true })).toHaveCount(1);

      await page.getByPlaceholder('e.g. Chandra Bharath').fill('LastSlot');
      await page.getByPlaceholder('e.g. Suryababu').fill('Guest');
      await page.getByPlaceholder('0412 345 678').fill('0411 666 777');
      await page.getByRole('button', { name: /confirm table reservation/i }).click();
      await expect(page.getByText(/booking requested|booking confirmed/i)).toBeVisible({ timeout: 10000 });

      const bookings = await seed.listBookings();
      const b = bookings.find((x) => x.firstName === 'LastSlot');
      expect(b?.bookingTime).toBe('21:30');
    });
  });

  test('4. Crowd / merge journey: a party of 12 and a party of 8 are merge-seated, then finished and un-merged; a changed-mind merge is un-merged before allocation', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const bigParty = makeBooking({ firstName: 'Govindarajan', lastName: 'Family', phone: '0412 000 111', status: 'waiting', partySize: 12 });
    const midParty = makeBooking({ firstName: 'Chandrasekhar', lastName: 'Group', phone: '0412 000 222', status: 'waiting', partySize: 8 });
    await seed.setBooking(bigParty);
    await seed.setBooking(midParty);

    await loginAsOwner(page);

    // Party of 12 -> merge two 6-seaters (Tables 1+2 = 12p exactly).
    await mergeTables(page, 'Table 1', 'Table 2');
    await expect(page.getByText('Table 1+2', { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /select to seat/i }).nth(0).click();
    await page.getByText('Table 1+2', { exact: true }).click();
    await expect(page.getByText(/govindarajan/i).first()).toBeVisible({ timeout: 5000 });
    // allocateTable updates the UI optimistically before its Firestore
    // transaction actually resolves, so "Govindarajan" can appear before
    // selection-mode has really cleared -- wait for that explicitly, or the
    // next merge below starts while selectedWaitingBooking is still set,
    // which the Merge trigger is hidden for.
    await expect(page.getByText(/selecting table for/i)).toHaveCount(0);

    // Party of 8 -> merge two more 6-seaters (Tables 9+10 = 12p, comfortably fits 8).
    await mergeTables(page, 'Table 9', 'Table 10');
    await expect(page.getByText('Table 9+10', { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /select to seat/i }).click();
    await page.getByText('Table 9+10', { exact: true }).click();
    await expect(page.getByText(/chandrasekhar/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/selecting table for/i)).toHaveCount(0);
    // Let the two prior merge/allocate actions' layout (snap-together)
    // animations fully settle before starting a third merge -- under load
    // those animations can still be consuming rAF cycles.
    await page.waitForTimeout(500);

    // Changed their mind: start merging two untouched vacant tables, then un-merge before ever allocating.
    await mergeTables(page, 'Table 5', 'Table 6');
    await expect(page.getByText('Table 5+6', { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /unmerge/i }).click();
    await expect(page.getByText('Table 5', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Table 6', { exact: true })).toBeVisible();
    const t5 = await seed.getTable(5);
    expect(t5?.mergeGroupId).toBeFalsy();
    expect(t5?.isOccupied).toBe(false);

    // Finish both merged parties -> tables separate back to their own individual vacant states.
    await page.getByRole('button', { name: /seated/i }).first().click();
    await expect(page.getByText(/govindarajan/i).first()).toBeVisible();
    await expect(page.getByText(/chandrasekhar/i).first()).toBeVisible();

    await page.getByText('Table 1+2', { exact: true }).click();
    await page.getByRole('button', { name: /mark party finished/i }).click();
    await page.getByText('Table 9+10', { exact: true }).click();
    await page.getByRole('button', { name: /mark party finished/i }).click();

    await expect(page.getByText('Table 1', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Table 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Table 9', { exact: true })).toBeVisible();
    await expect(page.getByText('Table 10', { exact: true })).toBeVisible();
    await expect(page.getByText('Table 1+2', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Table 9+10', { exact: true })).toHaveCount(0);

    for (const id of [1, 2, 5, 6, 9, 10]) {
      const t = await seed.getTable(id);
      expect(t?.mergeGroupId, `table ${id} should be unmerged`).toBeFalsy();
      expect(t?.isOccupied, `table ${id} should be vacant`).toBe(false);
    }
  });

  test('5. Concurrency journey: simultaneous customers plus two staff devices merging/allocating at once stay consistent, and each customer sees their own correct live outcome', async ({ browser, seed }) => {
    test.setTimeout(60000);
    await seedDefaultTables(seed);

    const names: [string, string][] = [['Meera', '0411222333'], ['Arjun', '0422333444'], ['Divya', '0433444555']];
    const customerContexts = await Promise.all(names.map(() => browser.newContext()));
    const customerPages = await Promise.all(customerContexts.map((c) => c.newPage()));

    const staffCtxA = await browser.newContext();
    const staffCtxB = await browser.newContext();
    const staffA = await staffCtxA.newPage();
    const staffB = await staffCtxB.newPage();

    try {
      await Promise.all(customerPages.map(async (page, i) => {
        await gotoCustomerView(page);
        await acceptWalkInConditions(page);
        await page.getByPlaceholder('e.g. Chandra Bharath').fill(names[i][0]);
        await page.getByPlaceholder('e.g. Suryababu').fill('Concurrent');
        await page.getByPlaceholder('0412 345 678').fill(names[i][1]);
      }));
      await Promise.all(customerPages.map((page) => page.getByRole('button', { name: /join live waitlist/i }).click()));
      await Promise.all(customerPages.map((page) =>
        expect(page.getByText(/waiting for allocation|queue position/i).first()).toBeVisible({ timeout: 15000 })
      ));

      await loginAsOwner(staffA);
      await loginAsOwner(staffB);

      // Device A merges two untouched tables while Device B, at the same instant,
      // allocates a different vacant table to the first waiting party.
      await Promise.all([
        mergeTables(staffA, 'Table 9', 'Table 10'),
        (async () => {
          await staffB.getByRole('button', { name: /select to seat/i }).first().click();
          await staffB.getByText('Table 1', { exact: true }).click();
        })(),
      ]);
      await staffA.waitForTimeout(1500);

      const t9 = await seed.getTable(9);
      const t10 = await seed.getTable(10);
      expect(t9?.mergeGroupId).toBeTruthy();
      expect(t9?.mergeGroupId).toBe(t10?.mergeGroupId);
      expect(t9?.isOccupied).toBe(false); // merging never seats anyone

      const allBookings = await seed.listBookings();
      const seatedOnes = allBookings.filter((b) => b.status === 'seated');
      expect(seatedOnes.length).toBe(1); // exactly the one Device B allocated -- no cross-talk, no lost/duplicated writes
      const seatedName = seatedOnes[0].firstName;

      for (let i = 0; i < names.length; i++) {
        if (names[i][0] === seatedName) {
          await expect(customerPages[i].getByText(new RegExp(`welcome to just dosa, ${names[i][0]}`, 'i'))).toBeVisible({ timeout: 10000 });
        } else {
          await expect(customerPages[i].getByText(/waiting for allocation/i)).toBeVisible();
        }
      }
    } finally {
      await Promise.all([...customerContexts, staffCtxA, staffCtxB].map((c) => c.close()));
    }
  });

  test('6. Staff vs manager journey: staff sees only the restricted views, manager has full access, within one continuous session', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await seed.setCustomer(makeCustomer({ firstName: 'Ramesh', lastName: 'Iyer', phone: '0444 555 666', totalVisits: 4 }));

    await loginAsStaff(page);
    await expect(page.getByText(/staff portal \(service mode\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^settings$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /edit floor plan/i })).toHaveCount(0);

    await page.getByRole('button', { name: /customer data/i }).click();
    await expect(page.getByText(/staff mode \(restricted data\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).toHaveCount(0);
    await expect(page.getByText('0444 555 666')).toHaveCount(0);
    await expect(page.getByText(/manager access required/i).first()).toBeVisible();
    await expect(page.getByText(/total visits: 4/i)).toBeVisible();

    // Same session, now as manager: full access unlocks. `Exit Admin` is a
    // client-side transition straight to the PIN lock screen (no reload), so
    // just enter the owner PIN directly rather than loginAsOwner (which does
    // its own page.goto('/') and would collide with this SPA navigation).
    await page.getByRole('button', { name: /exit admin/i }).click();
    await enterPin(page, DEFAULT_OWNER_PIN);
    await expect(page.getByText(/manager\/founder portal \(full access\)/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^settings$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /edit floor plan/i })).toBeVisible();

    await page.getByRole('button', { name: /customer data/i }).click();
    await expect(page.getByText(/staff mode \(restricted data\)/i)).toHaveCount(0);
    await expect(page.getByText('0444 555 666')).toBeVisible();
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });

  test('7. Full-service simulation: a realistic busy shift never breaks, never loses data, and stays live-synced throughout', async ({ page, browser, seed }) => {
    test.setTimeout(60000);
    await seedDefaultTables(seed);

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await seed.setBooking(makeBooking({ firstName: 'Suresh', lastName: 'Pillai', phone: '0455 111 222', status: 'pending', type: 'remote', bookingDate: SATURDAY, bookingTime: '18:00' }));
    await seed.setBooking(makeBooking({ firstName: 'Meenal', lastName: 'Joshi', phone: '0455 222 333', status: 'pending', type: 'remote', bookingDate: SATURDAY, bookingTime: '19:00' }));
    await seed.setBooking(makeBooking({ firstName: 'Arvind', lastName: 'Rao', phone: '0455 333 444', status: 'confirmed', type: 'remote', bookingDate: SATURDAY, bookingTime: '20:00' }));

    // Two real walk-ins arrive through the customer app on their own devices.
    const walkinCtx1 = await browser.newContext();
    const walkinCtx2 = await browser.newContext();
    const walkin1 = await walkinCtx1.newPage();
    const walkin2 = await walkinCtx2.newPage();

    try {
      await joinWaitlist(walkin1, 'Lakshmi', 'Narayanan', '0466 111 222');
      await joinWaitlist(walkin2, 'Vikram', 'Chandran', '0466 222 333');

      await loginAsOwner(page);
      // Only the 2 real walk-ins count as "waiting" -- the 3 seeded remote
      // bookings are pending/confirmed reservations, a separate queue.
      await expect(page.getByText(/^2 waiting$/i)).toBeVisible({ timeout: 10000 });

      // Process the booked-ahead reservations.
      await page.getByRole('button', { name: /^booked/i }).click();
      await page.locator('#booked-date-filter').selectOption('all');
      await expect(page.getByText(/suresh pillai/i)).toBeVisible();
      // Suresh (18:00) and Meenal (19:00) are both pending -> both show a
      // Confirm button; Suresh's booking (seeded/sorted first) is .first().
      await page.getByRole('button', { name: /^confirm$/i }).first().click();
      await expect(page.getByText(/^confirmed$/i).first()).toBeVisible();
      await page.getByRole('button', { name: /decline outright/i }).click();
      await expect(page.getByText(/^declined$/i)).toBeVisible();
      // Suresh (now confirmed, 18:00) and Arvind (confirmed, 20:00) both show
      // a No-Show button; Arvind's is the one that should end up no-show, so
      // target .last() -- Suresh must stay confirmed per the final assertions.
      await page.getByRole('button', { name: /no-show/i }).last().click();
      await expect(page.getByText(/no-show/i).first()).toBeVisible();

      // A walk-in changes their mind and leaves the queue.
      await page.getByRole('button', { name: /waiting list/i }).click();
      await expect(page.getByText(/vikram/i)).toBeVisible();
      await page.getByTitle(/remove from queue/i).last().click();
      await expect(page.getByText(/vikram/i)).toHaveCount(0);
      await expect(page.getByText(/^1 waiting$/i)).toBeVisible({ timeout: 5000 });

      // Merge two small tables and quick-seat a fresh walk-in directly onto the combined unit.
      await mergeTables(page, 'Table 5', 'Table 6');
      await expect(page.getByText('Table 5+6', { exact: true })).toBeVisible({ timeout: 5000 });
      await page.getByText('Table 5+6', { exact: true }).click();
      await expect(page.getByText(/quick seat — table 5\+6/i)).toBeVisible();
      await page.getByPlaceholder('e.g., Rajesh').fill('Sundaram Party');
      await page.getByRole('button', { name: /seat party now/i }).click();
      await expect(page.getByText(/quick seat — table 5\+6/i)).toHaveCount(0);

      // Allocate the one remaining real waiting party.
      await page.getByRole('button', { name: /select to seat/i }).click();
      await page.getByText('Table 1', { exact: true }).click();

      await page.getByRole('button', { name: /seated/i }).first().click();
      await expect(page.getByText(/lakshmi/i).first()).toBeVisible();
      await expect(page.getByText(/sundaram party/i).first()).toBeVisible();

      // Finish both seated parties.
      await page.getByText('Table 1', { exact: true }).click();
      await page.getByRole('button', { name: /mark party finished/i }).click();
      await page.getByText('Table 5+6', { exact: true }).click();
      await page.getByRole('button', { name: /mark party finished/i }).click();

      await expect(page.getByText('Table 5', { exact: true })).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Table 6', { exact: true })).toBeVisible();
      // The floor plan reflects finishSeatedParty's optimistic local update
      // instantly; give its actual Firestore batch write a moment to commit
      // before reading ground truth directly (a fresh SeedClient read
      // bypasses the app's local cache entirely, so it can otherwise race
      // ahead of the real write that the UI's optimistic state is masking).
      await page.waitForTimeout(1000);

      // Final ground-truth accounting: nothing lost, nothing double-counted.
      const finalTables = await Promise.all([1, 5, 6].map((id) => seed.getTable(id)));
      for (const t of finalTables) {
        expect(t?.isOccupied).toBe(false);
        expect(t?.mergeGroupId).toBeFalsy();
      }
      const finalBookings = await seed.listBookings();
      expect(finalBookings.find((b) => b.firstName === 'Suresh')?.status).toBe('confirmed');
      expect(finalBookings.find((b) => b.firstName === 'Meenal')?.status).toBe('declined');
      expect(finalBookings.find((b) => b.firstName === 'Arvind')?.status).toBe('no-show');
      expect(finalBookings.find((b) => b.firstName === 'Vikram')?.status).toBe('cancelled');
      expect(finalBookings.find((b) => b.firstName === 'Lakshmi')?.status).toBe('finished');
      expect(finalBookings.find((b) => b.firstName === 'Sundaram Party')?.status).toBe('finished');

      expect(pageErrors).toEqual([]);
    } finally {
      await walkinCtx1.close();
      await walkinCtx2.close();
    }
  });
});
