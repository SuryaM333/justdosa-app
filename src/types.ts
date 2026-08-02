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

export interface CanvasPosition {
  x?: number; // percentage (0 - 100) on canvas
  y?: number; // percentage (0 - 100) on canvas
  width?: number; // percentage width on canvas (e.g. 18%)
  height?: number; // percentage height on canvas (e.g. 16%)
  rotation?: number; // degrees (0, 45, 90)
  column?: 'left' | 'middle' | 'right' | 'top';
  order?: number;
  isDiamond?: boolean;
}

export interface Table {
  id: number;
  name: string;
  capacity: number; // 2, 4, 6, etc.
  maxOverrideCapacity: number;
  isOccupied: boolean;
  isInactive: boolean;
  currentBookingId?: string;
  orderingUrl?: string;
  branchId?: string;
  assignedServer?: string;
  /** "grp-{primaryId}" — identical on every member doc of a merge group; absent when not merged. */
  mergeGroupId?: string;
  /** Full sorted member table ids (2 or 3), duplicated identically on every member doc, so a
   *  Firestore transaction can resolve and re-validate the whole group from direct doc reads
   *  with no query needed. */
  mergeGroupTableIds?: number[];
  /** +1/+2 chair override chosen at allocation time. Lives only on the group's primary (lowest id)
   *  member when merged; combined capacity = sum(members' capacity) + primary's extraSeats. */
  extraSeats?: number;
  x?: number; // free canvas percentage X (0-100)
  y?: number; // free canvas percentage Y (0-100)
  width?: number; // free canvas percentage width
  height?: number; // free canvas percentage height
  rotation?: number;
  shape?: 'rectangle' | 'diamond' | 'circle';
  position?: CanvasPosition;
}

export interface DailyStats {
  totalServedToday: number;
  avgWaitTimeMinutes: number;
  busiestHour: string;
  avgTableTurnMinutes: number;
  hourlyBookings: { hour: string; count: number }[];
}

export interface LandmarkPosition {
  id: string;
  name: string;
  x?: number; // percentage X (0-100)
  y?: number; // percentage Y (0-100)
  width?: number; // percentage width (e.g. 16%)
  height?: number; // percentage height (e.g. 10%)
  type?: 'door' | 'washroom' | 'kitchen' | 'counter' | 'bar' | 'pos' | 'waiting' | 'custom';
  position?: {
    column: 'left' | 'middle' | 'right' | 'top';
    order: number;
  };
}

export interface FloorCanvasSettings {
  aspectRatio: '16:9' | '4:3' | '1:1' | '2:1' | 'custom';
  widthMeters: number;
  heightMeters: number;
  gridSnapEnabled: boolean;
  gridSizePercent: number; // e.g. 2.5%
}

export type AdminTab = 'waiting' | 'booked' | 'seated' | 'customers' | 'summary' | 'settings';

