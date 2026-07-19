/**
 * Safely converts any input into a JS Date object, handling:
 * - ISO / date strings
 * - JS Date objects
 * - Firestore Timestamp (with .toDate() or {seconds, nanoseconds})
 * - Firebase FieldValue / pending serverTimestamp (e.g. {_methodName} or missing values)
 * - null, undefined, or other invalid values
 */
export function parseToDate(val: any): Date | null {
  if (!val) return null;

  // 1. If it's already a JS Date
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }

  // 2. If it is a Firestore Timestamp with .toDate()
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return d;
      }
    } catch {
      // ignore and fall through
    }
  }

  // 3. If it has seconds and nanoseconds (sometimes serialized or duck-typed Timestamp)
  if (typeof val.seconds === 'number') {
    try {
      const d = new Date(val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000));
      if (!isNaN(d.getTime())) {
        return d;
      }
    } catch {
      // ignore
    }
  }

  // 4. If it has a custom method name or looks like a Firestore FieldValue (e.g. has _methodName)
  if (typeof val === 'object' && ('_methodName' in val || val.constructor?.name === 'FieldValue')) {
    return null; // This is a pending write (serverTimestamp), treat as null/fallback
  }

  // 5. If it's a string or number
  if (typeof val === 'string' || typeof val === 'number') {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return d;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Safely formats a value as a date string (e.g., "18 Jul 2026").
 */
export function safeFormatDate(val: any, fallback = '—'): string {
  const d = parseToDate(val);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return fallback;
  }
}

/**
 * Safely formats a value as a 24-hour or 12-hour time string.
 */
export function safeFormatTime(val: any, fallback = '—'): string {
  const d = parseToDate(val);
  if (!d) return fallback;
  try {
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return fallback;
  }
}

/**
 * Calculates safe elapsed duration (seconds or minutes).
 * Returns duration in milliseconds or 0 if date is invalid.
 */
export function safeGetElapsedMs(val: any): number {
  const d = parseToDate(val);
  if (!d) return 0;
  return Math.max(0, Date.now() - d.getTime());
}

/**
 * Formats waiting time in MM:SS style safely.
 */
export function safeFormatWaited(val: any, fallback = '—'): string {
  const elapsedMs = safeGetElapsedMs(val);
  if (elapsedMs === 0 && !parseToDate(val)) return fallback;
  const elapsedSecs = Math.floor(elapsedMs / 1000);
  const mins = Math.floor(elapsedSecs / 60);
  const secs = elapsedSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats seated duration in "X mins" style safely.
 */
export function safeFormatSeatedDuration(val: any, fallback = '0m'): string {
  const elapsedMs = safeGetElapsedMs(val);
  if (elapsedMs === 0 && !parseToDate(val)) return fallback;
  const diffMins = Math.max(1, Math.round(elapsedMs / 60000));
  return `${diffMins} mins`;
}

/**
 * Formats customer view valid until time.
 */
export function safeFormatValidUntil(val: any, fallback = ''): string {
  const d = parseToDate(val);
  if (!d) return fallback;
  try {
    const future = new Date(d.getTime());
    future.setHours(future.getHours() + 1);
    return future.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return fallback;
  }
}
