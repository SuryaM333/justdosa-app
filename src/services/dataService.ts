import { Booking, Customer, DailyStats, Table } from '../types';
import { cleanPhoneNumber, formatAusMobile } from '../utils/phone';
import { playNewBookingChime } from '../utils/sound';
import { getRequiredTableSeats } from '../utils/bookingUtils';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  runTransaction,
  writeBatch,
  deleteDoc,
  deleteField
} from 'firebase/firestore';
import { hashPin } from '../utils/crypto';

// ----------------------------------------------------
// FIREBASE FIRESTORE INITIALIZATION
// ----------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDOUFuzmLPwJUjoRFagzlHGOVg9hLu9enY",
  authDomain: "just-dosa.firebaseapp.com",
  projectId: "just-dosa",
  storageBucket: "just-dosa.firebasestorage.app",
  messagingSenderId: "476516299106",
  appId: "1:476516299106:web:718797bbfe16d576dbfc3b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

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
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeData(item)) as any;
  }
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        res[key] = sanitizeData(val);
      }
    }
    return res;
  }
  return obj;
}

async function safeSetDoc(docRef: any, data: any, options?: any) {
  const sanitized = sanitizeData(data);
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

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener());
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('justDosaDataChange'));
  }
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
  }
};

const INITIAL_TABLES: Table[] = [
  { id: 1, name: 'Table 1', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=1', position: { column: 'right', order: 3 } },
  { id: 2, name: 'Table 2', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=2', position: { column: 'right', order: 2 } },
  { id: 3, name: 'Table 3', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=3', position: { column: 'right', order: 1 } },
  { id: 4, name: 'Table 4', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=4', position: { column: 'top', order: 1 } },
  { id: 5, name: 'Table 5', capacity: 2, maxOverrideCapacity: 3, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=5', position: { column: 'middle', order: 1, isDiamond: true } },
  { id: 6, name: 'Table 6', capacity: 2, maxOverrideCapacity: 3, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=6', position: { column: 'middle', order: 2, isDiamond: true } },
  { id: 7, name: 'Table 7', capacity: 2, maxOverrideCapacity: 3, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=7', position: { column: 'middle', order: 3, isDiamond: true } },
  { id: 8, name: 'Table 8', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=8', position: { column: 'left', order: 3 } },
  { id: 9, name: 'Table 9', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=9', position: { column: 'left', order: 2 } },
  { id: 10, name: 'Table 10', capacity: 6, maxOverrideCapacity: 6, isOccupied: false, isInactive: false, branchId: 'millpark', orderingUrl: 'https://example.com/order?table=10', position: { column: 'left', order: 1 } },
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
        cachedSettings = docSnap.data();
        notifyListeners();
      }
    } catch (err) {
      console.error("Error in settings sync: ", err);
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
      console.error("Error in secure pins sync: ", err);
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
        querySnap.forEach((doc) => {
          tables.push(doc.data() as Table);
        });
        tables.sort((a, b) => a.id - b.id);
        cachedTables = tables;
        notifyListeners();
      }
    } catch (err) {
      console.error("Error in tables sync: ", err);
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
          bookings.push(doc.data() as Booking);
        });
        cachedBookings = bookings;
        notifyListeners();
      }
    } catch (err) {
      console.error("Error in bookings sync: ", err);
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
          customers[doc.id] = doc.data() as Customer;
        });
        cachedCustomers = customers;
        notifyListeners();
      }
    } catch (err) {
      console.error("Error in customers sync: ", err);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, 'customers');
  });
}

