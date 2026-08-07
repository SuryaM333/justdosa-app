import { test, expect, loginAsOwner, loginAsStaff, makeBooking, seedDefaultTables, mergeTables, dragTableToPosition } from './fixtures';

test.describe('Select-based table merge', () => {
  test('selecting one other vacant table and confirming merges them into one unit', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await mergeTables(page, 'Table 1', 'Table 2');

    await expect(page.getByText('Table 1+2', { exact: true })).toBeVisible({ timeout: 5000 });
    // Combined capacity: two 6-seaters = 12p.
    await expect(page.getByText('12p', { exact: true })).toBeVisible();
    // The individual cards are gone — only the combined one renders.
    await expect(page.getByText('Table 1', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Table 2', { exact: true })).toHaveCount(0);

    const t1 = await seed.getTable(1);
    const t2 = await seed.getTable(2);
    expect(t1?.mergeGroupId).toBeTruthy();
    expect(t1?.mergeGroupId).toBe(t2?.mergeGroupId);
    expect(t1?.mergeGroupTableIds?.sort()).toEqual([1, 2]);
    expect(t2?.mergeGroupTableIds?.sort()).toEqual([1, 2]);
  });

  test('deselecting a candidate before confirming excludes it from the merge', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await page.getByRole('button', { name: 'Merge Table 1', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Table 2', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Table 3', exact: true }).click();
    // Deselect Table 2 by toggling it again — only Table 3 should end up merged.
    await page.getByRole('checkbox', { name: 'Table 2', exact: true }).click();
    await page.getByRole('button', { name: /^confirm merge$/i }).click();

    // Wait for the modal itself (and its own "Table 2" checkbox row) to fully
    // leave the DOM before checking the floor plan — otherwise its exit
    // animation can still have that checkbox mounted, and a plain
    // getByText('Table 2') strict-mode-fails against both it and the card.
    await expect(page.getByRole('button', { name: /^confirm merge$/i })).toHaveCount(0);
    await expect(page.getByText('Table 1+3', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Table 2', { exact: true })).toBeVisible();

    const t1 = await seed.getTable(1);
    const t2 = await seed.getTable(2);
    const t3 = await seed.getTable(3);
    expect(t1?.mergeGroupTableIds?.sort()).toEqual([1, 3]);
    expect(t2?.mergeGroupId).toBeFalsy();
    expect(t3?.mergeGroupTableIds?.sort()).toEqual([1, 3]);
  });

  test('cancelling the merge picker leaves all tables unmerged', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await page.getByRole('button', { name: 'Merge Table 1', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Table 2', exact: true }).click();
    await page.getByRole('button', { name: /^cancel$/i }).click();

    // Same reasoning as the confirm-merge test above: wait for the modal
    // (whose body text includes "<strong>Table 1</strong>") to fully leave
    // the DOM before asserting on the floor plan's own "Table 1"/"Table 2".
    await expect(page.getByRole('button', { name: /^cancel$/i })).toHaveCount(0);
    await expect(page.getByText('Table 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Table 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Table 1+2', { exact: true })).toHaveCount(0);

    const t1 = await seed.getTable(1);
    expect(t1?.mergeGroupId).toBeFalsy();
  });

  test('a merged unit is allocatable as one entity to a single party', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const booking = makeBooking({ firstName: 'BigParty', status: 'waiting', partySize: 10 });
    await seed.setBooking(booking);

    await loginAsOwner(page);
    await mergeTables(page, 'Table 1', 'Table 2');
    await expect(page.getByText('Table 1+2', { exact: true })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /select to seat/i }).click();
    await page.getByText('Table 1+2', { exact: true }).click();

    await page.getByRole('button', { name: /seated/i }).first().click();
    await expect(page.getByText(/bigparty/i).first()).toBeVisible();
    await expect(page.getByText(/table 1\+2/i).first()).toBeVisible();

    const t1 = await seed.getTable(1);
    const t2 = await seed.getTable(2);
    expect(t1?.isOccupied).toBe(true);
    expect(t2?.isOccupied).toBe(true);
    expect(t1?.currentBookingId).toBe(t2?.currentBookingId);
    const finalBooking = await seed.getBooking(booking.id);
    expect(finalBooking?.tableId).toBe(1); // primary = lowest id
  });

  test('a third table can be merged into an existing merged pair to form a trio', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await mergeTables(page, 'Table 1', 'Table 2');
    await expect(page.getByText('Table 1+2', { exact: true })).toBeVisible({ timeout: 5000 });

    // Table 3 is still unmerged, so it carries the Merge trigger — fold the
    // existing pair in by selecting it as a candidate from Table 3's picker.
    await mergeTables(page, 'Table 3', 'Table 1+2');
    await expect(page.getByText('Table 1+2+3', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('18p', { exact: true })).toBeVisible();

    const t3 = await seed.getTable(3);
    expect(t3?.mergeGroupTableIds?.sort()).toEqual([1, 2, 3]);
  });

  test('any number of tables can be merged together — there is no artificial cap', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await mergeTables(page, 'Table 1', 'Table 2');
    await expect(page.getByText('Table 1+2', { exact: true })).toBeVisible({ timeout: 5000 });
    await mergeTables(page, 'Table 3', 'Table 1+2');
    await expect(page.getByText('Table 1+2+3', { exact: true })).toBeVisible({ timeout: 5000 });
    await mergeTables(page, 'Table 4', 'Table 1+2+3');

    await expect(page.getByText('Table 1+2+3+4', { exact: true })).toBeVisible({ timeout: 5000 });
    // Four 6-seaters = 24p, and it went through without any "maximum tables" error.
    await expect(page.getByText('24p', { exact: true })).toBeVisible();
    await expect(page.getByText(/maximum.*tables.*merged/i)).toHaveCount(0);

    const t4 = await seed.getTable(4);
    expect(t4?.mergeGroupTableIds?.sort()).toEqual([1, 2, 3, 4]);
  });

  test('finishing a merged party separates the tables back to their own individual states', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    const booking = makeBooking({ firstName: 'Splitter', status: 'waiting', partySize: 8 });
    await seed.setBooking(booking);

    await loginAsOwner(page);
    await mergeTables(page, 'Table 1', 'Table 2');
    await expect(page.getByText('Table 1+2', { exact: true })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: /select to seat/i }).click();
    await page.getByText('Table 1+2', { exact: true }).click();

    await page.getByRole('button', { name: /seated/i }).first().click();
    await page.getByRole('button', { name: /^finished$/i }).click();

    await page.getByRole('button', { name: /waiting list/i }).click();
    // Merge dissolves: the two tables render individually again.
    await expect(page.getByText('Table 1', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Table 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Table 1+2', { exact: true })).toHaveCount(0);

    const t1 = await seed.getTable(1);
    const t2 = await seed.getTable(2);
    expect(t1?.mergeGroupId).toBeFalsy();
    expect(t2?.mergeGroupId).toBeFalsy();
    expect(t1?.isOccupied).toBe(false);
    expect(t2?.isOccupied).toBe(false);
  });

  test('a vacant merged unit can be manually un-merged via its Unmerge button', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await mergeTables(page, 'Table 1', 'Table 2');
    await expect(page.getByText('Table 1+2', { exact: true })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /unmerge/i }).click();

    await expect(page.getByText('Table 1', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Table 2', { exact: true })).toBeVisible();
    const t1 = await seed.getTable(1);
    expect(t1?.mergeGroupId).toBeFalsy();
  });

  test('a merged unit can take a +1/+2 extra-chair override on top of its combined capacity', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    // Merge two of the 2-seaters (tables 5 and 6, both support +1 override) so combined base = 4, max = 6.
    const booking = makeBooking({ firstName: 'Overflow2', status: 'waiting', partySize: 5 });
    await seed.setBooking(booking);

    await loginAsOwner(page);
    await mergeTables(page, 'Table 5', 'Table 6');
    await expect(page.getByText('Table 5+6', { exact: true })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: /select to seat/i }).click();
    await page.getByText('Table 5+6', { exact: true }).click();

    await expect(page.getByText(/override table 5\+6 capacity/i)).toBeVisible();
    await page.getByRole('button', { name: /confirm \+\d override/i }).click();

    await page.getByRole('button', { name: /seated/i }).first().click();
    await expect(page.getByText(/overflow2/i).first()).toBeVisible();

    const t5 = await seed.getTable(5);
    expect(t5?.extraSeats).toBeGreaterThan(0);
  });

  test('edit-mode dragging (repositioning) never triggers a merge', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await page.getByRole('button', { name: /edit floor plan/i }).click();
    await dragTableToPosition(page, 'Table 1', 'Table 2');

    // Still in edit mode, still two separate tables — repositioning, not merging.
    await expect(page.getByText(/done editing/i)).toBeVisible();
    await expect(page.getByText('Table 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Table 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Table 1+2', { exact: true })).toHaveCount(0);

    const t1 = await seed.getTable(1);
    expect(t1?.mergeGroupId).toBeFalsy();
  });

  test('the Merge trigger is not offered while in edit mode', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsOwner(page);

    await page.getByRole('button', { name: /edit floor plan/i }).click();
    await expect(page.getByRole('button', { name: 'Merge Table 1', exact: true })).toHaveCount(0);
  });

  test('table merging is available to staff, not just managers', async ({ page, seed }) => {
    await seedDefaultTables(seed);
    await loginAsStaff(page);

    await mergeTables(page, 'Table 1', 'Table 2');
    await expect(page.getByText('Table 1+2', { exact: true })).toBeVisible({ timeout: 5000 });
    // But Edit Floor Plan itself remains manager-only.
    await expect(page.getByRole('button', { name: /edit floor plan/i })).toHaveCount(0);
  });
});
