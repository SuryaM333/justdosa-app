import { Booking } from '../types';

/**
 * Calculates required table seats for a booking.
 * Rule: Children WITH a high chair do NOT count toward table seat capacity
 * (the high chair is pulled up to the table); children WITHOUT a high chair count as a normal seat.
 */
export function getRequiredTableSeats(booking: Booking): number {
  if (booking.adultsCount !== undefined && booking.childrenCount !== undefined) {
    const highChairsCount = booking.childrenHighChairs?.filter(Boolean).length ?? booking.childSeats;
    const childrenWithoutHighChair = Math.max(0, booking.childrenCount - highChairsCount);
    return booking.adultsCount + childrenWithoutHighChair;
  }
  // Fallback for legacy bookings where only partySize and childSeats exist
  return Math.max(1, booking.partySize - (booking.childSeats || 0));
}

export function getHighChairsCount(booking: Booking): number {
  if (booking.childrenHighChairs !== undefined) {
    return booking.childrenHighChairs.filter(Boolean).length;
  }
  return booking.childSeats || 0;
}

/**
 * Formats party breakdown clearly, e.g. "2 adults + 1 child (high chair)"
 */
export function formatPartyBreakdown(booking: Booking): string {
  const highChairs = getHighChairsCount(booking);
  
  if (booking.adultsCount !== undefined && booking.childrenCount !== undefined) {
    const adults = booking.adultsCount;
    const children = booking.childrenCount;
    
    if (children === 0) {
      return `${adults} ${adults === 1 ? 'adult' : 'adults'}`;
    }
    if (highChairs === 0) {
      return `${adults} ${adults === 1 ? 'adult' : 'adults'} + ${children} ${children === 1 ? 'child' : 'children'}`;
    }
    if (highChairs === children) {
      return `${adults} ${adults === 1 ? 'adult' : 'adults'} + ${children} ${children === 1 ? 'child' : 'children'} (${highChairs === 1 ? 'high chair' : 'high chairs'})`;
    }
    const normalChildren = Math.max(0, children - highChairs);
    if (normalChildren === 0) {
      return `${adults} ${adults === 1 ? 'adult' : 'adults'} + ${children} ${children === 1 ? 'child' : 'children'} (${highChairs === 1 ? 'high chair' : 'high chairs'})`;
    }
    return `${adults} ${adults === 1 ? 'adult' : 'adults'} + ${normalChildren} ${normalChildren === 1 ? 'child' : 'children'} + ${highChairs} ${highChairs === 1 ? 'child' : 'children'} (${highChairs === 1 ? 'high chair' : 'high chairs'})`;
  }

  // Fallback for legacy bookings
  const hc = booking.childSeats || 0;
  const adults = Math.max(1, booking.partySize - hc);
  if (hc > 0) {
    return `${adults} ${adults === 1 ? 'adult' : 'adults'} + ${hc} ${hc === 1 ? 'child' : 'children'} (${hc === 1 ? 'high chair' : 'high chairs'})`;
  }
  return `${booking.partySize} ${booking.partySize === 1 ? 'Guest' : 'Guests'}`;
}

export function formatPartyBreakdownShort(booking: Booking): string {
  const highChairs = getHighChairsCount(booking);
  if (booking.adultsCount !== undefined && booking.childrenCount !== undefined) {
    const adults = booking.adultsCount;
    const children = booking.childrenCount;
    if (children === 0) return `${adults}A`;
    if (highChairs === 0) return `${adults}A + ${children}C`;
    return `${adults}A + ${children}C (${highChairs}HC)`;
  }
  const hc = booking.childSeats || 0;
  const adults = Math.max(1, booking.partySize - hc);
  if (hc > 0) return `${adults}A + ${hc}HC`;
  return `${booking.partySize}G`;
}