// Kickstart synchronization immediately on module import
if (typeof window !== 'undefined') {
  initFirestoreSync();
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
    return cachedSettings?.openingHours || DEFAULT_SETTINGS.openingHours;
  },

  async setOpeningHours(openingHours: any) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { openingHours }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getLunchBuffer(): number {
    return cachedSettings?.lunchBuffer !== undefined ? cachedSettings.lunchBuffer : 30;
  },

  async setLunchBuffer(buffer: number) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { lunchBuffer: buffer }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getDinnerBuffer(): number {
    return cachedSettings?.dinnerBuffer !== undefined ? cachedSettings.dinnerBuffer : 30;
  },

  async setDinnerBuffer(buffer: number) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { dinnerBuffer: buffer }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getSlotInterval(): number {
    return cachedSettings?.slotInterval !== undefined ? cachedSettings.slotInterval : 15;
  },

  async setSlotInterval(interval: number) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { slotInterval: interval }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  isKalyanaEnabled(): boolean {
    return cachedSettings?.kalyanaEnabled !== undefined ? cachedSettings.kalyanaEnabled : true;
  },

  async setKalyanaEnabled(enabled: boolean) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { kalyanaEnabled: enabled }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getKalyanaSlots(): { id: string; range: string; capacity: number }[] {
    return cachedSettings?.kalyanaSlots || DEFAULT_SETTINGS.kalyanaSlots;
  },

  async setKalyanaSlots(slots: any[]) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { kalyanaSlots: slots }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getCustomerTexts(): { welcomeLine: string; waitingReassurance: string; tableReadyTemplate: string; thankYouMessage: string; noOrderingUrlNote: string } {
    return cachedSettings?.customerTexts || DEFAULT_SETTINGS.customerTexts;
  },

  async setCustomerTexts(customerTexts: any) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { customerTexts }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  },

  getWaitTimeAlertThresholds(): { low: number; medium: number; high: number } {
    return cachedSettings?.waitTimeAlertThresholds || DEFAULT_SETTINGS.waitTimeAlertThresholds;
  },

  async setWaitTimeAlertThresholds(waitTimeAlertThresholds: { low: number; medium: number; high: number }) {
    try {
      await safeSetDoc(doc(db, 'settings', 'global'), { waitTimeAlertThresholds }, { merge: true });
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  getTables(): Table[] {
    if (cachedTables.length === 0) {
      return INITIAL_TABLES;
    }
    return cachedTables;
  },

  async saveTables(tables: Table[]) {
    try {
      const batch = writeBatch(db);
      tables.forEach((t) => {
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

  getCustomerByPhone(phone: string): Customer | null {
    const cleaned = cleanPhoneNumber(phone);
    return cachedCustomers[cleaned] || null;
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
  }): Promise<Booking> {
    const formattedPhone = formatAusMobile(data.phone);
    const cleanedPhone = cleanPhoneNumber(data.phone);

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
        };
      } else {
        customer.firstName = data.firstName;
        customer.lastName = data.lastName;
        customer.whatsappOptIn = data.whatsappOptIn;
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
      };

      if (newBooking.type === 'walk-in') {
        newBooking.estimatedWaitMinutes = this.calculateEstimatedWait(getRequiredTableSeats(newBooking));
      }

      await safeSetDoc(doc(db, 'bookings', bookingId), newBooking);

      if (newBooking.status === 'waiting') {
        await this.updateAllWaitingEstimates();
      }

      playNewBookingChime();

      return newBooking;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bookings');
      throw error;
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
  }): Promise<Booking> {
    try {
      const cleanedPhone = data.phone ? cleanPhoneNumber(data.phone) : '';
      const formattedPhone = cleanedPhone ? formatAusMobile(data.phone!) : '';

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
          };
        } else {
          if (data.firstName) customer.firstName = data.firstName;
          if (data.lastName) customer.lastName = data.lastName;
          customer.whatsappOptIn = data.whatsappOptIn;
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
        isKalyanaVirundhu: data.isKalyanaVirundhu || null,
        kalyanaSlot: data.kalyanaSlot || null,
        source: 'phone/staff',
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

  async allocateTable(bookingId: string, tableId: number): Promise<{ success: boolean; error?: string }> {
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
          return { success: false, error: 'Cannot allocate to inactive Table 7' };
        }

        if (table.isOccupied) {
          return { success: false, error: 'table just taken' };
        }

        const requiredSeats = getRequiredTableSeats(booking);
        if (requiredSeats > table.maxOverrideCapacity) {
          return { 
            success: false, 
            error: `Party of ${booking.partySize} (${requiredSeats} required table seats) exceeds Table ${tableId} maximum capacity (${table.maxOverrideCapacity})` 
          };
        }

        transaction.update(tableDocRef, sanitizeData({
          isOccupied: true,
          currentBookingId: booking.id
        }));

        transaction.update(bookingDocRef, sanitizeData({
          status: 'seated',
          tableId: tableId,
          seatedAt: new Date().toISOString(),
          isNewAlert: false
        }));

        return { success: true };
      });

      if (result.success) {
        await this.updateAllWaitingEstimates();
      }

      return result;
    } catch (error) {
      console.error("Allocation transaction error:", error);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('justDosaWriteError', { 
          detail: { message: "Something went wrong, please try again or see staff." } 
        }));
      }
      return { success: false, error: 'Something went wrong, please try again or see staff.' };
    }
  },

  async finishSeatedParty(tableId: number): Promise<void> {
    try {
      const tableDocRef = doc(db, 'tables', tableId.toString());
      const tableSnap = await getDoc(tableDocRef);
      if (!tableSnap.exists()) return;
      const table = tableSnap.data() as Table;
      if (!table.currentBookingId) return;

      const bookingDocRef = doc(db, 'bookings', table.currentBookingId);
      const bookingSnap = await getDoc(bookingDocRef);

      if (bookingSnap.exists()) {
        const booking = bookingSnap.data() as Booking;
        const finishedAt = new Date().toISOString();

        await safeSetDoc(bookingDocRef, {
          status: 'finished',
          finishedAt
        }, { merge: true });

        const cleaned = cleanPhoneNumber(booking.phone);
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

      await safeSetDoc(tableDocRef, {
        isOccupied: false,
        currentBookingId: null
      }, { merge: true });

      await this.updateAllWaitingEstimates();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tables/${tableId}`);
    }
  },

  async markBookingArrived(bookingId: string) {
    try {
      await safeSetDoc(doc(db, 'bookings', bookingId), {
        status: 'waiting',
        createdAt: new Date().toISOString()
      }, { merge: true });
      await this.updateAllWaitingEstimates();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async confirmBooking(bookingId: string) {
    try {
      await safeSetDoc(doc(db, 'bookings', bookingId), {
        status: 'confirmed',
        isNewAlert: false
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async declineBooking(bookingId: string) {
    try {
      await safeSetDoc(doc(db, 'bookings', bookingId), {
        status: 'declined',
        isNewAlert: false
      }, { merge: true });
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
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
    }
  },

  async seatWalkInDirectly(tableId: number, partySize: number, name = 'Walk-In', phone = '0400 000 000', childSeats = 0): Promise<{ success: boolean; error?: string }> {
    try {
      const tableDocRef = doc(db, 'tables', tableId.toString());
      const tableSnap = await getDoc(tableDocRef);
      if (!tableSnap.exists()) return { success: false, error: 'Table not found' };
      const table = tableSnap.data() as Table;
      if (table.isOccupied) return { success: false, error: 'Table is already occupied' };
      if (table.isInactive) return { success: false, error: 'Table is inactive' };

      const bookingId = `bk-direct-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
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

  async markBookingNoShow(bookingId: string) {
    try {
      const docRef = doc(db, 'bookings', bookingId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const booking = snap.data() as Booking;
        await safeSetDoc(docRef, {
          status: 'no-show'
        }, { merge: true });

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
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `bookings/${bookingId}`);
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
