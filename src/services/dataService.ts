import { Booking, Customer, DailyStats, Table, LandmarkPosition } from '../types';
import { smsService } from './smsService';
import { cleanPhoneNumber, formatAusMobile } from '../utils/phone';
import { parseToDate } from '../utils/dateUtils';

export interface CustomerSuggestion {
  phone: string;
  firstName: string;
  lastName?: string;
  allergies?: string;
  notes?: string;
  whatsappOptIn?: boolean;
  totalVisits?: number;
}

export interface KalyanaSlotLiveInfo {
  slotId: string;
  range: string;
  slotEndTime: string;
  cutoffTimeStr: string;
  isClosed: boolean;
  totalCapacity: number;
  committedSeats: number;
  availableSeats: number;
  totalTables: number;
  freeTables: Table[];
  freeTablesSummary: string;
}
import { playNewBookingChime } from '../utils/sound';
import { getRequiredTableSeats } from '../utils/bookingUtils';
import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore,
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  runTransaction,
  writeBatch,
  deleteDoc,
  deleteField,
  setLogLevel,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { hashPin } from '../utils/crypto';

// ----------------------------------------------------
// FIREBASE FIRESTORE INITIALIZATION
// ----------------------------------------------------
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firebaseConfig.firestoreDatabaseId);
setLogLevel('silent');

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch(() => {});
}

// ----------------------------------------------------
// FIRESTORE ERROR HANDLING (Spec compliant)
// ----------------------------------------------------
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };

  if (operationType === OperationType.GET || operationType === OperationType.LIST) {
    console.warn('Firestore Sync Info (Offline/Unavailable): ', JSON.stringify(errInfo));
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('justDosaWriteError', { 
      detail: { message: "Something went wrong, please try again or see staff." } 
    }));
  }
  throw new Error(JSON.stringify(errInfo));
}

export function sanitizeData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  // Safe check for Firestore FieldValue
  if (
    obj.constructor &&
    (obj.constructor.name === 'FieldValue' || 
     obj.constructor.name === 'FieldValueImpl' ||
     '_methodName' in obj)
  ) {
    return obj;
  }
  // Safe check for Firestore Timestamp
  if (typeof (obj as any).toDate === 'function') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item)) as any;
  }

  // Prevent converting custom classes with prototype chains to raw objects
  const proto = Object.getPrototypeOf(obj);
  if (proto !== null && proto !== Object.prototype) {
    return obj;
  }

  const res: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      res[key] = sanitizeData(val);
    }
  }
  return res;
}

export function sanitizeFirestoreIncoming<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  // If it's a Firestore Timestamp with .toDate()
  if (typeof (obj as any).toDate === 'function') {
    return obj;
  }
  // Check if it's a Firestore FieldValue or similar custom object representing a delete or pending write
  if (
    obj.constructor &&
    (obj.constructor.name === 'FieldValue' || 
     obj.constructor.name === 'FieldValueImpl' ||
     '_methodName' in obj)
  ) {
    return undefined as any; // Convert FieldValue to undefined on the client so React never sees it!
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestoreIncoming(item)).filter(item => item !== undefined) as any;
  }
  const proto = Object.getPrototypeOf(obj);
  if (proto !== null && proto !== Object.prototype) {
    return obj;
  }
  const res: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    const sanitizedVal = sanitizeFirestoreIncoming(val);
    if (sanitizedVal !== undefined) {
      res[key] = sanitizedVal;
    }
  }
  return res;
}

export function sanitizeOutgoingData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (
    typeof obj.toDate === 'function' ||
    obj instanceof Date ||
    (obj.constructor && (obj.constructor.name === 'FieldValue' || obj.constructor.name === 'FieldValueImpl')) ||
    '_methodName' in obj
  ) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeOutgoingData(item));
  }

  const proto = Object.getPrototypeOf(obj);
  if (proto !== null && proto !== Object.prototype) {
    return obj;
  }

  const res: any = {};
  for (const key of Object.keys(obj)) {
    const val = (obj as any)[key];
    if (val !== undefined) {
      res[key] = sanitizeOutgoingData(val);
    }
  }
  return res;
}

export function getSessionHandledBy(): string | undefined {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
    const role = sessionStorage.getItem('just_dosa_admin_role');
    if (role === 'owner') {
      return 'Manager';
    }
    const name = sessionStorage.getItem('just_dosa_staff_name');
    return name || undefined;
  }
  return undefined;
}

async function safeSetDoc(docRef: any, data: any, options?: any) {
  const sanitized = sanitizeOutgoingData(data);
  if (options) {
    return await setDoc(docRef, sanitized, options);
  } else {
    return await setDoc(docRef, sanitized);
  }
}

async function safeDeleteDoc(docRef: any) {
  return await deleteDoc(docRef);
}

async function safeCommitBatch(batch: any) {
  return await batch.commit();
}

async function safeRunTransaction(db: any, updateFunction: (transaction: any) => Promise<any>) {
  return await runTransaction(db, updateFunction);
}

// ----------------------------------------------------
// REAL-TIME CACHE & STATE DEFINITIONS
// ----------------------------------------------------
let cachedTables: Table[] = [];
let cachedBookings: Booking[] = [];
let cachedCustomers: Record<string, Customer> = {};
let cachedSettings: any = null;
let cachedPins = {
  staffPinHash: 'f3e055913a0b1eb0f07317896f9a1bc466b9a50db85a7f882f3ffde9ffb23aca',
  ownerPinHash: 'a1fb4e703a9ef1fa4936801721ff285a97ac85330856674412e054892afe6972',
};
let isFirestoreOnline = true;

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('justDosaDataChange'));
  }
}

if (typeof window !== 'undefined') {
  isFirestoreOnline = navigator.onLine;
  window.addEventListener('online', () => {
    isFirestoreOnline = true;
    notifyListeners();
  });
  window.addEventListener('offline', () => {
    isFirestoreOnline = false;
    notifyListeners();
  });
}

