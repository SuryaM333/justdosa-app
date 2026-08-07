import { Table } from '../types';

/**
 * Resolves a table's full merge-group membership (sorted by id) using the
 * `mergeGroupTableIds` list stored on its own doc. Returns `[table]` when
 * unmerged, so callers can treat every table uniformly as "a group of 1+".
 */
export function resolveGroupMembers(table: Table, allTables: Table[]): Table[] {
  if (!table.mergeGroupTableIds || table.mergeGroupTableIds.length === 0) return [table];
  const idSet = new Set(table.mergeGroupTableIds);
  const members = allTables.filter((t) => idSet.has(t.id));
  if (members.length === 0) return [table];
  return members.slice().sort((a, b) => a.id - b.id);
}

export function isTableMerged(table: Table): boolean {
  return !!table.mergeGroupId && !!table.mergeGroupTableIds && table.mergeGroupTableIds.length > 1;
}

/** The primary (lowest id) member of a group — the one that carries `extraSeats`
 *  and whose id every group member's `Booking.tableId` points at once seated. */
export function getGroupPrimary(members: Table[]): Table {
  return members.slice().sort((a, b) => a.id - b.id)[0];
}

/** Combined seating capacity: sum of every member's base capacity plus the
 *  primary's chosen +1/+2 chair override. */
export function getGroupCombinedCapacity(members: Table[]): number {
  const primary = getGroupPrimary(members);
  const baseCap = members.reduce((sum, t) => sum + (t.capacity || 0), 0);
  return baseCap + (primary.extraSeats || 0);
}

/** Theoretical max capacity if every member's own +1 override headroom were used. */
export function getGroupCombinedMaxCapacity(members: Table[]): number {
  const baseCap = members.reduce((sum, t) => sum + (t.capacity || 0), 0);
  const overrideHeadroom = members.reduce(
    (sum, t) => sum + Math.max(0, (t.maxOverrideCapacity || t.capacity || 0) - (t.capacity || 0)),
    0
  );
  return baseCap + overrideHeadroom;
}

/** e.g. "Table 1" for a single table, "Table 1+2" for a merged pair. */
export function getGroupCombinedName(members: Table[]): string {
  if (members.length <= 1) return members[0]?.name || 'Table';
  const sorted = members.slice().sort((a, b) => a.id - b.id);
  return `Table ${sorted.map((t) => t.id).join('+')}`;
}

/** Compact badge form, e.g. "T1" or "T1+2". */
export function getGroupCombinedShortCode(members: Table[]): string {
  if (members.length === 0) return 'T?';
  if (members.length === 1) return `T${members[0].id}`;
  const sorted = members.slice().sort((a, b) => a.id - b.id);
  return `T${sorted.map((t) => t.id).join('+')}`;
}

/** Primary's ordering URL, falling back to the next member's (in id order) that has one set. */
export function getGroupCombinedOrderingUrl(members: Table[]): string | undefined {
  const sorted = members.slice().sort((a, b) => a.id - b.id);
  for (const t of sorted) {
    if (t.orderingUrl && t.orderingUrl.trim() !== '') return t.orderingUrl;
  }
  return undefined;
}
