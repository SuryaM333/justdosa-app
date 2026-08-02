import React, { useState, useEffect } from 'react';
import { 
  KeyRound, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Smartphone, 
  Clock, 
  Save, 
  Settings as SettingsIcon, 
  LayoutGrid, 
  MessageSquare, 
  Calendar, 
  Check, 
  X,
  AlertTriangle,
  Info,
  Phone,
  Palette,
  Image as ImageIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import { dataService } from '../../services/dataService';
import { Table, LandmarkPosition } from '../../types';

export const SettingsTab: React.FC = () => {
  // Navigation for Sub-Tabs
  const [activeSubTab, setActiveSubTab] = useState<'hours' | 'kalyana' | 'tables' | 'texts' | 'appearance' | 'security' | 'device'>('hours');

  // Form states initialized with live data from dataService
  // PIN change: leaving new/current/retype all blank keeps the existing PIN.
  // Typing a new PIN requires the current PIN (verified against the real
  // hash via dataService.verifyStaffPin/verifyOwnerPin) and a matching retype.
  const [staffPin, setStaffPin] = useState('');
  const [currentStaffPin, setCurrentStaffPin] = useState('');
  const [retypeStaffPin, setRetypeStaffPin] = useState('');
  const [showNewStaffPin, setShowNewStaffPin] = useState(false);
  const [ownerPin, setOwnerPin] = useState('');
  const [currentOwnerPin, setCurrentOwnerPin] = useState('');
  const [retypeOwnerPin, setRetypeOwnerPin] = useState('');
  const [showNewOwnerPin, setShowNewOwnerPin] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(() => dataService.getWhatsAppNumber());
  const [lunchBuffer, setLunchBuffer] = useState(() => dataService.getLunchBuffer().toString());
  const [dinnerBuffer, setDinnerBuffer] = useState(() => dataService.getDinnerBuffer().toString());
  const [slotInterval, setSlotInterval] = useState(() => dataService.getSlotInterval().toString());
  const [kalyanaEnabled, setKalyanaEnabled] = useState(() => dataService.isKalyanaEnabled());
  const [kalyanaCutoffMinutes, setKalyanaCutoffMinutes] = useState(() => dataService.getKalyanaCutoffMinutes().toString());
  const [kalyanaTurnMinutes, setKalyanaTurnMinutes] = useState(() => dataService.getKalyanaTurnMinutes().toString());
  const [kalyanaSlots, setKalyanaSlots] = useState(() => dataService.getKalyanaSlots().map(s => ({ ...s })));
  const [customerTexts, setCustomerTexts] = useState(() => ({ ...dataService.getCustomerTexts() }));
  const [waitTimeAlertThresholds, setWaitTimeAlertThresholds] = useState(() => ({ ...dataService.getWaitTimeAlertThresholds() }));
  const [openingHours, setOpeningHours] = useState(() => JSON.parse(JSON.stringify(dataService.getOpeningHours())));
  const [tables, setTables] = useState<Table[]>([]);
  const [landmarks, setLandmarks] = useState<LandmarkPosition[]>(() => dataService.getLandmarks().map(l => ({ ...l })));
  const [customerBgUrl, setCustomerBgUrl] = useState(() => dataService.getCustomerBgUrl());
  const [staffList, setStaffList] = useState<string[]>(() => dataService.getStaffList());
  const [newStaffName, setNewStaffName] = useState('');

  const [isInitialized, setIsInitialized] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showConfirmConvert, setShowConfirmConvert] = useState(false);

  // Floating Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToastMsg = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    const loadFromService = () => {
      setWhatsappNumber(dataService.getWhatsAppNumber());
      setLunchBuffer(dataService.getLunchBuffer().toString());
      setDinnerBuffer(dataService.getDinnerBuffer().toString());
      setSlotInterval(dataService.getSlotInterval().toString());
      setKalyanaEnabled(dataService.isKalyanaEnabled());
      setKalyanaCutoffMinutes(dataService.getKalyanaCutoffMinutes().toString());
      setKalyanaTurnMinutes(dataService.getKalyanaTurnMinutes().toString());
      setKalyanaSlots(dataService.getKalyanaSlots().map(s => ({ ...s })));
      setCustomerTexts({ ...dataService.getCustomerTexts() });
      setWaitTimeAlertThresholds({ ...dataService.getWaitTimeAlertThresholds() });
      setOpeningHours(JSON.parse(JSON.stringify(dataService.getOpeningHours())));
      setTables(dataService.getTables().map(t => ({ ...t })));
      setLandmarks(dataService.getLandmarks().map(l => ({ ...l })));
      setCustomerBgUrl(dataService.getCustomerBgUrl());
      setStaffList(dataService.getStaffList());
      setIsInitialized(true);
    };

    loadFromService();

    // Subscribe to Firestore changes to update local states dynamically if not edited
    const unsubscribe = dataService.subscribe(() => {
      if (!isInitialized) {
        loadFromService();
      }
    });
    return () => unsubscribe();
  }, [isInitialized]);

  const getDayName = (dayIndex: number): string => {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
  };

  const isValidTimeStr = (str: string) => {
    if (!/^\d{1,2}:\d{2}$/.test(str)) return false;
    const [h, m] = str.split(':').map(Number);
    return h >= 0 && h < 24 && m >= 0 && m < 60;
  };

  const compareTimes = (time1: string, time2: string) => {
    const [h1, m1] = time1.split(':').map(Number);
    const [h2, m2] = time2.split(':').map(Number);
    return (h1 * 60 + m1) - (h2 * 60 + m2);
  };

  // Pads numbers to 'HH:MM'
  const formatTimeStr = (str: string): string => {
    if (!str) return '00:00';
    const [h, m] = str.split(':').map(Number);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const validateAll = async (): Promise<string | null> => {
    // 1. PINs (4-6 digits, numeric, if provided). Changing a PIN requires the
    // real current PIN (verified against its stored hash) plus a matching
    // retype of the new PIN — leaving all three blank keeps it unchanged.
    if (staffPin) {
      if (staffPin.length < 4 || staffPin.length > 6 || !/^\d+$/.test(staffPin)) {
        return 'Staff PIN must be between 4 and 6 numeric digits.';
      }
      if (!currentStaffPin) {
        return 'Enter the current Staff PIN to change it.';
      }
      if (staffPin !== retypeStaffPin) {
        return 'New Staff PIN and retyped PIN do not match.';
      }
      const currentStaffPinOk = await dataService.verifyStaffPin(currentStaffPin);
      if (!currentStaffPinOk) {
        return 'Current Staff PIN is incorrect.';
      }
    }
    if (ownerPin) {
      if (ownerPin.length < 4 || ownerPin.length > 6 || !/^\d+$/.test(ownerPin)) {
        return 'Manager/Founder PIN must be between 4 and 6 numeric digits.';
      }
      if (!currentOwnerPin) {
        return 'Enter the current Manager/Founder PIN to change it.';
      }
      if (ownerPin !== retypeOwnerPin) {
        return 'New Manager/Founder PIN and retyped PIN do not match.';
      }
      const currentOwnerPinOk = await dataService.verifyOwnerPin(currentOwnerPin);
      if (!currentOwnerPinOk) {
        return 'Current Manager/Founder PIN is incorrect.';
      }
    }

    // 2. Buffers & Interval
    const lBuf = parseInt(lunchBuffer, 10);
    const dBuf = parseInt(dinnerBuffer, 10);
    const sInt = parseInt(slotInterval, 10);
    if (isNaN(lBuf) || lBuf < 0) return 'Lunch Last Booking Buffer must be a positive number (or 0).';
    if (isNaN(dBuf) || dBuf < 0) return 'Dinner Last Booking Buffer must be a positive number (or 0).';
    if (isNaN(sInt) || sInt <= 0) return 'Slot Interval must be a positive number greater than 0.';

    // 3. Opening Hours Times
    for (let i = 0; i < 7; i++) {
      const config = openingHours[i.toString()] || openingHours[i];
      if (config && config.isOpen) {
        if (config.lunchOpen) {
          if (!isValidTimeStr(config.lunchStart)) {
            return `Lunch Start time for ${getDayName(i)} is invalid (must be HH:MM format).`;
          }
          if (!isValidTimeStr(config.lunchEnd)) {
            return `Lunch End time for ${getDayName(i)} is invalid (must be HH:MM format).`;
          }
          if (compareTimes(config.lunchStart, config.lunchEnd) >= 0) {
            return `Lunch Start time must be before Lunch End time for ${getDayName(i)}.`;
          }
        }
        if (config.dinnerOpen) {
          if (!isValidTimeStr(config.dinnerStart)) {
            return `Dinner Start time for ${getDayName(i)} is invalid (must be HH:MM format).`;
          }
          if (!isValidTimeStr(config.dinnerEnd)) {
            return `Dinner End time for ${getDayName(i)} is invalid (must be HH:MM format).`;
          }
          if (compareTimes(config.dinnerStart, config.dinnerEnd) >= 0) {
            return `Dinner Start time must be before Dinner End time for ${getDayName(i)}.`;
          }
        }
        if (!config.lunchOpen && !config.dinnerOpen) {
          return `${getDayName(i)} is set to Open, but both Lunch and Dinner services are inactive. Please toggle active services or mark the day closed.`;
        }
      }
    }

    // 4. Kalyana Slots
    if (kalyanaEnabled) {
      for (const slot of kalyanaSlots) {
        if (!slot.range.trim()) {
          return `Kalyana Slot range text cannot be empty.`;
        }
        const cap = parseInt(slot.capacity as any, 10);
        if (isNaN(cap) || cap <= 0) {
          return `Kalyana Slot "${slot.range}" capacity must be a positive integer.`;
        }
      }
    }

    // 5. Table Configuration
    for (const table of tables) {
      const cap = parseInt(table.capacity as any, 10);
      if (isNaN(cap) || cap <= 0) {
        return `Capacity for ${table.name} must be a positive integer.`;
      }
    }

    // 6. Alert thresholds
    const lowThr = parseInt(waitTimeAlertThresholds.low as any, 10);
    const medThr = parseInt(waitTimeAlertThresholds.medium as any, 10);
    const highThr = parseInt(waitTimeAlertThresholds.high as any, 10);
    if (isNaN(lowThr) || lowThr <= 0) return 'Low Wait-Time Threshold must be a positive integer.';
    if (isNaN(medThr) || medThr <= 0) return 'Medium Wait-Time Threshold must be a positive integer.';
    if (isNaN(highThr) || highThr <= 0) return 'High Wait-Time Threshold must be a positive integer.';
    if (lowThr >= medThr) return 'Low Wait-Time Threshold must be less than Medium Threshold.';
    if (medThr >= highThr) return 'Medium Wait-Time Threshold must be less than High Threshold.';

    return null;
  };

  const handlePreSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    const err = await validateAll();
    if (err) {
      setValidationError(err);
      showToastMsg(err, 'error');
      // Scroll to error if possible
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleSaveAll = async () => {
    try {
      setIsConfirmOpen(false);

      // Clean times in openingHours
      const formattedOpeningHours = { ...openingHours };
      for (let i = 0; i < 7; i++) {
        const key = i.toString();
        if (formattedOpeningHours[key]) {
          formattedOpeningHours[key].lunchStart = formatTimeStr(formattedOpeningHours[key].lunchStart);
          formattedOpeningHours[key].lunchEnd = formatTimeStr(formattedOpeningHours[key].lunchEnd);
          formattedOpeningHours[key].dinnerStart = formatTimeStr(formattedOpeningHours[key].dinnerStart);
          formattedOpeningHours[key].dinnerEnd = formatTimeStr(formattedOpeningHours[key].dinnerEnd);
        }
      }

      // 1. Save all settings to Firestore settings document (excluding plaintext PINs)
      const payload = {
        whatsappNumber,
        lunchBuffer: parseInt(lunchBuffer, 10) || 0,
        dinnerBuffer: parseInt(dinnerBuffer, 10) || 0,
        slotInterval: parseInt(slotInterval, 10) || 15,
        kalyanaEnabled,
        kalyanaCutoffMinutes: parseInt(kalyanaCutoffMinutes, 10) || 30,
        kalyanaTurnMinutes: Math.min(60, Math.max(15, parseInt(kalyanaTurnMinutes, 10) || 45)),
        kalyanaSlots: kalyanaSlots.map(s => ({ ...s, capacity: parseInt(s.capacity as any, 10) })),
        customerTexts,
        waitTimeAlertThresholds: {
          low: parseInt(waitTimeAlertThresholds.low as any, 10),
          medium: parseInt(waitTimeAlertThresholds.medium as any, 10),
          high: parseInt(waitTimeAlertThresholds.high as any, 10)
        },
        openingHours: formattedOpeningHours,
        customerBgUrl,
        landmarks,
      };

      await dataService.saveAllSettings(payload);
      await dataService.setCustomerBgUrl(customerBgUrl);
      await dataService.setLandmarks(landmarks);
      await dataService.setStaffList(staffList);

      // If a new Staff PIN was typed (and verified in validateAll), save its
      // hash and clear all three fields.
      if (staffPin) {
        await dataService.setStaffPin(staffPin);
        setStaffPin('');
        setCurrentStaffPin('');
        setRetypeStaffPin('');
        setShowNewStaffPin(false);
      }

      // If a new Manager PIN was typed (and verified in validateAll), save
      // its hash and clear all three fields.
      if (ownerPin) {
        await dataService.setOwnerPin(ownerPin);
        setOwnerPin('');
        setCurrentOwnerPin('');
        setRetypeOwnerPin('');
        setShowNewOwnerPin(false);
      }

      // 2. Save table configurations to Firestore
      const cleanedTables = tables.map((t) => ({
        ...t,
        capacity: parseInt(t.capacity as any, 10),
        maxOverrideCapacity: parseInt(t.maxOverrideCapacity as any, 10),
      }));
      await dataService.saveTables(cleanedTables);

      showToastMsg('All restaurant configurations saved and propagated live successfully!');
    } catch (err: any) {
      showToastMsg(err?.message || 'Failed to save configurations.', 'error');
    }
  };

  const handleDayToggle = (dayIdx: number) => {
    const key = dayIdx.toString();
    const current = { ...openingHours[key] };
    current.isOpen = !current.isOpen;
    setOpeningHours({
      ...openingHours,
      [key]: current
    });
  };

  const handleServiceToggle = (dayIdx: number, service: 'lunch' | 'dinner') => {
    const key = dayIdx.toString();
    const current = { ...openingHours[key] };
    if (service === 'lunch') {
      current.lunchOpen = !current.lunchOpen;
    } else {
      current.dinnerOpen = !current.dinnerOpen;
    }
    setOpeningHours({
      ...openingHours,
      [key]: current
    });
  };

  const handleTimeChange = (dayIdx: number, field: string, value: string) => {
    const key = dayIdx.toString();
    const current = { ...openingHours[key] };
    current[field] = value;
    setOpeningHours({
      ...openingHours,
      [key]: current
    });
  };

  const handleResetToDefaults = () => {
    if (window.confirm('Are you sure you want to reset ALL configurations to original system defaults? This will overwrite pins, hours, texts, and thresholds.')) {
      setStaffPin('1357');
      setCurrentStaffPin('');
      setRetypeStaffPin('1357');
      setShowNewStaffPin(false);
      setOwnerPin('2468');
      setCurrentOwnerPin('');
      setRetypeOwnerPin('2468');
      setShowNewOwnerPin(false);
      setWhatsappNumber('0412345678');
      setLunchBuffer('30');
      setDinnerBuffer('30');
      setSlotInterval('15');
      setKalyanaEnabled(true);
      setKalyanaSlots([
        { id: '1', range: 'Slot 1: 11:00am-12:30pm', capacity: 40 },
        { id: '2', range: 'Slot 2: 12:30pm-2:00pm', capacity: 40 },
        { id: '3', range: 'Slot 3: 2:00pm-3:30pm', capacity: 40 }
      ]);
      setCustomerTexts({
        welcomeLine: 'Select an option below to join the live queue or reserve for later.',
        waitingReassurance: 'Please wait — our team will allocate your table shortly.',
        tableReadyTemplate: 'Your table {table} is ready! Welcome, {name}. Please make your way to the host.',
        thankYouMessage: 'Thank you for dining with us! We hope you enjoyed your Ney Dosa Feast.',
        noOrderingUrlNote: "Please ask our staff for the menu — we'll take your order at the table."
      });
      setWaitTimeAlertThresholds({ low: 10, medium: 15, high: 20 });
      setOpeningHours({
        '0': { isOpen: true, lunchOpen: true, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' },
        '1': { isOpen: true, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' },
        '2': { isOpen: false, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: false, dinnerStart: '17:30', dinnerEnd: '22:00' },
        '3': { isOpen: true, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' },
        '4': { isOpen: true, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' },
        '5': { isOpen: true, lunchOpen: false, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' },
        '6': { isOpen: true, lunchOpen: true, lunchStart: '11:00', lunchEnd: '15:00', dinnerOpen: true, dinnerStart: '17:30', dinnerEnd: '22:00' },
      });
      showToastMsg('Reset to defaults in form state. Please click Save Configuration to apply.', 'success');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl relative pb-20">
      {/* Toast Alert */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 border transition-all duration-300 animate-slide-in ${
          toast.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200' 
            : 'bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-[#FFFDF7] dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E37A08]/10 flex items-center justify-center shrink-0">
              <SettingsIcon className="w-5 h-5 text-[#E37A08]" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-[#2D2926] dark:text-white">
                Live Restaurant Configurations
              </h2>
              <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                All edits made below propagate instantly to the customer-facing booking engine and host consoles without redeployment.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="px-3.5 py-2 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-xs font-semibold text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E] flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#E37A08]" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>

        {validationError && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div className="font-semibold">{validationError}</div>
          </div>
        )}
      </div>

      {/* Configuration Grid Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Rail */}
        <div className="lg:col-span-1 space-y-1.5">
          <button
            onClick={() => setActiveSubTab('hours')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'hours'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/10'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Hours & Buffers</span>
          </button>

          <button
            onClick={() => setActiveSubTab('kalyana')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'kalyana'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/10'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Kalyana Feast</span>
          </button>

          <button
            onClick={() => setActiveSubTab('tables')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'tables'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/10'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Table Floorplan</span>
          </button>

          <button
            onClick={() => setActiveSubTab('texts')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'texts'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/10'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Customer Texts</span>
          </button>

          <button
            onClick={() => setActiveSubTab('appearance')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'appearance'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/10'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Appearance</span>
          </button>

          <button
            onClick={() => setActiveSubTab('security')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'security'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/10'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security & Alerts</span>
          </button>

          <button
            onClick={() => setActiveSubTab('device')}
            className={`w-full text-left px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all ${
              activeSubTab === 'device'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/10'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Device Setup</span>
          </button>
        </div>

        {/* Content Box */}
        <div className="lg:col-span-3">
          <form onSubmit={handlePreSave} className="space-y-6">
            
            {/* ⏰ HOURS & BUFFERS SUB-TAB */}
            {activeSubTab === 'hours' && (
              <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#E37A08]" />
                    Weekly Hours & Booking Service Windows
                  </h3>
                  <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
                    Configure active days and specify opening and closing boundaries for lunch and dinner operations.
                  </p>
                </div>

                {/* Day configurations list */}
                <div className="space-y-4">
                  {Array.from({ length: 7 }).map((_, i) => {
                    const key = i.toString();
                    const config = openingHours[key] || {
                      isOpen: false,
                      lunchOpen: false,
                      lunchStart: '11:00',
                      lunchEnd: '15:00',
                      dinnerOpen: false,
                      dinnerStart: '17:30',
                      dinnerEnd: '22:00'
                    };

                    return (
                      <div key={i} className="p-4 rounded-2xl border border-[#E8E2D2]/60 dark:border-[#3D352E]/60 bg-[#FDFBF7] dark:bg-[#1C1917]/50 space-y-3 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-serif font-bold text-sm text-[#2D2926] dark:text-white w-24">
                              {getDayName(i)}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              config.isOpen 
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400'
                            }`}>
                              {config.isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>
                          
                          {/* isOpen Toggle Switch */}
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="sr-only peer" 
                              checked={config.isOpen}
                              onChange={() => handleDayToggle(i)}
                            />
                            <div className="w-9 h-5 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                          </label>
                        </div>

                        {/* Service hours inputs if day is Open */}
                        {config.isOpen && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#E8E2D2]/40 dark:border-[#3D352E]/40 text-xs">
                            {/* Lunch service box */}
                            <div className="space-y-2 p-3 rounded-xl bg-white dark:bg-[#26221E] border border-[#E8E2D2]/50 dark:border-[#3D352E]/50">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#8B4513] dark:text-[#D2B48C]">Lunch Service</span>
                                <label className="relative inline-flex items-center cursor-pointer scale-90">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={config.lunchOpen}
                                    onChange={() => handleServiceToggle(i, 'lunch')}
                                  />
                                  <div className="w-8 h-4.5 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500" />
                                </label>
                              </div>
                              {config.lunchOpen ? (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <div>
                                    <label className="block text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-0.5 font-bold">Start Time</label>
                                    <input 
                                      type="text" 
                                      value={config.lunchStart}
                                      onChange={(e) => handleTimeChange(i, 'lunchStart', e.target.value)}
                                      placeholder="11:00"
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-xs font-mono text-[#2D2926] dark:text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-0.5 font-bold">End Time</label>
                                    <input 
                                      type="text" 
                                      value={config.lunchEnd}
                                      onChange={(e) => handleTimeChange(i, 'lunchEnd', e.target.value)}
                                      placeholder="15:00"
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-xs font-mono text-[#2D2926] dark:text-white"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-[#6B5E4C]/60 dark:text-[#B8ACA0]/60 italic py-1">Lunch service inactive</div>
                              )}
                            </div>

                            {/* Dinner service box */}
                            <div className="space-y-2 p-3 rounded-xl bg-white dark:bg-[#26221E] border border-[#E8E2D2]/50 dark:border-[#3D352E]/50">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#8B4513] dark:text-[#D2B48C]">Dinner Service</span>
                                <label className="relative inline-flex items-center cursor-pointer scale-90">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={config.dinnerOpen}
                                    onChange={() => handleServiceToggle(i, 'dinner')}
                                  />
                                  <div className="w-8 h-4.5 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-amber-500" />
                                </label>
                              </div>
                              {config.dinnerOpen ? (
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  <div>
                                    <label className="block text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-0.5 font-bold">Start Time</label>
                                    <input 
                                      type="text" 
                                      value={config.dinnerStart}
                                      onChange={(e) => handleTimeChange(i, 'dinnerStart', e.target.value)}
                                      placeholder="17:30"
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-xs font-mono text-[#2D2926] dark:text-white"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-0.5 font-bold">End Time</label>
                                    <input 
                                      type="text" 
                                      value={config.dinnerEnd}
                                      onChange={(e) => handleTimeChange(i, 'dinnerEnd', e.target.value)}
                                      placeholder="22:00"
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-xs font-mono text-[#2D2926] dark:text-white"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-[#6B5E4C]/60 dark:text-[#B8ACA0]/60 italic py-1">Dinner service inactive</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Buffers and Interval Controls */}
                <div className="pt-4 border-t border-[#E8E2D2]/60 dark:border-[#3D352E]/60 space-y-4">
                  <h4 className="font-serif font-bold text-sm text-[#2D2926] dark:text-white">
                    Service Last-Booking Buffers & Interval Windows
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                        Lunch Booking Buffer (Mins)
                      </label>
                      <input 
                        type="number"
                        min={0}
                        value={lunchBuffer}
                        onChange={(e) => setLunchBuffer(e.target.value)}
                        placeholder="30"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      />
                      <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 mt-1 block leading-relaxed">
                        Subtracted from Lunch closing time to find the last bookable slot.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                        Dinner Booking Buffer (Mins)
                      </label>
                      <input 
                        type="number"
                        min={0}
                        value={dinnerBuffer}
                        onChange={(e) => setDinnerBuffer(e.target.value)}
                        placeholder="30"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      />
                      <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 mt-1 block leading-relaxed">
                        Subtracted from Dinner closing time to find the last bookable slot.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                        Booking Slot Interval (Mins)
                      </label>
                      <input 
                        type="number"
                        min={5}
                        max={120}
                        step={5}
                        value={slotInterval}
                        onChange={(e) => setSlotInterval(e.target.value)}
                        placeholder="15"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      />
                      <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 mt-1 block leading-relaxed">
                        Increment gaps between consecutive slots (Default is 15 mins).
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-Save Button */}
                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-2xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </button>
                </div>
              </div>
            )}

            {/* 🍽️ KALYANA FEAST CONFIG SUB-TAB */}
            {activeSubTab === 'kalyana' && (
              <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#E37A08]" />
                      Kalyana Virundhu Saturday Feast Config
                    </h3>
                    <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
                      Configure active seating intervals and maximum reservation capacities for our premium Saturday festival.
                    </p>
                  </div>

                  {/* Enable Saturday Feast Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0]">Active:</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={kalyanaEnabled}
                        onChange={() => setKalyanaEnabled(!kalyanaEnabled)}
                      />
                      <div className="w-9 h-5 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                    </label>
                  </div>
                </div>

                {kalyanaEnabled ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-[#8B4513] dark:text-[#D2B48C] leading-relaxed flex gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Kalyana Virundhu is currently enabled. On Saturdays, customers can choose between the regular menu (ordinary reservation) and the Kalyana feast menu. The feast menu is bound to the discrete slots configured below.
                      </span>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0]">
                        Feast Seating Slots (3 Slots)
                      </h4>
                      
                      {kalyanaSlots.map((slot, index) => (
                        <div key={slot.id || index} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-[#E8E2D2]/50 dark:border-[#3D352E]/50 bg-[#FDFBF7] dark:bg-[#1C1917]/30 items-center">
                          <span className="text-xs font-bold text-[#2D2926] dark:text-white">
                            Slot {index + 1} Settings
                          </span>
                          
                          <div>
                            <label className="block text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1 font-bold">
                              Slot Name / Range Text
                            </label>
                            <input 
                              type="text"
                              value={slot.range}
                              onChange={(e) => {
                                const updated = [...kalyanaSlots];
                                updated[index].range = e.target.value;
                                setKalyanaSlots(updated);
                              }}
                              placeholder={`Slot ${index + 1}: Range`}
                              className="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-semibold text-[#2D2926] dark:text-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1 font-bold">
                              Guest Seat Capacity
                            </label>
                            <input 
                              type="number"
                              min={1}
                              max={500}
                              value={slot.capacity}
                              onChange={(e) => {
                                const updated = [...kalyanaSlots];
                                updated[index].capacity = e.target.value as any;
                                setKalyanaSlots(updated);
                              }}
                              placeholder="40"
                              className="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-semibold text-[#2D2926] dark:text-white"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-[#E8E2D2]/50 dark:border-[#3D352E]/50 bg-[#FDFBF7] dark:bg-[#1C1917]/30">
                      <div>
                        <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                          Slot Booking Cutoff (Mins Before Slot End)
                        </label>
                        <input 
                          type="number"
                          min={0}
                          max={120}
                          value={kalyanaCutoffMinutes}
                          onChange={(e) => setKalyanaCutoffMinutes(e.target.value)}
                          placeholder="30"
                          className="w-full px-3 py-2 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-semibold text-[#2D2926] dark:text-white"
                        />
                        <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 mt-1 block">
                          Default: 30 mins (e.g. Slot 1 ends 12:30 PM → Cutoff is 12:00 PM). Shows "Booking closed" to customers.
                        </span>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                          Auto Table-Turn Duration (Mins, Hard Limit 60)
                        </label>
                        <input 
                          type="number"
                          min={15}
                          max={60}
                          value={kalyanaTurnMinutes}
                          onChange={(e) => setKalyanaTurnMinutes(e.target.value)}
                          placeholder="45"
                          className="w-full px-3 py-2 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-semibold text-[#2D2926] dark:text-white"
                        />
                        <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 mt-1 block">
                          Starts timer when seated; table auto-frees at 45m (hard max 60m) to return to available.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl border-2 border-dashed border-[#E8E2D2] dark:border-[#3D352E] text-center space-y-2">
                    <span className="block text-sm font-bold text-[#6B5E4C] dark:text-[#B8ACA0]">
                      Saturday Feast is currently disabled
                    </span>
                    <p className="text-xs text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80">
                      Toggle active switch above to turn on Saturday feast bookings.
                    </p>
                  </div>
                )}

                {/* Sub-Save Button */}
                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-2xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </button>
                </div>
              </div>
            )}

            {/* 📋 TABLE CONFIGURATION SUB-TAB */}
            {activeSubTab === 'tables' && (
              <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-[#E37A08]" />
                    Table Configurations & Square Ordering URLs
                  </h3>
                  <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
                    Configure individual table seated capacities, active state settings, +1 chair allowances, and unique QR ordering endpoint links.
                  </p>
                </div>

                {/* Tables Grid List */}
                <div className="space-y-4">
                  {tables.map((table, index) => {
                    const hasPlusOneOverride = table.id === 5 || table.id === 6 || table.id === 7;
                    const plusOneChecked = table.maxOverrideCapacity > table.capacity;

                    return (
                      <div key={table.id} className={`p-4 rounded-2xl border bg-[#FDFBF7] dark:bg-[#1C1917]/40 space-y-3 transition-all ${
                        table.isInactive 
                          ? 'border-[#E8E2D2]/30 dark:border-[#3D352E]/20 opacity-60' 
                          : 'border-[#E8E2D2]/60 dark:border-[#3D352E]/60'
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E8E2D2]/40 dark:border-[#3D352E]/40">
                          <div className="flex items-center gap-2.5">
                            <span className="font-serif font-black text-sm text-[#8B4513] dark:text-[#D2B48C]">
                              {table.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              table.isInactive 
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-400' 
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                            }`}>
                              {table.isInactive ? 'Inactive / Hidden' : 'Active'}
                            </span>
                          </div>

                          <div className="flex items-center gap-4 text-xs">
                            {/* Active/Inactive Switch */}
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-[#6B5E4C] dark:text-[#B8ACA0]">Active Table:</span>
                              <label className="relative inline-flex items-center cursor-pointer scale-90">
                                <input 
                                  type="checkbox" 
                                  className="sr-only peer" 
                                  checked={!table.isInactive}
                                  onChange={() => {
                                    const updated = [...tables];
                                    updated[index].isInactive = !updated[index].isInactive;
                                    setTables(updated);
                                  }}
                                />
                                <div className="w-8 h-4.5 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500" />
                              </label>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                          {/* Capacity input */}
                          <div>
                            <label className="block text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1 font-bold">
                              Seating Capacity
                            </label>
                            <input 
                              type="number"
                              min={1}
                              max={20}
                              value={table.capacity}
                              onChange={(e) => {
                                const updated = [...tables];
                                const cap = parseInt(e.target.value, 10) || 0;
                                updated[index].capacity = cap;
                                // Automatically adjust override if needed
                                if (updated[index].maxOverrideCapacity < cap) {
                                  updated[index].maxOverrideCapacity = cap;
                                }
                                setTables(updated);
                              }}
                              className="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-semibold text-[#2D2926] dark:text-white"
                            />
                          </div>

                          {/* +1 chair override (restricted to tables 5/6/7) */}
                          <div className="md:col-span-1 flex flex-col justify-end">
                            {hasPlusOneOverride ? (
                              <div className="flex items-center gap-2 py-1.5">
                                <input 
                                  type="checkbox"
                                  id={`override-${table.id}`}
                                  checked={plusOneChecked}
                                  onChange={(e) => {
                                    const updated = [...tables];
                                    if (e.target.checked) {
                                      updated[index].maxOverrideCapacity = updated[index].capacity + 1;
                                    } else {
                                      updated[index].maxOverrideCapacity = updated[index].capacity;
                                    }
                                    setTables(updated);
                                  }}
                                  className="w-4 h-4 text-[#E37A08] border-[#E8E2D2] rounded-sm focus:ring-[#E37A08] bg-white dark:bg-[#26221E]"
                                />
                                <label htmlFor={`override-${table.id}`} className="text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] cursor-pointer">
                                  +1 Chair Override Allowed
                                </label>
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#6B5E4C]/50 dark:text-[#B8ACA0]/50 italic py-1.5">
                                Override not applicable
                              </span>
                            )}
                          </div>

                          {/* QR Ordering URL Input */}
                          <div className="md:col-span-2">
                            <label className="block text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1 font-bold">
                              Square / Ordering Handoff URL
                            </label>
                            <input 
                              type="text"
                              value={table.orderingUrl || ''}
                              onChange={(e) => {
                                const updated = [...tables];
                                updated[index].orderingUrl = e.target.value;
                                setTables(updated);
                              }}
                              placeholder="https://example.com/order?table=X"
                              className="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-semibold text-[#2D2926] dark:text-white font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sub-Save Button */}
                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-2xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </button>
                </div>
              </div>
            )}

            {/* 💬 CUSTOMER TEXTS SUB-TAB */}
            {activeSubTab === 'texts' && (
              <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#E37A08]" />
                    Customer-Facing Welcome & Notification Messages
                  </h3>
                  <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
                    Customize descriptive banners and transactional text structures displayed to customers checking in.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Landing welcome message */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      Landing Page Welcome Line
                    </label>
                    <textarea 
                      rows={2}
                      value={customerTexts.welcomeLine}
                      onChange={(e) => setCustomerTexts({ ...customerTexts, welcomeLine: e.target.value })}
                      className="w-full p-3.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                    />
                    <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 block">
                      Displayed right under the "Welcome to Just Dosa" main title on the landing dashboard screen.
                    </span>
                  </div>

                  {/* Waiting reassurance message */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      "Waiting for Table Allocation" Reassurance Message
                    </label>
                    <textarea 
                      rows={2}
                      value={customerTexts.waitingReassurance}
                      onChange={(e) => setCustomerTexts({ ...customerTexts, waitingReassurance: e.target.value })}
                      className="w-full p-3.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                    />
                    <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 block">
                      Reassurance line rendered at the bottom of the customer's waitlist card (while waiting to be seated).
                    </span>
                  </div>

                  {/* Table ready welcome template */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      Table Ready Welcome Template (with {`{name}`} & {`{table}`} tags)
                    </label>
                    <textarea 
                      rows={3}
                      value={customerTexts.tableReadyTemplate}
                      onChange={(e) => setCustomerTexts({ ...customerTexts, tableReadyTemplate: e.target.value })}
                      className="w-full p-3.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                    />
                    <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-400 flex items-center gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>
                        Use <strong className="font-mono">{`{name}`}</strong> to inject customer's first name, and <strong className="font-mono">{`{table}`}</strong> to inject their allocated Table ID.
                      </span>
                    </div>
                  </div>

                  {/* Thank you message */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      Thank You / Dining Finished Note
                    </label>
                    <textarea 
                      rows={2}
                      value={customerTexts.thankYouMessage}
                      onChange={(e) => setCustomerTexts({ ...customerTexts, thankYouMessage: e.target.value })}
                      className="w-full p-3.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                    />
                    <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 block">
                      Shown to customers once they are checked out and marked finished.
                    </span>
                  </div>

                  {/* No-ordering-url table note */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      No-Ordering-URL Table Alert Note
                    </label>
                    <textarea 
                      rows={2}
                      value={customerTexts.noOrderingUrlNote}
                      onChange={(e) => setCustomerTexts({ ...customerTexts, noOrderingUrlNote: e.target.value })}
                      className="w-full p-3.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                    />
                    <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 block">
                      Shown when a customer lands on a seated table that does NOT have a custom menu/Square link configured.
                    </span>
                  </div>
                </div>

                {/* Sub-Save Button */}
                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-2xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </button>
                </div>
              </div>
            )}

            {/* 🎨 APPEARANCE SUB-TAB */}
            {activeSubTab === 'appearance' && (
              <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#E37A08]" />
                    Customer Landing Page Appearance
                  </h3>
                  <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
                    Set a custom background image URL for the customer registration & queue terminal screen.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      Background Image URL
                    </label>
                    <input 
                      type="text"
                      value={customerBgUrl}
                      onChange={(e) => setCustomerBgUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/... or paste image URL"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                    />
                    <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 block">
                      Paste a high-resolution image URL. The dark overlay will be preserved for readability. Leave blank to use default dark luxury look.
                    </span>
                  </div>

                  {/* Preset Samples */}
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      Sample High-Res Presets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomerBgUrl('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1920&q=80')}
                        className="px-3 py-1.5 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-medium text-[#2D2926] dark:text-white hover:border-[#E37A08] transition-colors cursor-pointer"
                      >
                        Warm Dining Ambience
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerBgUrl('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1920&q=80')}
                        className="px-3 py-1.5 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-medium text-[#2D2926] dark:text-white hover:border-[#E37A08] transition-colors cursor-pointer"
                      >
                        Rustic Feast Setup
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerBgUrl('https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=1920&q=80')}
                        className="px-3 py-1.5 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-medium text-[#2D2926] dark:text-white hover:border-[#E37A08] transition-colors cursor-pointer"
                      >
                        South Indian Feast
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerBgUrl('')}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        Clear (Use Default)
                      </button>
                    </div>
                  </div>

                  {/* Live Preview Box */}
                  <div className="space-y-2">
                    <span className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      Live Customer View Preview
                    </span>
                    <div 
                      className="relative h-48 rounded-2xl overflow-hidden border border-[#E8E2D2] dark:border-[#3D352E] bg-[#1a0c00] flex items-center justify-center p-6 text-center bg-cover bg-center"
                      style={{ backgroundImage: customerBgUrl ? `url(${customerBgUrl})` : 'none' }}
                    >
                      {/* Dark Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/75 to-black/80" />
                      
                      <div className="relative z-10 space-y-2 text-white">
                        <h4 className="font-serif font-bold text-lg text-amber-100">JUST DOSA</h4>
                        <p className="text-xs text-amber-200/80 max-w-sm mx-auto">
                          {customerTexts.welcomeLine || 'Select an option below to join the live queue or reserve for later.'}
                        </p>
                        <div className="pt-2">
                          <span className="inline-block px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-extrabold text-xs shadow-md">
                            Walk-In Queue
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-3">
                    <button
                      type="submit"
                      className="px-5 py-3 rounded-2xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Configuration</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 🔐 SECURITY, PINS & ALERT THRESHOLDS SUB-TAB */}
            {activeSubTab === 'security' && (
              <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#E37A08]" />
                    Security PINs, WhatsApp, & Waitlist Thresholds
                  </h3>
                  <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
                    Configure staff/admin level PIN passwords, notifications cell contact, and queue alarm intervals.
                  </p>
                </div>

                {/* PIN Settings Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-2xl border border-[#E8E2D2]/60 dark:border-[#3D352E]/60 bg-[#FDFBF7] dark:bg-[#1C1917]/30">
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      Staff Service PIN (4-6 digits)
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="password"
                        maxLength={6}
                        value={currentStaffPin}
                        onChange={(e) => setCurrentStaffPin(e.target.value)}
                        placeholder="Current Staff PIN"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      />
                      <div className="relative">
                        <input
                          type={showNewStaffPin ? 'text' : 'password'}
                          maxLength={6}
                          value={staffPin}
                          onChange={(e) => setStaffPin(e.target.value)}
                          placeholder="New Staff PIN (leave blank to keep current)"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewStaffPin(!showNewStaffPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B5E4C] dark:text-[#B8ACA0] hover:text-[#E37A08]"
                          title={showNewStaffPin ? 'Hide PIN' : 'Show PIN'}
                        >
                          {showNewStaffPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <input
                        type="password"
                        maxLength={6}
                        value={retypeStaffPin}
                        onChange={(e) => setRetypeStaffPin(e.target.value)}
                        placeholder="Retype New Staff PIN"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      />
                    </div>
                    <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 block">
                      Grants daily floorsheet access, seating control, and waiting queue additions.
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                      Manager / Founder PIN (4-6 digits)
                    </label>
                    <div className="space-y-1.5">
                      <input
                        type="password"
                        maxLength={6}
                        value={currentOwnerPin}
                        onChange={(e) => setCurrentOwnerPin(e.target.value)}
                        placeholder="Current Manager/Founder PIN"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      />
                      <div className="relative">
                        <input
                          type={showNewOwnerPin ? 'text' : 'password'}
                          maxLength={6}
                          value={ownerPin}
                          onChange={(e) => setOwnerPin(e.target.value)}
                          placeholder="New Manager/Founder PIN (leave blank to keep current)"
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewOwnerPin(!showNewOwnerPin)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B5E4C] dark:text-[#B8ACA0] hover:text-[#E37A08]"
                          title={showNewOwnerPin ? 'Hide PIN' : 'Show PIN'}
                        >
                          {showNewOwnerPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <input
                        type="password"
                        maxLength={6}
                        value={retypeOwnerPin}
                        onChange={(e) => setRetypeOwnerPin(e.target.value)}
                        placeholder="Retype New Manager/Founder PIN"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      />
                    </div>
                    <span className="text-[10px] text-[#6B5E4C]/80 dark:text-[#B8ACA0]/80 block">
                      Grants absolute administrative override capability (Customer Data, analytical logs, settings).
                    </span>
                  </div>
                </div>

                {/* WhatsApp configuration */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0]">
                    Contact & Communication
                  </h4>
                  <div className="p-4 rounded-2xl border border-[#E8E2D2]/60 dark:border-[#3D352E]/60 bg-[#FDFBF7] dark:bg-[#1C1917]/30 flex flex-col md:flex-row md:items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="grow space-y-1">
                      <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase">
                        Restaurant WhatsApp Number
                      </label>
                      <input 
                        type="text"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="e.g. 0412345678"
                        className="w-full md:w-80 px-3.5 py-2 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      />
                    </div>
                  </div>
                </div>

                {/* Queue thresholds */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0]">
                    Wait-Time Alert Alarm Thresholds (Minutes)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-2xl border border-[#E8E2D2]/60 dark:border-[#3D352E]/60 bg-[#FDFBF7] dark:bg-[#1C1917]/30">
                    <div>
                      <label className="block text-[10px] text-amber-600 dark:text-amber-400 uppercase font-extrabold mb-1">
                        Low Tier (Warning)
                      </label>
                      <input 
                        type="number"
                        min={1}
                        value={waitTimeAlertThresholds.low}
                        onChange={(e) => setWaitTimeAlertThresholds({ ...waitTimeAlertThresholds, low: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-bold text-[#2D2926] dark:text-white"
                      />
                      <span className="text-[9px] text-[#6B5E4C]/70 dark:text-[#B8ACA0]/70 block mt-1">Default: 10 mins</span>
                    </div>

                    <div>
                      <label className="block text-[10px] text-orange-600 dark:text-orange-400 uppercase font-extrabold mb-1">
                        Medium Tier (Critical Alert)
                      </label>
                      <input 
                        type="number"
                        min={1}
                        value={waitTimeAlertThresholds.medium}
                        onChange={(e) => setWaitTimeAlertThresholds({ ...waitTimeAlertThresholds, medium: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-bold text-[#2D2926] dark:text-white"
                      />
                      <span className="text-[9px] text-[#6B5E4C]/70 dark:text-[#B8ACA0]/70 block mt-1">Default: 15 mins</span>
                    </div>

                    <div>
                      <label className="block text-[10px] text-rose-600 dark:text-rose-400 uppercase font-extrabold mb-1">
                        High Tier (SLA Breach Alert)
                      </label>
                      <input 
                        type="number"
                        min={1}
                        value={waitTimeAlertThresholds.high}
                        onChange={(e) => setWaitTimeAlertThresholds({ ...waitTimeAlertThresholds, high: parseInt(e.target.value, 10) || 0 })}
                        className="w-full px-3 py-2 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-bold text-[#2D2926] dark:text-white"
                      />
                      <span className="text-[9px] text-[#6B5E4C]/70 dark:text-[#B8ACA0]/70 block mt-1">Default: 20 mins</span>
                    </div>
                  </div>
                </div>

                {/* 🧑‍🍳 Wait Staff Members (Floor Servers) */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0]">
                    Wait Staff / Servers List
                  </h4>
                  <p className="text-[11px] text-[#6B5E4C] dark:text-[#B8ACA0] leading-relaxed">
                    Add or remove active wait staff members. These servers can be assigned to individual tables on the floor plan to coordinate dining service and track table assignments live!
                  </p>
                  
                  <div className="p-4 rounded-2xl border border-[#E8E2D2]/60 dark:border-[#3D352E]/60 bg-[#FDFBF7] dark:bg-[#1C1917]/30 space-y-4">
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="e.g. Sanjay"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="px-3.5 py-2 text-sm rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-[#2D2926] dark:text-white grow focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newStaffName.trim()) {
                              const name = newStaffName.trim();
                              if (!staffList.includes(name)) {
                                setStaffList([...staffList, name]);
                              }
                              setNewStaffName('');
                            }
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newStaffName.trim()) {
                            const name = newStaffName.trim();
                            if (!staffList.includes(name)) {
                              setStaffList([...staffList, name]);
                            }
                            setNewStaffName('');
                          }
                        }}
                        className="py-2.5 px-4 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        Add Server
                      </button>
                    </div>

                    {staffList.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">No wait staff members configured yet. Add some servers above!</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {staffList.map((staff) => (
                          <div 
                            key={staff} 
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-800 dark:text-amber-400"
                          >
                            <span>{staff}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setStaffList(staffList.filter(s => s !== staff));
                              }}
                              className="text-amber-800 dark:text-amber-400 hover:text-rose-500 transition-colors cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Save Button */}
                <div className="flex justify-end pt-3">
                  <button
                    type="submit"
                    className="px-5 py-3 rounded-2xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Configuration</span>
                  </button>
                </div>
              </div>
            )}

            {/* 📱 DEVICE MODE UTILITY SUB-TAB */}
            {activeSubTab === 'device' && (
              <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E37A08]/10 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-[#E37A08]" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white">
                      Device Mode Configuration
                    </h3>
                    <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                      Convert this physical terminal between Admin/Staff Mode and Customer Mode.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] leading-relaxed">
                  Currently, this device is locked to <strong className="text-[#2D2926] dark:text-white">Admin & Staff Mode</strong>. It will bypass the Customer Welcome screen and only display the lock screen or admin dashboards. Reverting it to customer mode will restore the customer reservation and queue interface.
                </p>

                {!showConfirmConvert ? (
                  <button
                    type="button"
                    onClick={() => setShowConfirmConvert(true)}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer"
                  >
                    Convert this device to customer mode
                  </button>
                ) : (
                  <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-4">
                    <div className="flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-400">
                      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-1">Confirm Device Mode Conversion</span>
                        Are you absolutely sure you want to convert this terminal to customer mode? This action will remove the administrator designation from this device, clear active credentials, and redirect immediately to the customer registration page.
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('just_dosa_admin_device_v2');
                          localStorage.removeItem('just_dosa_admin_device');
                          sessionStorage.removeItem('just_dosa_admin_auth');
                          sessionStorage.removeItem('just_dosa_admin_role');
                          sessionStorage.removeItem('just_dosa_admin_auth_time');
                          window.location.href = window.location.origin + '/';
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        Yes, Convert to Customer Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowConfirmConvert(false)}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-[#1C1917] hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-[#2D2926] dark:text-white border border-[#E8E2D2] dark:border-[#3D352E] font-bold text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </form>
        </div>
      </div>

      {/* Confirmation Save Modal */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#26221E] max-w-md w-full rounded-3xl p-6 border border-[#E8E2D2] dark:border-[#3D352E] shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="font-serif font-bold text-lg text-[#2D2926] dark:text-white">
                Confirm Configuration Changes?
              </h3>
            </div>
            
            <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] leading-relaxed">
              You are about to save all updated restaurant settings (opening times, table overrides, alert thresholds, kalyana details, customer-facing texts, and system PIN codes) to Firestore. These changes will apply live and dynamically update all customers' checkout, waitlist, and reservation terminals immediately.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 rounded-xl bg-white dark:bg-[#1C1917] hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-[#2D2926] dark:text-white border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAll}
                className="px-4.5 py-2 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Yes, Apply Live</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
