export type BookingType = 'walk-in' | 'remote';

export type BookingStatus = 'waiting' | 'pending' | 'confirmed' | 'declined' | 'booked' | 'seated' | 'finished' | 'cancelled' | 'no-show' | 'alternative_proposed' | 'expired';

export type AdminRole = 'staff' | 'owner';

export interface Customer {
  phone: string; // Keyed by phone (e.g., "0412 345 678")
  firstName: string;
  lastName: string;
  totalVisits: number;
  lastVisitDate: string; // ISO string
  noShowCount: number;
  cancellationCount?: number;
  whatsappOptIn: boolean;
  branchId?: string;
  isVip?: boolean;
  notes?: string;
  allergies?: string;
}

export interface Booking {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  partySize: number;
  childSeats: number;
  adultsCount?: number;
  childrenCount?: number;
  childrenHighChairs?: boolean[];
  whatsappOptIn: boolean;
  type: BookingType;
  status: BookingStatus;
  createdAt: string; // ISO string when created/arrived
  bookingDate?: string; // For remote bookings: YYYY-MM-DD
  bookingTime?: string; // For remote bookings: HH:mm (e.g. "18:30")
  previousBookingDate?: string; // Stored when change is requested
  previousBookingTime?: string; // Stored when change is requested
  changeRequestedNote?: string;
  tableId?: number; // Allocated table number (1 to 10)
  seatedAt?: string; // ISO string when table was allocated/seated
  finishedAt?: string; // ISO string when party finished
  estimatedWaitMinutes?: number;
  isNewAlert?: boolean; // For admin unread notification badge
  branchId?: string;
  isKalyanaVirundhu?: boolean;
  kalyanaSlot?: string;
  source?: 'online' | 'phone/staff';
  alternativeDate?: string;
  alternativeTime?: string;
  alternativeIsKalyana?: boolean;
  alternativeKalyanaSlot?: string;
  proposalNote?: string;
  notes?: string;
  allergies?: string;
  serverName?: string;
  handledBy?: string;
  agreedConditions?: boolean;
  reminderSent?: boolean;
}

export interface Table {
  id: number;
  name: string;
  capacity: number; // 2 or 6
  maxOverrideCapacity: number; // For tables 5 & 6, can be overridden to 3
  isOccupied: boolean;
  isInactive: boolean; // Table 7 is inactive
  currentBookingId?: string;
  orderingUrl?: string; // For table QR ordering handoff
  branchId?: string;
  assignedServer?: string;
  mergedWith?: number;
  position: {
    column: 'left' | 'middle' | 'right' | 'top';
    order: number;
    isDiamond?: boolean;
  };
}

export interface DailyStats {
  totalServedToday: number;
  avgWaitTimeMinutes: number;
  busiestHour: string;
  avgTableTurnMinutes: number;
  hourlyBookings: { hour: string; count: number }[];
}

export interface LandmarkPosition {
  id: 'door' | 'washroom' | 'kitchen' | 'counter' | string;
  name: string;
  position: {
    column: 'left' | 'middle' | 'right' | 'top';
    order: number;
  };
}

export type AdminTab = 'waiting' | 'booked' | 'seated' | 'customers' | 'summary' | 'settings';

