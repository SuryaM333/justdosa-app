/**
 * Browser-level (OS notification center / banner) alerts for staff, on top
 * of the existing in-page sound + toast. A sound/toast only works if the
 * admin tab is open and visible; a real Notification can surface even when
 * the browser is minimized or another tab/app is focused, which is the gap
 * this fills (staff reported not noticing new walk-ins/bookings at all).
 */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Ask once per browser profile; safe to call repeatedly, no-ops once decided. */
export async function requestNotificationPermission(): Promise<void> {
  if (!isNotificationSupported()) return;
  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // Ignore -- some browsers reject if not called from a user gesture;
      // the in-page sound/toast still works regardless.
    }
  }
}

export function showStaffNotification(title: string, body: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/logo.png',
      tag: 'just-dosa-alert', // collapses rapid-fire alerts into one banner instead of stacking
    } as NotificationOptions);
    // Auto-dismiss and focus the tab if staff clicks it.
    n.onclick = () => {
      window.focus();
      n.close();
    };
    setTimeout(() => n.close(), 15000);
  } catch {
    // Some browsers (notably iOS Safari) don't support the Notification
    // constructor even when the API exists; sound/toast remain the fallback.
  }
}
