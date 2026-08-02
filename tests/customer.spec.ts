import { test, expect, gotoCustomerView, gotoCustomerViewRaw, primeActiveBooking, makeBooking, defaultTable } from './fixtures';

// Fixed reference dates used across date/time-sensitive tests:
//   2026-08-04 = Tuesday (restaurant closed all day)
//   2026-08-05 = Wednesday (dinner-only: 17:30-22:00, buffer 30 min)
//   2026-08-08 = Saturday (lunch+dinner, Kalyana Virundhu available)
const WEDNESDAY = '2026-08-05';
const TUESDAY_AFTER = '2026-08-11'; // first Tuesday on/after the Wednesday above
const SATURDAY = '2026-08-08';

async function acceptWalkInConditions(page: import('@playwright/test').Page) {
  await expect(page.getByText(/before you book/i)).toBeVisible();
  const continueBtn = page.getByRole('button', { name: /^continue$/i });
  await expect(continueBtn).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(continueBtn).toBeEnabled();
  await continueBtn.click();
}

test.describe('Customer flow', () => {
  test('landing loads and offers walk-in / book-for-later choices', async ({ page, seed }) => {
    await gotoCustomerView(page);
    await expect(page.getByText(/i'm here — join the waitlist/i)).toBeVisible();
    await expect(page.getByText(/book a table for later/i)).toBeVisible();
  });

  test('agree-gate blocks the walk-in form until conditions are accepted', async ({ page, seed }) => {
    await gotoCustomerView(page);
    await expect(page.getByPlaceholder('e.g. Chandra Bharath')).not.toBeVisible();
    await acceptWalkInConditions(page);
    await expect(page.getByPlaceholder('e.g. Chandra Bharath')).toBeVisible();
  });

  test('walk-in waitlist booking: submitting the form joins the live queue', async ({ page, seed }) => {
    await gotoCustomerView(page);
    await acceptWalkInConditions(page);

    await page.getByPlaceholder('e.g. Chandra Bharath').fill('Priya');
    await page.getByPlaceholder('e.g. Suryababu').fill('Kumar');
    await page.getByPlaceholder('0412 345 678').fill('0412345678');
    await page.getByRole('button', { name: /join live waitlist/i }).click();

    await expect(page.getByText(/waiting for allocation|queue position/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('book-for-later: Tuesday is shown as closed and cannot be booked', async ({ page, seed }) => {
    await gotoCustomerView(page);
    await page.getByRole('button', { name: /book a table for later/i }).click();
    await page.locator('input[type="date"]').fill(TUESDAY_AFTER);
    await expect(page.getByText(/we're closed on tuesdays/i)).toBeVisible();
    await expect(page.getByText(/closed tuesdays/i)).toBeVisible();
  });

  test('book-for-later: today\'s slots never include already-passed times (future-only)', async ({ page, seed }) => {
    // Freeze "now" at 8:00 PM on the Wednesday under test (dinner service 17:30-22:00).
    await page.clock.setFixedTime(new Date(`${WEDNESDAY}T20:00:00`));
    await gotoCustomerView(page);
    await page.getByRole('button', { name: /book a table for later/i }).click();
    await page.locator('input[type="date"]').fill(WEDNESDAY);

    // Past dinner times relative to the frozen 8:00 PM "now" must never appear.
    await expect(page.getByText('6:00 PM', { exact: true })).toHaveCount(0);
    await expect(page.getByText('7:00 PM', { exact: true })).toHaveCount(0);
    await expect(page.getByText('8:00 PM', { exact: true })).toHaveCount(0);
    // The next bookable slot after "now" must be present.
    await expect(page.getByText('8:15 PM', { exact: true })).toHaveCount(1);
  });

  test('book-for-later: the closing buffer trims the last bookable slot', async ({ page, seed }) => {
    // Freeze "now" early in the day so only the end-of-service buffer (not
    // the future-only filter) constrains which slots appear.
    await page.clock.setFixedTime(new Date(`${WEDNESDAY}T09:00:00`));
    await gotoCustomerView(page);
    await page.getByRole('button', { name: /book a table for later/i }).click();
    await page.locator('input[type="date"]').fill(WEDNESDAY);

    // Dinner ends 22:00 with a 30-minute buffer -> last slot is 9:30 PM.
    await expect(page.getByText('9:30 PM', { exact: true })).toHaveCount(1);
    await expect(page.getByText('9:45 PM', { exact: true })).toHaveCount(0);
    await expect(page.getByText('10:00 PM', { exact: true })).toHaveCount(0);
  });

  test('Kalyana Virundhu on Saturday is call/WhatsApp-only, not online-bookable', async ({ page, seed }) => {
    await gotoCustomerView(page);
    await page.getByRole('button', { name: /book a table for later/i }).click();
    await page.locator('input[type="date"]').fill(SATURDAY);
    await expect(page.getByRole('button', { name: /kalyana virundhu/i })).toBeVisible();
    await page.getByRole('button', { name: /kalyana virundhu/i }).click();

    await expect(page.getByText(/for kalyana virundhu feast bookings, please contact our staff/i)).toBeVisible();
    // The regular online booking form/submission must not be offered for this path.
    await expect(page.getByRole('button', { name: /confirm table reservation/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /call/i }).or(page.getByRole('button', { name: /call/i }))).toBeVisible();
  });

  test('live booking status updates without a page refresh', async ({ page, seed }) => {
    const booking = makeBooking({ status: 'waiting', firstName: 'Ravi', type: 'walk-in' });
    await seed.setBooking(booking);
    await seed.setTable({
      id: 1, name: 'Table 1', capacity: 6, maxOverrideCapacity: 6,
      isOccupied: false, isInactive: false, branchId: 'millpark',
    } as any);

    await primeActiveBooking(page, booking.id);
    await gotoCustomerViewRaw(page);

    await expect(page.getByText(/waiting for allocation/i)).toBeVisible({ timeout: 10000 });

    // Staff allocates the table directly in Firestore — the customer tab
    // must reflect this live via its onSnapshot listener, no reload.
    await seed.setBooking({ ...booking, status: 'seated', tableId: 1, seatedAt: new Date().toISOString() });

    await expect(page.getByText(/welcome to just dosa, ravi/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Table 1', { exact: true })).toBeVisible();
  });

  test('an active booking survives a page refresh', async ({ page, seed }) => {
    const booking = makeBooking({ status: 'waiting', firstName: 'Anita', type: 'walk-in' });
    await seed.setBooking(booking);

    await primeActiveBooking(page, booking.id);
    await gotoCustomerViewRaw(page);
    await expect(page.getByText(/waiting for allocation/i)).toBeVisible({ timeout: 10000 });

    await page.reload();

    await expect(page.getByText(/waiting for allocation/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/anita/i)).toBeVisible();
  });

  test('an expired session shows the Session Expired screen', async ({ page, seed }) => {
    const booking = makeBooking({ status: 'expired', firstName: 'Old', type: 'walk-in' });
    await seed.setBooking(booking);

    await primeActiveBooking(page, booking.id);
    await gotoCustomerViewRaw(page);

    // 'expired' isn't in the auto-route list, so the customer lands on the
    // main screen with an "active booking" banner and must tap through.
    await expect(page.getByText(/you have an active booking/i)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /view status/i }).click();

    await expect(page.getByText(/session expired/i)).toBeVisible({ timeout: 10000 });
  });

  test.describe('form validation', () => {
    test('walk-in: name is required before submitting', async ({ page, seed }) => {
      await gotoCustomerView(page);
      await acceptWalkInConditions(page);
      // Whitespace satisfies the native HTML `required` attribute so the
      // form actually submits to the app's own JS validation, which trims
      // and rejects it — leaving the fields fully empty would only ever
      // trigger the browser's native tooltip instead.
      await page.getByPlaceholder('e.g. Chandra Bharath').fill(' ');
      await page.getByPlaceholder('e.g. Suryababu').fill(' ');
      await page.getByPlaceholder('0412 345 678').fill('0412345678');
      await page.getByRole('button', { name: /join live waitlist/i }).click();
      await expect(page.getByText(/please enter both first and last name/i)).toBeVisible();
    });

    test('walk-in: an invalid Australian mobile number is rejected', async ({ page, seed }) => {
      await gotoCustomerView(page);
      await acceptWalkInConditions(page);
      await page.getByPlaceholder('e.g. Chandra Bharath').fill('Test');
      await page.getByPlaceholder('e.g. Suryababu').fill('User');
      await page.getByPlaceholder('0412 345 678').fill('12345');
      await page.getByRole('button', { name: /join live waitlist/i }).click();
      await expect(page.getByText(/please enter a valid australian mobile number/i)).toBeVisible();
    });

    test('book-for-later: adults/children steppers respect min/max and reveal high-chair questions', async ({ page, seed }) => {
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      await page.locator('input[type="date"]').fill(WEDNESDAY);

      // Default is 2 adults; one click reaches the floor of 1, and the
      // button must then disable rather than going any lower.
      const adultsMinus = page.getByRole('button', { name: '-', exact: true }).first();
      await adultsMinus.click();
      await expect(page.getByText(/^1 Adult$/)).toBeVisible();
      await expect(adultsMinus).toBeDisabled();

      // Add 2 children -> two per-child high-chair questions appear.
      const childrenPlus = page.getByRole('button', { name: '+', exact: true }).nth(1);
      await childrenPlus.click();
      await childrenPlus.click();
      await expect(page.getByText('Child #1: Needs High Chair?')).toBeVisible();
      await expect(page.getByText('Child #2: Needs High Chair?')).toBeVisible();
    });

    test('book-for-later: allergy/notes section is collapsed by default and expands on click', async ({ page, seed }) => {
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      await page.locator('input[type="date"]').fill(WEDNESDAY);

      await expect(page.getByPlaceholder(/allergies/i)).not.toBeVisible();
      await page.getByText(/\+ add allergies, dietary preferences or special notes/i).click();
      await expect(page.getByText(/quick notes & special requests/i)).toBeVisible();
    });

    test('book-for-later: WhatsApp opt-in is unchecked by default', async ({ page, seed }) => {
      await gotoCustomerView(page);
      await page.getByRole('button', { name: /book a table for later/i }).click();
      await page.locator('input[type="date"]').fill(WEDNESDAY);
      await expect(page.getByLabel(/send me offers and updates on whatsapp/i)).not.toBeChecked();
    });
  });

  test.describe('post-allocation / confirmation screens', () => {
    test('View Menu button appears only once allocated, with the table\'s ordering URL', async ({ page, seed }) => {
      const booking = makeBooking({ status: 'waiting', firstName: 'Menu', type: 'walk-in' });
      await seed.setBooking(booking);
      await seed.setTable(defaultTable(1, { orderingUrl: 'https://example.com/order?table=1' }));

      await primeActiveBooking(page, booking.id);
      await gotoCustomerViewRaw(page);
      await expect(page.getByText(/waiting for allocation/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('link', { name: /view menu/i })).toHaveCount(0);

      await seed.setBooking({ ...booking, status: 'seated', tableId: 1, seatedAt: new Date().toISOString() });
      await expect(page.getByRole('link', { name: /view menu/i })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('link', { name: /view menu/i })).toHaveAttribute('href', 'https://example.com/order?table=1');
    });

    test('Table 6/7 show an ask-staff note instead of a View Menu link', async ({ page, seed }) => {
      const booking = makeBooking({
        status: 'seated', firstName: 'NoMenu', type: 'walk-in', tableId: 6, seatedAt: new Date().toISOString(),
      });
      await seed.setBooking(booking);
      await seed.setTable(defaultTable(6));

      await primeActiveBooking(page, booking.id);
      await gotoCustomerViewRaw(page);

      await expect(page.getByRole('link', { name: /view menu/i })).toHaveCount(0);
      await expect(page.getByText(/please ask our staff for the menu/i)).toBeVisible({ timeout: 10000 });
    });

    test('a confirmed remote booking offers request-change and cancel', async ({ page, seed }) => {
      const booking = makeBooking({
        status: 'confirmed', firstName: 'Remote', type: 'remote',
        bookingDate: WEDNESDAY, bookingTime: '19:00',
      });
      await seed.setBooking(booking);

      await primeActiveBooking(page, booking.id);
      await gotoCustomerViewRaw(page);
      await expect(page.getByText(/booking confirmed/i)).toBeVisible({ timeout: 10000 });

      await page.getByText(/request a change/i).click();
      await expect(page.getByPlaceholder(/can we change to 7:00 pm/i)).toBeVisible();

      await expect(page.getByText(/cancel my booking/i)).toBeVisible();
    });

    test('the "save my booking link" WhatsApp button is present on the waiting screen', async ({ page, seed }) => {
      const booking = makeBooking({ status: 'waiting', firstName: 'Saver', type: 'walk-in' });
      await seed.setBooking(booking);

      await primeActiveBooking(page, booking.id);
      await gotoCustomerViewRaw(page);
      await expect(page.getByText(/waiting for allocation/i)).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: /send link to my whatsapp/i })).toBeVisible();
    });
  });
});