// ----------------------------------------------------
// SEED DATA TEMPLATES
// ----------------------------------------------------
const DEFAULT_SETTINGS = {
  whatsappNumber: '0412345678',
  kalyanaCapacity: 40,
  lunchStartTime: '11:00',
  lunchEndTime: '15:00',
  dinnerStartTime: '17:30',
  dinnerEndTime: '22:00',
  openingHours: {
    '0': { isOpen: true, lunchOpen: true, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' }, // Sun
    '1': { isOpen: true, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' }, // Mon
    '2': { isOpen: false, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: false, dinnerStart: '17:30', dinnerEnd: '22:00' }, // Tue
    '3': { isOpen: true, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' }, // Wed
    '4': { isOpen: true, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' }, // Thu
    '5': { isOpen: true, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' }, // Fri
    '6': { isOpen: true, lunchOpen: true, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' }, // Sat
  },
  lunchBuffer: 30,
  dinnerBuffer: 30,
  slotInterval: 15,
  kalyanaEnabled: true,
  kalyanaCutoffMinutes: 30,
  kalyanaTurnMinutes: 45,
  kalyanaSlots: [
    { id: '1', range: 'Slot 1: 11:00am-12:30pm', capacity: 40 },
    { id: '2', range: 'Slot 2: 12:30pm-2:00pm', capacity: 40 },
    { id: '3', range: 'Slot 3: 2:00pm-3:30pm', capacity: 40 }
  ],
  customerTexts: {
    welcomeLine: 'Select an option below to join the live queue or reserve for later.',
    waitingReassurance: 'Please wait — our team will allocate your table shortly.',
    tableReadyTemplate: 'Your table {table} is ready! Welcome, {name}. Please make your way to the host.',
    thankYouMessage: 'Thank you for dining with us! We hope you enjoyed your Ney Dosa Feast.',
    noOrderingUrlNote: "Please ask our staff for the menu — we'll take your order at the table."
  },
  waitTimeAlertThresholds: {
    low: 10,
    medium: 15,
    high: 20
  },
  staffList: ['Amrit', 'Sanjay', 'Vasu'],
  customerBgUrl: '',
  floorCanvasSettings: {
    aspectRatio: '16:9',
    widthMeters: 14,
    heightMeters: 9,
    gridSnapEnabled: true,
    gridSizePercent: 2.5
  },
  landmarks: [
    { id: 'door', name: 'Door / Entry', type: 'door', x: 5, y: 85, width: 18, height: 10, position: { column: 'left', order: 1 } },
    { id: 'washroom', name: 'Washroom', type: 'washroom', x: 28, y: 85, width: 18, height: 10, position: { column: 'left', order: 5 } },
    { id: 'kitchen', name: 'Kitchen', type: 'kitchen', x: 52, y: 85, width: 20, height: 10, position: { column: 'middle', order: 5 } },
    { id: 'counter', name: 'Counter', type: 'counter', x: 76, y: 85, width: 20, height: 10, position: { column: 'right', order: 5 } },
  ]
};

const INITIAL_TABLES: Table[] = [
  { id: 1, name: 'Table 1', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://www.justdosa.com.au/s/order?location=11f077344ecaf81ebd003cecef6d615a&customer_seat_id=11f07ef8af5c70b0ac601a7db5ad9236', x: 76, y: 60, width: 18, height: 18, position: { column: 'right', order: 3 } },
  { id: 2, name: 'Table 2', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://www.justdosa.com.au/s/order?location=11f077344ecaf81ebd003cecef6d615a&customer_seat_id=11f07ef8af5c8e9ca5a01a7db5ad9236', x: 76, y: 35, width: 18, height: 18, position: { column: 'right', order: 2 } },
  { id: 3, name: 'Table 3', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://www.justdosa.com.au/s/order?location=11f077344ecaf81ebd003cecef6d615a&customer_seat_id=11f07ef8af5c9f04baf31a7db5ad9236', x: 76, y: 10, width: 18, height: 18, position: { column: 'right', order: 1 } },
  { id: 4, name: 'Table 4', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://www.justdosa.com.au/s/order?location=11f077344ecaf81ebd003cecef6d615a&customer_seat_id=11f07ef8af5cac42bcf61a7db5ad9236', x: 40, y: 6, width: 22, height: 16, position: { column: 'top', order: 1 } },
  { id: 5, name: 'Table 5', capacity: 2, maxOverrideCapacity: 3, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://www.justdosa.com.au/s/order?location=11f077344ecaf81ebd003cecef6d615a&customer_seat_id=11f07ef8af5cb926a2491a7db5ad9236', x: 43, y: 28, width: 15, height: 15, shape: 'diamond', position: { column: 'middle', order: 1, isDiamond: true } },
  { id: 6, name: 'Table 6', capacity: 2, maxOverrideCapacity: 3, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: '', x: 43, y: 46, width: 15, height: 15, shape: 'diamond', position: { column: 'middle', order: 2, isDiamond: true } },
  { id: 7, name: 'Table 7', capacity: 2, maxOverrideCapacity: 3, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: '', x: 43, y: 64, width: 15, height: 15, shape: 'diamond', position: { column: 'middle', order: 3, isDiamond: true } },
  { id: 8, name: 'Table 8', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://www.justdosa.com.au/s/order?location=11f077344ecaf81ebd003cecef6d615a&customer_seat_id=11f07ef8af5cde429f761a7db5ad9236', x: 6, y: 60, width: 18, height: 18, position: { column: 'left', order: 3 } },
  { id: 9, name: 'Table 9', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://www.justdosa.com.au/s/order?location=11f077344ecaf81ebd003cecef6d615a&customer_seat_id=11f07ef8af5ce8d8a1221a7db5ad9236', x: 6, y: 35, width: 18, height: 18, position: { column: 'left', order: 2 } },
  { id: 10, name: 'Table 10', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://www.justdosa.com.au/s/order?location=11f077344ecaf81ebd003cecef6d615a&customer_seat_id=11f07ef8af5cf468b6671a7db5ad9236', x: 6, y: 10, width: 18, height: 18, position: { column: 'left', order: 1 } },
];

async function migratePlaintextPins() {
  try {
    const globalDocRef = doc(db, 'settings', 'global');
    const globalSnap = await getDoc(globalDocRef);
    
    let plainStaff = '1357';
    let plainOwner = '2468';
    let hasPlaintext = false;

    if (globalSnap.exists()) {
      const globalData = globalSnap.data();
      if (globalData.staffPin) {
        plainStaff = globalData.staffPin;
        hasPlaintext = true;
      }
      if (globalData.ownerPin) {
        plainOwner = globalData.ownerPin;
        hasPlaintext = true;
      }
    }

    // Hash the plain text PINs
    const staffHash = await hashPin(plainStaff);
    const ownerHash = await hashPin(plainOwner);

    // Save them to settings_secure/pins
    const securePinsDocRef = doc(db, 'settings_secure', 'pins');
    await setDoc(securePinsDocRef, {
      staffPinHash: staffHash,
      ownerPinHash: ownerHash
    });

    // Remove plaintext PINs from the old settings document
    if (hasPlaintext) {
      await setDoc(globalDocRef, {
        staffPin: deleteField(),
        ownerPin: deleteField()
      }, { merge: true });
    }

    console.log("Migration of secure PINs completed successfully.");
  } catch (err) {
    console.error("Error migrating plaintext PINs: ", err);
  }
}

// ----------------------------------------------------
// REAL-TIME FIRESTORE SYNCHRONIZATION ENGINE
// ----------------------------------------------------
let initialized = false;

function initFirestoreSync() {
  if (initialized) return;
  initialized = true;

  // 1. Settings Document Listener
  const settingsDocRef = doc(db, 'settings', 'global');
  onSnapshot(settingsDocRef, async (docSnap) => {
    try {
      if (!docSnap.exists()) {
        await safeSetDoc(settingsDocRef, DEFAULT_SETTINGS);
      } else {
        const docData = sanitizeFirestoreIncoming(docSnap.data() || {});
        cachedSettings = docData;
        notifyListeners();

        // Check if there are any keys in DEFAULT_SETTINGS that are missing from docData
        const missingFields: Record<string, any> = {};
        let needsMergeUpdate = false;
        
        for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
          if (!(key in docData)) {
            missingFields[key] = val;
            needsMergeUpdate = true;
          } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            // Check sub-properties of nested objects (e.g. customerTexts, waitTimeAlertThresholds, openingHours)
            const rawSubData = docData[key];
            const docSubData = (rawSubData && typeof rawSubData === 'object' && !Array.isArray(rawSubData)) ? rawSubData : {};
            const missingSubFields: Record<string, any> = {};
            let subNeedsUpdate = false;
            for (const [subKey, subVal] of Object.entries(val)) {
              if (!(subKey in docSubData)) {
                missingSubFields[subKey] = subVal;
                subNeedsUpdate = true;
                needsMergeUpdate = true;
              }
            }
            if (subNeedsUpdate) {
              missingFields[key] = {
                ...docSubData,
                ...missingSubFields
              };
            }
          }
        }

        if (needsMergeUpdate) {
          console.log("Adding missing settings fields to Firestore: ", missingFields);
          await safeSetDoc(settingsDocRef, missingFields, { merge: true });
        }
      }
    } catch (err) {
      console.warn("Error in settings sync: ", err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'settings/global');
  });

  // 1b. Secure PINs Document Listener
  const securePinsDocRef = doc(db, 'settings_secure', 'pins');
  onSnapshot(securePinsDocRef, async (docSnap) => {
    try {
      if (!docSnap.exists() || !docSnap.data()?.staffPinHash || !docSnap.data()?.ownerPinHash) {
        await migratePlaintextPins();
      } else {
        const data = docSnap.data();
        cachedPins = {
          staffPinHash: data?.staffPinHash || 'f3e055913a0b1eb0f07317896f9a1bc466b9a50db85a7f882f3ffde9ffb23aca',
          ownerPinHash: data?.ownerPinHash || 'a1fb4e703a9ef1fa4936801721ff285a97ac85330856674412e054892afe6972',
        };
        notifyListeners();
      }
    } catch (err) {
      console.warn("Error in secure pins sync: ", err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, 'settings_secure/pins');
  });

  // 2. Tables Collection Listener
  const tablesColRef = collection(db, 'tables');
  onSnapshot(tablesColRef, async (querySnap) => {
    try {
      if (querySnap.empty) {
        for (const t of INITIAL_TABLES) {
          await safeSetDoc(doc(db, 'tables', t.id.toString()), t);
        }
      } else {
        const tables: Table[] = [];
        querySnap.forEach((docSnap) => {
          const raw = docSnap.data() as any;
          const data = sanitizeFirestoreIncoming(raw) as Table;
          if (data) {
            // Guarantee ID type safety as number
            data.id = typeof data.id === 'string' ? parseInt(data.id, 10) : Number(data.id || docSnap.id);
            if (isNaN(data.id) || data.id <= 0) return; // Skip phantom / invalid table docs
            if (!data.name || data.name.trim() === '') {
              data.name = `Table ${data.id}`;
            }
            if (data.mergedWith !== undefined && data.mergedWith !== null) {
              data.mergedWith = Number(data.mergedWith);
              if (isNaN(data.mergedWith)) {
                data.mergedWith = undefined;
              }
            }
            tables.push(data);
          }
        });

        tables.sort((a, b) => a.id - b.id);
        cachedTables = tables;
        notifyListeners();
      }
    } catch (err) {
      console.warn("Error in tables sync: ", err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'tables');
  });

  // 3. Bookings Collection Listener
  const bookingsColRef = collection(db, 'bookings');
  onSnapshot(bookingsColRef, async (querySnap) => {
    try {
      if (querySnap.empty) {
        cachedBookings = [];
        notifyListeners();
      } else {
        const bookings: Booking[] = [];
        querySnap.forEach((doc) => {
          bookings.push(sanitizeFirestoreIncoming(doc.data() as Booking));
        });
        cachedBookings = bookings;
        notifyListeners();
      }
    } catch (err) {
      console.warn("Error in bookings sync: ", err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'bookings');
  });

  // 4. Customers Collection Listener
  const customersColRef = collection(db, 'customers');
  onSnapshot(customersColRef, async (querySnap) => {
    try {
      if (querySnap.empty) {
        cachedCustomers = {};
        notifyListeners();
      } else {
        const customers: Record<string, Customer> = {};
        querySnap.forEach((doc) => {
          customers[doc.id] = sanitizeFirestoreIncoming(doc.data() as Customer);
        });
        cachedCustomers = customers;
        notifyListeners();
      }
    } catch (err) {
      console.warn("Error in customers sync: ", err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'customers');
  });
}

// Kickstart synchronization immediately on module import
if (typeof window !== 'undefined') {
  initFirestoreSync();

  // Start a periodic background checker to automatically expire walk-in bookings that have waited > 1 hour
  setInterval(async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const expiredWalkIns = cachedBookings.filter(b => 
        b.type === 'walk-in' && 
        b.status === 'waiting' && 
        b.createdAt && 
        b.createdAt < oneHourAgo
      );

      for (const booking of expiredWalkIns) {
        console.log(`Automatically expiring walk-in booking ${booking.id} (${booking.firstName}) due to 1-hour session limit.`);
        const bookingDocRef = doc(db, 'bookings', booking.id);
        await safeSetDoc(bookingDocRef, {
          status: 'expired'
        }, { merge: true });
      }
    } catch (e) {
      console.error("Error in background walk-in expiry checker:", e);
    }
  }, 15000); // Check every 15 seconds

  // Start a periodic background checker to automatically send 2-hour SMS reminders
  setInterval(async () => {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      const upcomingForReminder = cachedBookings.filter(b => {
        if (b.status !== 'confirmed') return false;
        if (b.reminderSent) return false;
        if (b.bookingDate !== todayStr) return false;
        if (!b.bookingTime) return false;

        const [h, m] = b.bookingTime.split(':').map(Number);
        const bDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        const diffMs = bDate.getTime() - now.getTime();
        const diffMinutes = diffMs / (1000 * 60);

        return diffMinutes > 0 && diffMinutes <= 120;
      });

      for (const booking of upcomingForReminder) {
        console.log(`Sending automated 2-hour SMS reminder to ${booking.firstName} (${booking.phone})`);
        await smsService.sendTwoHourReminderSMS(booking);
        const bookingDocRef = doc(db, 'bookings', booking.id);
        await safeSetDoc(bookingDocRef, { reminderSent: true }, { merge: true });
      }
    } catch (e) {
      console.error("Error in background SMS reminder checker:", e);
    }
  }, 30000); // Check every 30 seconds

  // Start periodic background checker for Kalyana auto table-turn (45 min turn timer, hard limit 60 min)
  setInterval(async () => {
    try {
      const turnMins = dataService.getKalyanaTurnMinutes();
      const nowMs = Date.now();

      const seatedKalyana = cachedBookings.filter(b => 
        b.status === 'seated' && 
        b.isKalyanaVirundhu && 
        b.tableId && 
        b.seatedAt
      );

      for (const booking of seatedKalyana) {
        const seatedDate = parseToDate(booking.seatedAt);
        if (!seatedDate) continue;
        const elapsedMins = (nowMs - seatedDate.getTime()) / 60000;
        
        if (elapsedMins >= turnMins) {
          console.log(`Auto-turning Kalyana table ${booking.tableId} for ${booking.firstName} after ${Math.round(elapsedMins)} mins (limit: ${turnMins}m).`);
          if (booking.tableId) {
            await dataService.finishSeatedParty(booking.tableId);
          }
        }
      }
    } catch (e) {
      console.error("Error in Kalyana auto table-turn checker:", e);
    }
  }, 10000); // Check every 10 seconds
}

// ----------------------------------------------------
// PUBLIC DATA SERVICE EXPORTS
// ----------------------------------------------------
export const dataService = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  isOnline(): boolean {
    return isFirestoreOnline;
  },

  getStaffPin(): string {
    return '';
  },

  getOwnerPin(): string {
    return '';
  },

  async setStaffPin(pin: string) {
    try {
      const hash = await hashPin(pin);
      await safeSetDoc(doc(db, 'settings_secure', 'pins'), { staffPinHash: hash }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings_secure/pins');
    }
  },

  async setOwnerPin(pin: string) {
    try {
      const hash = await hashPin(pin);
      await safeSetDoc(doc(db, 'settings_secure', 'pins'), { ownerPinHash: hash }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings_secure/pins');
    }
  },

  async verifyStaffPin(pin: string): Promise<boolean> {
    const hash = await hashPin(pin);
    return hash === cachedPins.staffPinHash;
  },

  async verifyOwnerPin(pin: string): Promise<boolean> {
    const hash = await hashPin(pin);
    return hash === cachedPins.ownerPinHash;
  },

  async saveAllSettings(settings: any) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), settings, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getWhatsAppNumber(): string {
    return cachedSettings?.whatsappNumber || '0412345678';
  },

  async setWhatsAppNumber(number: string) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { whatsappNumber: number }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getKalyanaCapacity(): number {
    return cachedSettings?.kalyanaCapacity || 40;
  },

  async setKalyanaCapacity(capacity: number) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { kalyanaCapacity: capacity }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getLunchStartTime(): string {
    return cachedSettings?.openingHours?.[0]?.lunchStart || cachedSettings?.lunchStartTime || '11:00';
  },

  async setLunchStartTime(time: string) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { lunchStartTime: time }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getLunchEndTime(): string {
    return cachedSettings?.openingHours?.[0]?.lunchEnd || cachedSettings?.lunchEndTime || '15:00';
  },

  async setLunchEndTime(time: string) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { lunchEndTime: time }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getDinnerStartTime(): string {
    return cachedSettings?.openingHours?.[0]?.dinnerStart || cachedSettings?.dinnerStartTime || '17:30';
  },

  async setDinnerStartTime(time: string) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { dinnerStartTime: time }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getDinnerEndTime(): string {
    return cachedSettings?.openingHours?.[0]?.dinnerEnd || cachedSettings?.dinnerEndTime || '22:00';
  },

  async setDinnerEndTime(time: string) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { dinnerEndTime: time }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getOpeningHours(): Record<string, { isOpen: boolean; lunchOpen: boolean; lunchStart: string; lunchEnd: string; dinnerOpen: boolean; dinnerStart: string; dinnerEnd: string }> {
    return (cachedSettings && typeof cachedSettings.openingHours === 'object' && cachedSettings.openingHours !== null)
      ? cachedSettings.openingHours
      : DEFAULT_SETTINGS.openingHours;
  },

  async setOpeningHours(openingHours: any) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { openingHours }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getLunchBuffer(): number {
    return (cachedSettings && typeof cachedSettings.lunchBuffer === 'number') ? cachedSettings.lunchBuffer : 30;
  },

  async setLunchBuffer(buffer: number) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { lunchBuffer: buffer }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getDinnerBuffer(): number {
    return (cachedSettings && typeof cachedSettings.dinnerBuffer === 'number') ? cachedSettings.dinnerBuffer : 30;
  },

  async setDinnerBuffer(buffer: number) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { dinnerBuffer: buffer }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getSlotInterval(): number {
    return (cachedSettings && typeof cachedSettings.slotInterval === 'number') ? cachedSettings.slotInterval : 15;
  },

  async setSlotInterval(interval: number) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { slotInterval: interval }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  isKalyanaEnabled(): boolean {
    return (cachedSettings && typeof cachedSettings.kalyanaEnabled === 'boolean') ? cachedSettings.kalyanaEnabled : true;
  },

  async setKalyanaEnabled(enabled: boolean) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { kalyanaEnabled: enabled }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getKalyanaSlots(): { id: string; range: string; capacity: number }[] {
    return (cachedSettings && Array.isArray(cachedSettings.kalyanaSlots))
      ? cachedSettings.kalyanaSlots
      : DEFAULT_SETTINGS.kalyanaSlots;
  },

  async setKalyanaSlots(slots: any[]) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { kalyanaSlots: slots }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getKalyanaCutoffMinutes(): number {
    return (cachedSettings && typeof cachedSettings.kalyanaCutoffMinutes === 'number')
      ? cachedSettings.kalyanaCutoffMinutes
      : DEFAULT_SETTINGS.kalyanaCutoffMinutes;
  },

  async setKalyanaCutoffMinutes(mins: number) {
    try {
      const val = Math.max(0, mins);
      await safeSetDoc(doc(db, 'settings', 'global'), { kalyanaCutoffMinutes: val }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getKalyanaTurnMinutes(): number {
    return (cachedSettings && typeof cachedSettings.kalyanaTurnMinutes === 'number')
      ? Math.min(60, Math.max(15, cachedSettings.kalyanaTurnMinutes))
      : DEFAULT_SETTINGS.kalyanaTurnMinutes;
  },

  async setKalyanaTurnMinutes(mins: number) {
    try {
      const val = Math.min(60, Math.max(15, mins));
      await safeSetDoc(doc(db, 'settings', 'global'), { kalyanaTurnMinutes: val }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  searchCustomerSuggestions(query: string): CustomerSuggestion[] {
    if (!query || query.trim().length < 2) return [];
    const q = query.trim().toLowerCase();
    const cleanQ = cleanPhoneNumber(q) || q;
    const results: Map<string, CustomerSuggestion> = new Map();

    // 1. Search cachedCustomers
    Object.values(cachedCustomers).forEach(c => {
      const pClean = cleanPhoneNumber(c.phone) || c.phone;
      const fName = (c.firstName || '').toLowerCase();
      const lName = (c.lastName || '').toLowerCase();
      if (
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (pClean && pClean.includes(cleanQ)) ||
        fName.includes(q) ||
        lName.includes(q)
      ) {
        const key = pClean || c.phone;
        results.set(key, {
          phone: c.phone,
          firstName: c.firstName || '',
          lastName: c.lastName || '',
          allergies: c.allergies || '',
          notes: c.notes || '',
          whatsappOptIn: c.whatsappOptIn ?? true,
          totalVisits: c.totalVisits || 1,
        });
      }
    });

    // 2. Search cachedBookings
    cachedBookings.forEach(b => {
      const pClean = cleanPhoneNumber(b.phone) || b.phone;
      const key = pClean || b.phone;
      if (key && !results.has(key)) {
        const fName = (b.firstName || '').toLowerCase();
        const lName = (b.lastName || '').toLowerCase();
        if (
          (b.phone && b.phone.toLowerCase().includes(q)) ||
          (pClean && pClean.includes(cleanQ)) ||
          fName.includes(q) ||
          lName.includes(q)
        ) {
          results.set(key, {
            phone: b.phone,
            firstName: b.firstName || '',
            lastName: b.lastName || '',
            allergies: b.allergies || '',
            notes: b.notes || '',
            whatsappOptIn: b.whatsappOptIn ?? true,
            totalVisits: 1,
          });
        }
      }
    });

    return Array.from(results.values()).slice(0, 5);
  },

  getKalyanaLiveAvailability(selectedDate?: string): KalyanaSlotLiveInfo[] {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = selectedDate || today;
    const isToday = targetDate === today;

    const slots = this.getKalyanaSlots();
    const activeTables = this.getTables().filter(t => !t.isInactive);
    const totalTablesCount = activeTables.length;
    const totalSeatsCount = activeTables.reduce((acc, t) => acc + (t.capacity || 0), 0);

    const cutoffMins = this.getKalyanaCutoffMinutes();
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const dateBookings = cachedBookings.filter(b => 
      b.bookingDate === targetDate && 
      b.status !== 'cancelled' && 
      b.status !== 'declined'
    );

    const slotEndTimeMap: Record<string, string> = {
      '1': '12:30',
      '2': '14:00',
      '3': '15:30',
    };

    return slots.map((slot, index) => {
      const slotId = slot.id || String(index + 1);
      const slotEndTime = slotEndTimeMap[slotId] || (index === 0 ? '12:30' : index === 1 ? '14:00' : '15:30');
      
      const [endH, endM] = slotEndTime.split(':').map(Number);
      const slotEndInMins = endH * 60 + endM;
      const cutoffInMins = slotEndInMins - cutoffMins;
      const cutoffH = Math.floor(Math.max(0, cutoffInMins) / 60);
      const cutoffM = Math.max(0, cutoffInMins) % 60;
      const cutoffTimeStr = `${cutoffH.toString().padStart(2, '0')}:${cutoffM.toString().padStart(2, '0')}`;

      const isClosed = isToday && (currentMins >= cutoffInMins);

      const slotBookings = dateBookings.filter(b => 
        (b.isKalyanaVirundhu || b.kalyanaSlot) && 
        (b.kalyanaSlot === slot.range || b.kalyanaSlot === slotId || b.bookingTime === slot.range)
      );

      const committedSeats = slotBookings.reduce((sum, b) => sum + (b.partySize || 1), 0);
      const totalCapacity = slot.capacity || totalSeatsCount;
      const availableSeats = Math.max(0, totalCapacity - committedSeats);

      const assignedTableIds = new Set(slotBookings.map(b => b.tableId).filter(Boolean));
      const freeTables = activeTables.filter(t => !assignedTableIds.has(t.id));

      let freeTablesSummary = '';
      if (freeTables.length === 0) {
        freeTablesSummary = 'No tables free';
      } else {
        const tableDetails = freeTables.map(t => `T${t.id} (${t.capacity}s)`).join(', ');
        const totalFreeSeats = freeTables.reduce((s, t) => s + t.capacity, 0);
        freeTablesSummary = `Tables ${freeTables.map(t => t.id).join(', ')} free — ${totalFreeSeats} seats (${tableDetails})`;
      }

      return {
        slotId,
        range: slot.range,
        slotEndTime,
        cutoffTimeStr,
        isClosed,
        totalCapacity,
        committedSeats,
        availableSeats,
        totalTables: totalTablesCount,
        freeTables,
        freeTablesSummary
      };
    });
  },

  getCustomerTexts(): { welcomeLine: string; waitingReassurance: string; tableReadyTemplate: string; thankYouMessage: string; noOrderingUrlNote: string } {
    return (cachedSettings && typeof cachedSettings.customerTexts === 'object' && cachedSettings.customerTexts !== null)
      ? { ...DEFAULT_SETTINGS.customerTexts, ...cachedSettings.customerTexts }
      : DEFAULT_SETTINGS.customerTexts;
  },

  async setCustomerTexts(customerTexts: any) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { customerTexts }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getWaitTimeAlertThresholds(): { low: number; medium: number; high: number } {
    return (cachedSettings && typeof cachedSettings.waitTimeAlertThresholds === 'object' && cachedSettings.waitTimeAlertThresholds !== null)
      ? { ...DEFAULT_SETTINGS.waitTimeAlertThresholds, ...cachedSettings.waitTimeAlertThresholds }
      : DEFAULT_SETTINGS.waitTimeAlertThresholds;
  },

  async setWaitTimeAlertThresholds(waitTimeAlertThresholds: { low: number; medium: number; high: number }) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { waitTimeAlertThresholds }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getCustomerBgUrl(): string {
    return (cachedSettings && typeof cachedSettings.customerBgUrl === 'string')
      ? cachedSettings.customerBgUrl
      : DEFAULT_SETTINGS.customerBgUrl;
  },

  async setCustomerBgUrl(customerBgUrl: string) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { customerBgUrl }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getSettings(): typeof DEFAULT_SETTINGS {
    return (cachedSettings && typeof cachedSettings === 'object')
      ? { ...DEFAULT_SETTINGS, ...cachedSettings }
      : DEFAULT_SETTINGS;
  },

  async updateSettings(updates: any) {
    try {
      if (cachedSettings) {
        Object.assign(cachedSettings, updates);
      }
      await safeSetDoc(doc(db, 'settings', 'global'), updates, { merge: true });
      notifyListeners();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  async finishTable(tableId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.finishSeatedParty(tableId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to finish table' };
    }
  },

  async addQuickWalkinAndSeat(data: { tableId: number; partySize: number; name?: string; phone?: string; serverName?: string }): Promise<{ success: boolean; error?: string }> {
    return this.seatWalkInDirectly(data.tableId, data.partySize, data.name || 'Walk-In', data.phone || '0400 000 000', 0, data.serverName);
  },

  getLandmarks(): LandmarkPosition[] {
    if (cachedSettings && Array.isArray(cachedSettings.landmarks) && cachedSettings.landmarks.length > 0) {
      return cachedSettings.landmarks;
    }
    return DEFAULT_SETTINGS.landmarks as LandmarkPosition[];
  },

  async setLandmarks(landmarks: LandmarkPosition[]) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { landmarks }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  findLatestBookingByPhone(phone: string): Booking | undefined {
    const bookings = this.getBookings();
    const cleanNum = cleanPhoneNumber(phone);
    const matches = bookings.filter((b) => cleanPhoneNumber(b.phone) === cleanNum);
    if (matches.length === 0) return undefined;
    
    matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const activeMatch = matches.find((b) => b.status !== 'finished' && b.status !== 'cancelled' && b.status !== 'no-show');
    return activeMatch || matches[0];
  },

  async proposeAlternativeTime(
    bookingId: string,
    altDate: string,
    altTime: string,
    isKalyana?: boolean,
    kalyanaSlot?: string,
    proposalNote?: string
  ) {
    try {
      await safeSetDoc(doc(db, 'bookings', bookingId), {
        status: 'alternative_proposed',
        alternativeDate: altDate,
        alternativeTime: altTime,
        isKalyanaVirundhu: !!isKalyana,
        kalyanaSlot: kalyanaSlot || null,
        proposalNote: proposalNote || null,
        isNewAlert: false
      }, { merge: true });
      await this.syncSlotOccupancyForBookingId(bookingId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async acceptAlternativeTime(bookingId: string) {
    try {
      const docRef = doc(db, 'bookings', bookingId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const booking = snap.data() as Booking;
        const newBookingDate = booking.alternativeDate;
        const newBookingTime = booking.isKalyanaVirundhu ? booking.kalyanaSlot : booking.alternativeTime;
        await safeSetDoc(docRef, {
          status: 'confirmed',
          bookingDate: newBookingDate,
          bookingTime: newBookingTime,
          alternativeDate: null,
          alternativeTime: null
        }, { merge: true });
        await this.syncSlotOccupancyForBookingId(bookingId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async declineAlternativeTime(bookingId: string) {
    try {
      await safeSetDoc(doc(db, 'bookings', bookingId), {
        status: 'cancelled'
      }, { merge: true });
      await this.syncSlotOccupancyForBookingId(bookingId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  getTables(): Table[] {
    if (cachedTables.length === 0) {
      return INITIAL_TABLES;
    }
    return cachedTables.filter(t => t && typeof t.id === 'number' && t.id > 0 && t.name && t.name.trim() !== '');
  },

  async saveTables(tables: Table[]) {
    try {
      const validTables = tables.filter(t => t && typeof t.id === 'number' && t.id > 0 && t.name && t.name.trim() !== '');
      cachedTables = validTables;
      notifyListeners();
      const batch = writeBatch(db);
      validTables.forEach((t) => {
        batch.set(doc(db, 'tables', t.id.toString()), t);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'tables');
    }
  },

  getBookings(): Booking[] {
    return cachedBookings;
  },

  async saveBookings(bookings: Booking[]) {
    try {
      const batch = writeBatch(db);
      bookings.forEach((b) => {
        batch.set(doc(db, 'bookings', b.id), b);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bookings');
    }
  },

  getCustomers(): Record<string, Customer> {
    return cachedCustomers;
  },

  async saveCustomers(customers: Record<string, Customer>) {
    try {
      const batch = writeBatch(db);
      Object.entries(customers).forEach(([phone, c]) => {
        batch.set(doc(db, 'customers', phone), c);
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  },

  async updateCustomer(phoneKey: string, updates: Partial<Customer>) {
    try {
      const cleaned = cleanPhoneNumber(phoneKey);
      await setDoc(doc(db, 'customers', cleaned), updates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  },

  getCustomerByPhone(phone: string): Customer | null {
    const cleaned = cleanPhoneNumber(phone);
    return cachedCustomers[cleaned] || null;
  },

  getStaffList(): string[] {
    return cachedSettings?.staffList || ['Amrit', 'Sanjay', 'Vasu'];
  },

  async setStaffList(staffList: string[]) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { staffList }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  async assignServerToTable(tableId: number, serverName: string | null) {
    try {
      const tableDocRef = doc(db, 'tables', tableId.toString());
      await safeSetDoc(tableDocRef, {
        assignedServer: serverName || null
      }, { merge: true });

      // Also set on the current seated booking if table is occupied
      const tableSnap = await getDoc(tableDocRef);
      if (tableSnap.exists()) {
        const table = tableSnap.data() as Table;
        if (table.currentBookingId) {
          await safeSetDoc(doc(db, 'bookings', table.currentBookingId), {
            serverName: serverName || null
          }, { merge: true });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tables/${tableId}`);
    }
  },

  async mergeTables(tableId1: number, tableId2: number) {
    try {
      const table1Ref = doc(db, 'tables', tableId1.toString());
      const table2Ref = doc(db, 'tables', tableId2.toString());
      
      await safeRunTransaction(db, async (transaction) => {
        const snap1 = await transaction.get(table1Ref);
        const snap2 = await transaction.get(table2Ref);
        
        if (!snap1.exists() || !snap2.exists()) return;
        
        transaction.update(table1Ref, { mergedWith: tableId2 });
        transaction.update(table2Ref, { mergedWith: tableId1 });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tables/merge/${tableId1}_${tableId2}`);
    }
  },

  async dissolveMerge(tableId: number) {
    try {
      const tableRef = doc(db, 'tables', tableId.toString());
      const tableSnap = await getDoc(tableRef);
      if (!tableSnap.exists()) return;
      
      const table = tableSnap.data() as Table;
      const otherId = table.mergedWith;
      
      await safeRunTransaction(db, async (transaction) => {
        transaction.update(tableRef, { mergedWith: deleteField() });
        if (otherId) {
          const otherRef = doc(db, 'tables', otherId.toString());
          transaction.update(otherRef, { mergedWith: deleteField() });
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tables/dissolve/${tableId}`);
    }
  },

  async createBooking(data: {
    firstName: string;
    lastName: string;
    phone: string;
    partySize: number;
    childSeats: number;
    adultsCount?: number;
    childrenCount?: number;
    childrenHighChairs?: boolean[];
    whatsappOptIn: boolean;
    type: 'walk-in' | 'remote';
    bookingDate?: string;
    bookingTime?: string;
      isKalyanaVirundhu?: boolean;
    kalyanaSlot?: string;
    notes?: string;
    allergies?: string;
    agreedConditions?: boolean;
  }): Promise<Booking> {
    const formattedPhone = formatAusMobile(data.phone);
    const cleanedPhone = cleanPhoneNumber(data.phone);

    const isKalyana = data.isKalyanaVirundhu && data.kalyanaSlot && data.bookingDate;

    if (isKalyana) {
      const slotOccupancyRef = doc(db, 'slot_occupancy', `${data.bookingDate}_${data.kalyanaSlot}`);
      const bookingId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let newBooking: Booking;

      try {
        await runTransaction(db, async (transaction) => {
          const occupancySnap = await transaction.get(slotOccupancyRef);
          let currentCount = 0;
          if (occupancySnap.exists()) {
            currentCount = occupancySnap.data().guestsCount || 0;
          } else {
            const activeBookings = cachedBookings.filter(b => 
              b.bookingDate === data.bookingDate && 
              b.isKalyanaVirundhu && 
              b.kalyanaSlot === data.kalyanaSlot && 
              ['pending', 'confirmed', 'booked'].includes(b.status)
            );
            currentCount = activeBookings.reduce((sum, b) => sum + (b.partySize || 0), 0);
          }

          const slotConfig = this.getKalyanaSlots().find(s => s.range === data.kalyanaSlot);
          const capacity = slotConfig ? slotConfig.capacity : this.getKalyanaCapacity();

          if (currentCount + data.partySize > capacity) {
            throw new Error('SLOT_FULL');
          }

          const customerRef = doc(db, 'customers', cleanedPhone);
          const customerSnap = await transaction.get(customerRef);
          let customer: any;
          if (!customerSnap.exists()) {
            customer = {
              phone: formattedPhone,
              firstName: data.firstName,
              lastName: data.lastName,
              totalVisits: 0,
              lastVisitDate: new Date().toISOString(),
              noShowCount: 0,
              cancellationCount: 0,
              whatsappOptIn: data.whatsappOptIn,
              branchId: 'millpark',
              notes: data.notes || '',
              allergies: data.allergies || '',
            };
          } else {
            customer = customerSnap.data();
            customer.firstName = data.firstName;
            customer.lastName = data.lastName;
            customer.whatsappOptIn = data.whatsappOptIn;
            if (data.notes) customer.notes = data.notes;
            if (data.allergies) customer.allergies = data.allergies;
          }
          transaction.set(customerRef, customer);

          newBooking = {
            id: bookingId,
            phone: formattedPhone,
            firstName: data.firstName,
            lastName: data.lastName,
            partySize: data.partySize,
            childSeats: data.childSeats,
            adultsCount: data.adultsCount,
            childrenCount: data.childrenCount,
            childrenHighChairs: data.childrenHighChairs,
            whatsappOptIn: data.whatsappOptIn,
            type: data.type,
            status: data.type === 'walk-in' ? 'waiting' : 'pending',
            createdAt: new Date().toISOString(),
            bookingDate: data.bookingDate || null,
            bookingTime: data.bookingTime || null,
            isNewAlert: true,
            branchId: 'millpark',
            isKalyanaVirundhu: true,
            kalyanaSlot: data.kalyanaSlot,
            notes: data.notes || '',
            allergies: data.allergies || '',
            agreedConditions: data.agreedConditions || null,
          };

          const bookingRef = doc(db, 'bookings', bookingId);
          transaction.set(bookingRef, newBooking);

          transaction.set(slotOccupancyRef, {
            guestsCount: currentCount + data.partySize,
            lastUpdated: new Date().toISOString()
          });
        });

        playNewBookingChime();
        if (newBooking) {
          smsService.sendConfirmationSMS(newBooking).catch(err => console.warn('SMS send failed:', err));
        }
        return newBooking!;
      } catch (error: any) {
        if (error.message === 'SLOT_FULL') {
          throw new Error('This slot just filled up — please pick another');
        }
        throw error;
      }
    } else {
      try {
        let customer = cachedCustomers[cleanedPhone];
        if (!customer) {
          customer = {
            phone: formattedPhone,
            firstName: data.firstName,
            lastName: data.lastName,
            totalVisits: 0,
            lastVisitDate: new Date().toISOString(),
            noShowCount: 0,
            cancellationCount: 0,
            whatsappOptIn: data.whatsappOptIn,
            branchId: 'millpark',
            notes: data.notes || '',
            allergies: data.allergies || '',
          };
        } else {
          customer.firstName = data.firstName;
          customer.lastName = data.lastName;
          customer.whatsappOptIn = data.whatsappOptIn;
          if (data.notes) customer.notes = data.notes;
          if (data.allergies) customer.allergies = data.allergies;
          if (!customer.branchId) customer.branchId = 'millpark';
        }
        await safeSetDoc(doc(db, 'customers', cleanedPhone), customer);

        const bookingId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newBooking: Booking = {
          id: bookingId,
          phone: formattedPhone,
          firstName: data.firstName,
          lastName: data.lastName,
          partySize: data.partySize,
          childSeats: data.childSeats,
          adultsCount: data.adultsCount,
          childrenCount: data.childrenCount,
          childrenHighChairs: data.childrenHighChairs,
          whatsappOptIn: data.whatsappOptIn,
          type: data.type,
          status: data.type === 'walk-in' ? 'waiting' : 'pending',
          createdAt: new Date().toISOString(),
          bookingDate: data.type === 'walk-in' ? null : (data.bookingDate || null),
          bookingTime: data.type === 'walk-in' ? null : (data.bookingTime || null),
          isNewAlert: true,
          branchId: 'millpark',
          isKalyanaVirundhu: data.isKalyanaVirundhu || null,
          kalyanaSlot: data.kalyanaSlot || null,
          notes: data.notes || '',
          allergies: data.allergies || '',
          agreedConditions: data.agreedConditions || null,
        };

        if (newBooking.type === 'walk-in') {
          newBooking.estimatedWaitMinutes = this.calculateEstimatedWait(getRequiredTableSeats(newBooking));
        }

        await safeSetDoc(doc(db, 'bookings', bookingId), newBooking);

        if (newBooking.status === 'waiting') {
          await this.updateAllWaitingEstimates();
        }

        playNewBookingChime();
        if (newBooking) {
          smsService.sendConfirmationSMS(newBooking).catch(err => console.warn('SMS send failed:', err));
        }

        return newBooking;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'bookings');
        throw error;
      }
    }
  },

  async createManualBooking(data: {
    firstName: string;
    lastName?: string;
    phone?: string;
    partySize: number;
    childSeats: number;
    adultsCount?: number;
    childrenCount?: number;
    childrenHighChairs?: boolean[];
    whatsappOptIn: boolean;
    type: 'walk-in' | 'remote';
    bookingDate?: string;
    bookingTime?: string;
    isKalyanaVirundhu?: boolean;
    kalyanaSlot?: string;
    status: 'confirmed' | 'waiting';
    source: 'phone/staff';
    notes?: string;
    allergies?: string;
  }): Promise<Booking> {
    const isKalyana = data.isKalyanaVirundhu && data.kalyanaSlot && data.bookingDate;
    const cleanedPhone = data.phone ? cleanPhoneNumber(data.phone) : '';
    const formattedPhone = cleanedPhone ? formatAusMobile(data.phone!) : '';

    if (isKalyana) {
      const slotOccupancyRef = doc(db, 'slot_occupancy', `${data.bookingDate}_${data.kalyanaSlot}`);
      const bookingId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      let newBooking: Booking;

      try {
        await runTransaction(db, async (transaction) => {
          const occupancySnap = await transaction.get(slotOccupancyRef);
          let currentCount = 0;
          if (occupancySnap.exists()) {
            currentCount = occupancySnap.data().guestsCount || 0;
          } else {
            const activeBookings = cachedBookings.filter(b => 
              b.bookingDate === data.bookingDate && 
              b.isKalyanaVirundhu && 
              b.kalyanaSlot === data.kalyanaSlot && 
              ['pending', 'confirmed', 'booked'].includes(b.status)
            );
            currentCount = activeBookings.reduce((sum, b) => sum + (b.partySize || 0), 0);
          }

          const slotConfig = this.getKalyanaSlots().find(s => s.range === data.kalyanaSlot);
          const capacity = slotConfig ? slotConfig.capacity : this.getKalyanaCapacity();

          if (currentCount + data.partySize > capacity) {
            throw new Error('SLOT_FULL');
          }

          if (cleanedPhone) {
            const customerRef = doc(db, 'customers', cleanedPhone);
            const customerSnap = await transaction.get(customerRef);
            let customer: any;
            if (!customerSnap.exists()) {
              customer = {
                phone: formattedPhone,
                firstName: data.firstName,
                lastName: data.lastName || '',
                totalVisits: 0,
                lastVisitDate: new Date().toISOString(),
                noShowCount: 0,
                cancellationCount: 0,
                whatsappOptIn: data.whatsappOptIn,
                branchId: 'millpark',
                notes: data.notes || '',
                allergies: data.allergies || '',
              };
            } else {
              customer = customerSnap.data();
              if (data.firstName) customer.firstName = data.firstName;
              if (data.lastName) customer.lastName = data.lastName;
              customer.whatsappOptIn = data.whatsappOptIn;
              if (data.notes) customer.notes = data.notes;
              if (data.allergies) customer.allergies = data.allergies;
            }
            transaction.set(customerRef, customer);
          }

          newBooking = {
            id: bookingId,
            phone: formattedPhone,
            firstName: data.firstName,
            lastName: data.lastName || '',
            partySize: data.partySize,
            childSeats: data.childSeats,
            adultsCount: data.adultsCount,
            childrenCount: data.childrenCount,
            childrenHighChairs: data.childrenHighChairs,
            whatsappOptIn: data.whatsappOptIn,
            type: data.type,
            status: data.status,
            createdAt: new Date().toISOString(),
            bookingDate: data.bookingDate || null,
            bookingTime: data.bookingTime || null,
            isNewAlert: false,
            branchId: 'millpark',
            isKalyanaVirundhu: true,
            kalyanaSlot: data.kalyanaSlot,
            source: 'phone/staff',
            notes: data.notes || '',
            allergies: data.allergies || '',
          };

          const bookingRef = doc(db, 'bookings', bookingId);
          transaction.set(bookingRef, newBooking);

          transaction.set(slotOccupancyRef, {
            guestsCount: currentCount + data.partySize,
            lastUpdated: new Date().toISOString()
          });
        });

        return newBooking!;
      } catch (error: any) {
        if (error.message === 'SLOT_FULL') {
          throw new Error('This slot just filled up — please pick another');
        }
        throw error;
      }
    } else {
      try {
        if (cleanedPhone) {
          let customer = cachedCustomers[cleanedPhone];
          if (!customer) {
            customer = {
              phone: formattedPhone,
              firstName: data.firstName,
              lastName: data.lastName || '',
              totalVisits: 0,
              lastVisitDate: new Date().toISOString(),
              noShowCount: 0,
              cancellationCount: 0,
              whatsappOptIn: data.whatsappOptIn,
              branchId: 'millpark',
              notes: data.notes || '',
              allergies: data.allergies || '',
            };
          } else {
            if (data.firstName) customer.firstName = data.firstName;
            if (data.lastName) customer.lastName = data.lastName;
            customer.whatsappOptIn = data.whatsappOptIn;
            if (data.notes) customer.notes = data.notes;
            if (data.allergies) customer.allergies = data.allergies;
            if (!customer.branchId) customer.branchId = 'millpark';
          }
          await safeSetDoc(doc(db, 'customers', cleanedPhone), customer);
        }

        const bookingId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newBooking: Booking = {
          id: bookingId,
          phone: formattedPhone,
          firstName: data.firstName,
          lastName: data.lastName || '',
          partySize: data.partySize,
          childSeats: data.childSeats,
          adultsCount: data.adultsCount,
          childrenCount: data.childrenCount,
          childrenHighChairs: data.childrenHighChairs,
          whatsappOptIn: data.whatsappOptIn,
          type: data.type,
          status: data.status,
          createdAt: new Date().toISOString(),
          bookingDate: data.type === 'walk-in' ? null : (data.bookingDate || null),
          bookingTime: data.type === 'walk-in' ? null : (data.bookingTime || null),
          isNewAlert: false,
          branchId: 'millpark',
          isKalyanaVirundhu: null,
          kalyanaSlot: null,
          source: 'phone/staff',
          notes: data.notes || '',
          allergies: data.allergies || '',
        };

        if (newBooking.type === 'walk-in') {
          newBooking.estimatedWaitMinutes = this.calculateEstimatedWait(getRequiredTableSeats(newBooking));
        }

        await safeSetDoc(doc(db, 'bookings', bookingId), newBooking);

        if (newBooking.status === 'waiting') {
          await this.updateAllWaitingEstimates();
        }

        return newBooking;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'bookings');
        throw error;
      }
    }
  },

  getWaitingQueuePosition(bookingId: string): { position: number; totalWaiting: number; estimatedWaitMinutes: number } {
    const bookings = this.getBookings();
    const waitingList = bookings
      .filter((b) => b.status === 'waiting')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const index = waitingList.findIndex((b) => b.id === bookingId);
    if (index === -1) {
      return { position: 0, totalWaiting: waitingList.length, estimatedWaitMinutes: 0 };
    }

    const position = index + 1;
    const tables = this.getTables();
    const activeTables = tables.filter((t) => !t.isInactive);
    const vacantTables = activeTables.filter((t) => !t.isOccupied);

    let wait = 0;
    if (vacantTables.length > 0 && position === 1) {
      wait = 5;
    } else {
      wait = position * 15;
    }

    return {
      position,
      totalWaiting: waitingList.length,
      estimatedWaitMinutes: wait,
    };
  },

  calculateEstimatedWait(partySize: number): number {
    const tables = this.getTables();
    const vacantMatching = tables.filter(
      (t) => !t.isInactive && !t.isOccupied && (t.capacity >= partySize || t.maxOverrideCapacity >= partySize)
    );
    if (vacantMatching.length > 0) return 10;
    
    const waitingCount = this.getBookings().filter((b) => b.status === 'waiting').length;
    return (waitingCount + 1) * 15;
  },

  async allocateTable(bookingId: string, tableId: number, handledBy?: string, extraSeats: number = 0): Promise<{ success: boolean; error?: string }> {
    const prevTables = JSON.parse(JSON.stringify(cachedTables));
    const prevBookings = JSON.parse(JSON.stringify(cachedBookings));

    // Optimistic local update
    const optTable = cachedTables.find((t) => t.id === tableId);
    const optBooking = cachedBookings.find((b) => b.id === bookingId);
    if (optTable && optBooking && !optTable.isOccupied && !optTable.isInactive) {
      optTable.isOccupied = true;
      optTable.currentBookingId = bookingId;
      optTable.extraSeats = extraSeats;
      if (optTable.mergedWith) {
        const optOther = cachedTables.find((t) => t.id === optTable.mergedWith);
        if (optOther) {
          optOther.isOccupied = true;
          optOther.currentBookingId = bookingId;
        }
      }
      optBooking.status = 'seated';
      optBooking.tableId = tableId;
      optBooking.seatedAt = new Date().toISOString();
      notifyListeners();
    }

    try {
      const result = await safeRunTransaction(db, async (transaction) => {
        const tableDocRef = doc(db, 'tables', tableId.toString());
        const bookingDocRef = doc(db, 'bookings', bookingId);

        const tableSnap = await transaction.get(tableDocRef);
        const bookingSnap = await transaction.get(bookingDocRef);

        if (!tableSnap.exists()) {
          return { success: false, error: 'Table not found' };
        }
        if (!bookingSnap.exists()) {
          return { success: false, error: 'Booking not found' };
        }

        const table = tableSnap.data() as Table;
        const booking = bookingSnap.data() as Booking;

        if (table.isInactive) {
          return { success: false, error: `Cannot allocate to inactive ${table.name || `Table ${tableId}`}` };
        }

        if (table.isOccupied) {
          return { success: false, error: 'table just taken' };
        }

        const requiredSeats = getRequiredTableSeats(booking);
        let maxCap = table.capacity + extraSeats;
        if (table.mergedWith) {
          const otherTable = cachedTables.find((t) => t.id === table.mergedWith);
          if (otherTable) {
            maxCap += otherTable.capacity + (otherTable.extraSeats || 0);
          }
        }
        maxCap = Math.max(maxCap, table.maxOverrideCapacity);

        if (requiredSeats > maxCap) {
          return { 
            success: false, 
            error: `Party of ${booking.partySize} (${requiredSeats} required table seats) exceeds Table ${tableId} maximum capacity (${maxCap})` 
          };
        }

        transaction.update(tableDocRef, sanitizeOutgoingData({
          isOccupied: true,
          currentBookingId: booking.id,
          extraSeats
        }));

        if (table.mergedWith) {
          const otherDocRef = doc(db, 'tables', table.mergedWith.toString());
          transaction.update(otherDocRef, sanitizeOutgoingData({
            isOccupied: true,
            currentBookingId: booking.id
          }));
        }

        const bookingUpdate: any = {
          status: 'seated',
          tableId: tableId,
          seatedAt: new Date().toISOString(),
          isNewAlert: false
        };
        const handledByVal = handledBy || getSessionHandledBy();
        if (handledByVal) {
          bookingUpdate.handledBy = handledByVal;
        }

        transaction.update(bookingDocRef, sanitizeOutgoingData(bookingUpdate));

        return { success: true };
      });

      if (result.success) {
        await this.updateAllWaitingEstimates();
        await this.syncSlotOccupancyForBookingId(bookingId);
      } else {
        cachedTables = prevTables;
        cachedBookings = prevBookings;
        notifyListeners();
      }

      return result;
    } catch (error) {
      cachedTables = prevTables;
      cachedBookings = prevBookings;
      notifyListeners();
      console.error("Allocation transaction error:", error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('justDosaWriteError', { 
          detail: { message: "Something went wrong, please try again or see staff." } 
        }));
      }
      return { success: false, error: 'Something went wrong, please try again or see staff.' };
    }
  },

  async finishSeatedParty(tableId: number, handledBy?: string): Promise<void> {
    const tableToFinish = cachedTables.find((t) => t.id === tableId);
    const bId = tableToFinish?.currentBookingId;

    // Find all tables that share this tableId OR bookingId OR are merged with tableId
    const affectedTables = cachedTables.filter(t => 
      t.id === tableId || 
      (bId && t.currentBookingId === bId) || 
      t.mergedWith === tableId || 
      (tableToFinish?.mergedWith && t.id === tableToFinish.mergedWith)
    );

    // Optimistic local update for all affected tables
    for (const t of affectedTables) {
      t.isOccupied = false;
      t.currentBookingId = undefined;
      t.mergedWith = undefined;
      t.extraSeats = 0;
    }

    if (bId) {
      const optBooking = cachedBookings.find((b) => b.id === bId);
      if (optBooking) {
        optBooking.status = 'finished';
        optBooking.finishedAt = new Date().toISOString();
      }
    }
    notifyListeners();

    try {
      // 1. Free all affected tables in Firestore
      for (const t of affectedTables) {
        const tableDocRef = doc(db, 'tables', t.id.toString());
        await safeSetDoc(tableDocRef, {
          isOccupied: false,
          currentBookingId: null,
          mergedWith: deleteField(),
          extraSeats: 0
        }, { merge: true });
      }

      // Also directly clear the main tableDocRef just in case
      const mainRef = doc(db, 'tables', tableId.toString());
      await safeSetDoc(mainRef, {
        isOccupied: false,
        currentBookingId: null,
        mergedWith: deleteField(),
        extraSeats: 0
      }, { merge: true });

      // 2. Mark booking finished if exists
      if (bId) {
        const bookingDocRef = doc(db, 'bookings', bId);
        const bookingSnap = await getDoc(bookingDocRef);
        if (bookingSnap.exists()) {
          const booking = bookingSnap.data() as Booking;
          const finishedAt = new Date().toISOString();

          const bookingUpdate: any = {
            status: 'finished',
            finishedAt
          };
          const handledByVal = handledBy || getSessionHandledBy();
          if (handledByVal) {
            bookingUpdate.handledBy = handledByVal;
          }

          await safeSetDoc(bookingDocRef, bookingUpdate, { merge: true });

          const cleaned = cleanPhoneNumber(booking.phone);
          if (cleaned) {
            const customerDocRef = doc(db, 'customers', cleaned);
            const customerSnap = await getDoc(customerDocRef);
            if (customerSnap.exists()) {
              const customer = customerSnap.data() as Customer;
              await safeSetDoc(customerDocRef, {
                totalVisits: (customer.totalVisits || 0) + 1,
                lastVisitDate: finishedAt,
                firstName: booking.firstName || customer.firstName,
                lastName: booking.lastName || customer.lastName
              }, { merge: true });
            } else {
              await safeSetDoc(customerDocRef, {
                phone: booking.phone,
                firstName: booking.firstName,
                lastName: booking.lastName,
                totalVisits: 1,
                lastVisitDate: finishedAt,
                noShowCount: 0,
                cancellationCount: 0,
                whatsappOptIn: booking.whatsappOptIn,
                branchId: 'millpark',
              });
            }
          }
        }
      }

      await this.updateAllWaitingEstimates();
      if (bId) {
        await this.syncSlotOccupancyForBookingId(bId);
      }
    } catch (error) {
      console.error("Error in finishSeatedParty:", error);
      handleFirestoreError(error, OperationType.WRITE, `tables/${tableId}`);
    }
  },

  async autoFinishPreviousDaySeatedParties(): Promise<number> {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
      const nowMs = Date.now();
      let count = 0;

      const occupiedTables = cachedTables.filter(t => t.isOccupied);
      for (const table of occupiedTables) {
        let shouldFinish = false;
        if (!table.currentBookingId) {
          shouldFinish = true;
        } else {
          const booking = cachedBookings.find(b => b.id === table.currentBookingId);
          if (!booking || booking.status === 'finished' || booking.status === 'cancelled') {
            shouldFinish = true;
          } else {
            const refDateStr = booking.bookingDate || (booking.seatedAt ? booking.seatedAt.split('T')[0] : booking.createdAt.split('T')[0]);
            const seatedMs = booking.seatedAt ? new Date(booking.seatedAt).getTime() : new Date(booking.createdAt).getTime();
            const elapsedHours = (nowMs - seatedMs) / (1000 * 3600);
            
            if (refDateStr < todayStr || elapsedHours > 14) {
              shouldFinish = true;
            }
          }
        }

        if (shouldFinish) {
          console.log(`Auto-finishing stale occupied table ${table.id} (${table.name})`);
          await this.finishSeatedParty(table.id);
          count++;
        }
      }
      if (count > 0) {
        await this.updateAllWaitingEstimates();
      }
      return count;
    } catch (err) {
      console.error("Error auto-finishing stale tables:", err);
      return 0;
    }
  },

  getLiveSeatAvailability(date?: string, time?: string) {
    const activeTables = cachedTables.filter(t => !t.isInactive);
    const totalTables = activeTables.length;
    const vacantTables = activeTables.filter(t => !t.isOccupied).length;
    const totalCapacity = activeTables.reduce((sum, t) => sum + t.capacity + (t.extraSeats || 0), 0);
    const availableSeats = activeTables
      .filter(t => !t.isOccupied)
      .reduce((sum, t) => sum + t.capacity + (t.extraSeats || 0), 0);

    let bookedSeatsForSlot = 0;
    if (date) {
      const slotBookings = cachedBookings.filter(b => {
        if (b.bookingDate !== date) return false;
        if (time && b.bookingTime && b.bookingTime !== time) return false;
        return ['pending', 'confirmed', 'booked', 'seated'].includes(b.status);
      });
      bookedSeatsForSlot = slotBookings.reduce((sum, b) => sum + b.partySize, 0);
    }

    return {
      totalTables,
      vacantTables,
      totalCapacity,
      availableSeats,
      bookedSeatsForSlot,
      availableForSlot: Math.max(0, totalCapacity - bookedSeatsForSlot)
    };
  },

  async markBookingArrived(bookingId: string) {
    const optBooking = cachedBookings.find(b => b.id === bookingId);
    if (optBooking) {
      optBooking.status = 'waiting';
      notifyListeners();
    }
    try {
      await safeSetDoc(doc(db, 'bookings', bookingId), {
        status: 'waiting',
        createdAt: new Date().toISOString()
      }, { merge: true });
      await this.updateAllWaitingEstimates();
      await this.syncSlotOccupancyForBookingId(bookingId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async confirmBooking(bookingId: string, handledBy?: string) {
    const optBooking = cachedBookings.find(b => b.id === bookingId);
    if (optBooking) {
      optBooking.status = 'confirmed';
      optBooking.isNewAlert = false;
      const handledByVal = handledBy || getSessionHandledBy();
      if (handledByVal) optBooking.handledBy = handledByVal;
      notifyListeners();
    }
    try {
      const bookingUpdate: any = {
        status: 'confirmed',
        isNewAlert: false
      };
      const handledByVal = handledBy || getSessionHandledBy();
      if (handledByVal) {
        bookingUpdate.handledBy = handledByVal;
      }
      await safeSetDoc(doc(db, 'bookings', bookingId), bookingUpdate, { merge: true });
      await this.syncSlotOccupancyForBookingId(bookingId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async declineBooking(bookingId: string) {
    const optBooking = cachedBookings.find(b => b.id === bookingId);
    if (optBooking) {
      optBooking.status = 'declined';
      optBooking.isNewAlert = false;
      notifyListeners();
    }
    try {
      await safeSetDoc(doc(db, 'bookings', bookingId), {
        status: 'declined',
        isNewAlert: false
      }, { merge: true });
      await this.syncSlotOccupancyForBookingId(bookingId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async requestBookingChange(bookingId: string, noteOrDate: string, newTime?: string) {
    try {
      const docRef = doc(db, 'bookings', bookingId);
      if (newTime) {
        const snap = await getDoc(docRef);
        const booking = snap.exists() ? (snap.data() as Booking) : null;
        await safeSetDoc(docRef, {
          previousBookingDate: booking?.bookingDate || null,
          previousBookingTime: booking?.bookingTime || null,
          bookingDate: noteOrDate,
          bookingTime: newTime,
          changeRequestedNote: `Change requested: was ${booking?.bookingDate || ''} at ${booking?.bookingTime || ''}`,
          status: 'pending',
          isNewAlert: true
        }, { merge: true });
      } else {
        await safeSetDoc(docRef, {
          changeRequestedNote: noteOrDate,
          status: 'pending',
          isNewAlert: true
        }, { merge: true });
      }
      await this.syncSlotOccupancyForBookingId(bookingId);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async seatWalkInDirectly(tableId: number, partySize: number, name = 'Walk-In', phone = '0400 000 000', childSeats = 0, handledBy?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const tableDocRef = doc(db, 'tables', tableId.toString());
      const tableSnap = await getDoc(tableDocRef);
      if (!tableSnap.exists()) return { success: false, error: 'Table not found' };
      const table = tableSnap.data() as Table;
      if (table.isOccupied) return { success: false, error: 'Table is already occupied' };
      if (table.isInactive) return { success: false, error: 'Table is inactive' };

      const bookingId = `bk-direct-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
      const handledByVal = handledBy || getSessionHandledBy();
      const newBooking: Booking = {
        id: bookingId,
        phone: formatAusMobile(phone),
        firstName: name,
        lastName: '',
        partySize,
        childSeats,
        whatsappOptIn: false,
        type: 'walk-in',
        status: 'seated',
        createdAt: new Date().toISOString(),
        seatedAt: new Date().toISOString(),
        tableId,
        branchId: 'millpark',
        bookingDate: null,
        bookingTime: null,
        ...(handledByVal ? { handledBy: handledByVal } : {})
      };

      await safeSetDoc(doc(db, 'bookings', bookingId), newBooking);
      await safeSetDoc(tableDocRef, { isOccupied: true, currentBookingId: bookingId }, { merge: true });
      await this.updateAllWaitingEstimates();

      return { success: true };
    } catch (error) {
      console.error("seatWalkInDirectly error:", error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('justDosaWriteError', { 
          detail: { message: "Something went wrong, please try again or see staff." } 
        }));
      }
      return { success: false, error: 'Something went wrong, please try again or see staff.' };
    }
  },

  async markBookingNoShow(bookingId: string, handledBy?: string) {
    const optBooking = cachedBookings.find(b => b.id === bookingId);
    if (optBooking) {
      optBooking.status = 'no-show';
      const handledByVal = handledBy || getSessionHandledBy();
      if (handledByVal) optBooking.handledBy = handledByVal;
      notifyListeners();
    }
    try {
      const docRef = doc(db, 'bookings', bookingId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const booking = snap.data() as Booking;
        const bookingUpdate: any = {
          status: 'no-show'
        };
        const handledByVal = handledBy || getSessionHandledBy();
        if (handledByVal) {
          bookingUpdate.handledBy = handledByVal;
        }
        await safeSetDoc(docRef, bookingUpdate, { merge: true });

        const cleaned = cleanPhoneNumber(booking.phone);
        const customerDocRef = doc(db, 'customers', cleaned);
        const custSnap = await getDoc(customerDocRef);
        if (custSnap.exists()) {
          const cust = custSnap.data() as Customer;
          await safeSetDoc(customerDocRef, {
            noShowCount: (cust.noShowCount || 0) + 1
          }, { merge: true });
        }
        await this.updateAllWaitingEstimates();
        await this.syncSlotOccupancyForBookingId(bookingId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async cancelBooking(bookingId: string) {
    try {
      const docRef = doc(db, 'bookings', bookingId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const booking = snap.data() as Booking;
        await safeSetDoc(docRef, {
          status: 'cancelled'
        }, { merge: true });

        const cleaned = cleanPhoneNumber(booking.phone);
        const customerDocRef = doc(db, 'customers', cleaned);
        const custSnap = await getDoc(customerDocRef);
        if (custSnap.exists()) {
          const cust = custSnap.data() as Customer;
          await safeSetDoc(customerDocRef, {
            cancellationCount: (cust.cancellationCount || 0) + 1
          }, { merge: true });
        }
        await this.updateAllWaitingEstimates();
        await this.syncSlotOccupancyForBookingId(bookingId);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async syncSlotOccupancyDoc(date: string, slot: string) {
    try {
      const activeBookings = cachedBookings.filter(b => 
        b.bookingDate === date && 
        b.isKalyanaVirundhu && 
        b.kalyanaSlot === slot && 
        ['pending', 'confirmed', 'booked'].includes(b.status)
      );
      const count = activeBookings.reduce((sum, b) => sum + (b.partySize || 0), 0);
      await safeSetDoc(doc(db, 'slot_occupancy', `${date}_${slot}`), {
        guestsCount: count,
        lastUpdated: new Date().toISOString()
      });
    } catch (err) {
      console.error("Error syncing slot occupancy: ", err);
    }
  },

  async syncSlotOccupancyForBookingId(bookingId: string) {
    try {
      const bDoc = await getDoc(doc(db, 'bookings', bookingId));
      if (bDoc.exists()) {
        const b = bDoc.data() as Booking;
        if (b.isKalyanaVirundhu && b.bookingDate && b.kalyanaSlot) {
          await this.syncSlotOccupancyDoc(b.bookingDate, b.kalyanaSlot);
        }
      }
    } catch (err) {
      console.error("Error in syncSlotOccupancyForBookingId: ", err);
    }
  },

  async updateAllWaitingEstimates() {
    try {
      const batch = writeBatch(db);
      let modified = false;
      cachedBookings.forEach((b) => {
        if (b.status === 'waiting') {
          const q = this.getWaitingQueuePosition(b.id);
          if (b.estimatedWaitMinutes !== q.estimatedWaitMinutes) {
            const docRef = doc(db, 'bookings', b.id);
            batch.update(docRef, sanitizeData({ estimatedWaitMinutes: q.estimatedWaitMinutes }));
            modified = true;
          }
        }
      });
      if (modified) {
        await safeCommitBatch(batch);
      }
    } catch (err) {
      console.error("Error in updateAllWaitingEstimates:", err);
    }
  },

  async clearNewAlerts(tabType: 'waiting' | 'booked') {
    try {
      const batch = writeBatch(db);
      let modified = false;
      cachedBookings.forEach((b) => {
        if (b.isNewAlert && ((tabType === 'waiting' && b.status === 'waiting') || (tabType === 'booked' && b.status === 'booked'))) {
          const docRef = doc(db, 'bookings', b.id);
          batch.update(docRef, sanitizeData({ isNewAlert: false }));
          modified = true;
        }
      });
      if (modified) {
        await safeCommitBatch(batch);
      }
    } catch (error) {
      console.error("clearNewAlerts error:", error);
    }
  },

  getDailyStats(): DailyStats {
    const bookings = this.getBookings();
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const todayBookings = bookings.filter((b) => {
      if (b.status === 'cancelled' || b.status === 'no-show') return false;
      const createdStr = b.createdAt.split('T')[0];
      const seatedStr = b.seatedAt ? b.seatedAt.split('T')[0] : '';
      return createdStr === todayStr || seatedStr === todayStr || b.status === 'seated' || b.status === 'finished';
    });

    const totalServedToday = todayBookings
      .filter((b) => b.status === 'seated' || b.status === 'finished')
      .reduce((sum, b) => sum + b.partySize, 0);

    const seatedWalkIns = todayBookings.filter((b) => b.seatedAt && (b.type === 'walk-in' || b.type === 'walkskin'));
    let totalWaitMins = 0;
    seatedWalkIns.forEach((b) => {
      const waitMs = new Date(b.seatedAt!).getTime() - new Date(b.createdAt).getTime();
      totalWaitMins += Math.max(1, Math.round(waitMs / 60000));
    });
    const avgWaitTimeMinutes = seatedWalkIns.length > 0 ? Math.round(totalWaitMins / seatedWalkIns.length) : 18;

    const finishedParties = todayBookings.filter((b) => b.finishedAt && b.seatedAt);
    let totalTurnMins = 0;
    finishedParties.forEach((b) => {
      const turnMs = new Date(b.finishedAt!).getTime() - new Date(b.seatedAt!).getTime();
      totalTurnMins += Math.max(10, Math.round(turnMs / 60000));
    });
    const avgTableTurnMinutes = finishedParties.length > 0 ? Math.round(totalTurnMins / finishedParties.length) : 42;

    const hoursMap: Record<string, number> = {
      '11:00': 0, '12:00': 3, '13:00': 7, '14:00': 4,
      '17:00': 5, '18:00': 9, '19:00': 14, '20:00': 11, '21:00': 6
    };

    todayBookings.forEach((b) => {
      const dateObj = new Date(b.createdAt);
      const hour = `${dateObj.getHours().toString().padStart(2, '0')}:00`;
      hoursMap[hour] = (hoursMap[hour] || 0) + 1;
    });

    const hourlyBookings = Object.entries(hoursMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([hour, count]) => ({ hour, count }));

    let busiestHour = '19:00';
    let maxCount = 0;
    hourlyBookings.forEach((hb) => {
      if (hb.count > maxCount) {
        maxCount = hb.count;
        busiestHour = hb.hour;
      }
    });

    return {
      totalServedToday: totalServedToday || 28,
      avgWaitTimeMinutes,
      busiestHour: `${busiestHour} (${maxCount} parties)`,
      avgTableTurnMinutes,
      hourlyBookings,
    };
  },

  async deleteCustomer(phoneKey: string) {
    try {
      const cleaned = cleanPhoneNumber(phoneKey);
      await safeDeleteDoc(doc(db, 'customers', cleaned));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${phoneKey}`);
    }
  },

  async mergeCustomers(primaryPhoneKey: string, secondaryPhoneKey: string, keepPrimaryName: boolean) {
    try {
      const primaryClean = cleanPhoneNumber(primaryPhoneKey);
      const secondaryClean = cleanPhoneNumber(secondaryPhoneKey);

      const primaryDocRef = doc(db, 'customers', primaryClean);
      const secondaryDocRef = doc(db, 'customers', secondaryClean);

      const primarySnap = await getDoc(primaryDocRef);
      const secondarySnap = await getDoc(secondaryDocRef);

      if (!primarySnap.exists() || !secondarySnap.exists()) return;

      const primary = primarySnap.data() as Customer;
      const secondary = secondarySnap.data() as Customer;

      primary.totalVisits = (primary.totalVisits || 0) + (secondary.totalVisits || 0);
      primary.noShowCount = (primary.noShowCount || 0) + (secondary.noShowCount || 0);
      primary.cancellationCount = (primary.cancellationCount || 0) + (secondary.cancellationCount || 0);

      const dateA = new Date(primary.lastVisitDate).getTime();
      const dateB = new Date(secondary.lastVisitDate).getTime();
      if (isNaN(dateA) || dateB > dateA) {
        primary.lastVisitDate = secondary.lastVisitDate;
      }

      if (!keepPrimaryName) {
        primary.firstName = secondary.firstName;
        primary.lastName = secondary.lastName;
      }

      primary.whatsappOptIn = primary.whatsappOptIn || secondary.whatsappOptIn;

      const batch = writeBatch(db);
      batch.set(primaryDocRef, sanitizeData(primary));
      batch.delete(secondaryDocRef);

      cachedBookings.forEach(b => {
        if (cleanPhoneNumber(b.phone) === secondaryClean) {
          const bookingDocRef = doc(db, 'bookings', b.id);
          batch.update(bookingDocRef, sanitizeData({
            phone: primary.phone,
            firstName: primary.firstName,
            lastName: primary.lastName
          }));
        }
      });

      await safeCommitBatch(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  },

  async resetToSeedData() {
    try {
      const batch = writeBatch(db);

      cachedBookings.forEach(b => {
        batch.delete(doc(db, 'bookings', b.id));
      });
      cachedTables.forEach(t => {
        batch.delete(doc(db, 'tables', t.id.toString()));
      });
      Object.keys(cachedCustomers).forEach(phone => {
        batch.delete(doc(db, 'customers', phone));
      });

      await safeCommitBatch(batch);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'all');
    }
  }
};
