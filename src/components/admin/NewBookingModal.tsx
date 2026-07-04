import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Users, Baby, Phone, CheckCircle, XCircle, Sparkles, AlertTriangle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Booking, Customer } from '../../types';
import { dataService } from '../../services/dataService';
import { getRequiredTableSeats } from '../../utils/bookingUtils';
import { formatAusMobile, cleanPhoneNumber, isValidAusMobile } from '../../utils/phone';

interface NewBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  customers: Record<string, Customer>;
  bookings: Booking[];
}

export const NewBookingModal: React.FC<NewBookingModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  customers,
  bookings,
}) => {
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [adultsCount, setAdultsCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [childrenHighChairs, setChildrenHighChairs] = useState<boolean[]>([]);
  const [bookingDate, setBookingDate] = useState(getTodayStr());
  const [bookingTime, setBookingTime] = useState('18:30');
  const [isWaitlist, setIsWaitlist] = useState(false);
  const [saturdayMenuType, setSaturdayMenuType] = useState<'regular' | 'kalyana' | 'null'>('null');
  const [kalyanaSlot, setKalyanaSlot] = useState('Slot 1: 11:00am-12:30pm');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search existing customer based on entered phone
  const cleanedPhone = cleanPhoneNumber(phone);
  const matchedCustomer = cleanedPhone ? customers[cleanedPhone] || null : null;

  // Reset fields on open
  useEffect(() => {
    if (isOpen) {
      setFirstName('');
      setLastName('');
      setPhone('');
      setAdultsCount(2);
      setChildrenCount(0);
      setChildrenHighChairs([]);
      setBookingDate(getTodayStr());
      setBookingTime('18:30');
      setIsWaitlist(false);
      setSaturdayMenuType('null');
      setKalyanaSlot('Slot 1: 11:00am-12:30pm');
      setWhatsappOptIn(true);
      setErrorMsg('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Sync high chair array length with childrenCount
  const handleChildrenCountChange = (val: number) => {
    setChildrenCount(val);
    if (val > childrenHighChairs.length) {
      setChildrenHighChairs([...childrenHighChairs, ...Array(val - childrenHighChairs.length).fill(false)]);
    } else {
      setChildrenHighChairs(childrenHighChairs.slice(0, val));
    }
  };

  const getDayOfWeek = (dateStr: string) => {
    if (!dateStr) return -1;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return -1;
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return date.getDay();
  };

  const getSlotGuestsCount = (slotName: string) => {
    return bookings
      .filter((b) => b.bookingDate === bookingDate && b.isKalyanaVirundhu && b.kalyanaSlot === slotName && ['pending', 'confirmed', 'booked'].includes(b.status))
      .reduce((sum, b) => sum + (b.partySize || 0), 0);
  };

  const getAvailableTimeSlots = (dateStr: string) => {
    const day = getDayOfWeek(dateStr);
    if (day === 2) return []; // Closed Tuesdays
    
    const slots: { value: string; label: string }[] = [];
    
    // Saturday or Sunday lunch
    if (day === 6 || day === 0) {
      const lunchStart = dataService.getLunchStartTime();
      const lunchEnd = dataService.getLunchEndTime();
      const [lStartHour, lStartMin] = lunchStart.split(':').map(Number);
      const [lEndHour, lEndMin] = lunchEnd.split(':').map(Number);

      let hour = lStartHour;
      let min = lStartMin;
      while (hour < lEndHour || (hour === lEndHour && min <= lEndMin)) {
        const val = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        slots.push({ value: val, label: `${displayHour}:${min.toString().padStart(2, '0')} ${ampm} (Lunch)` });
        min += 15;
        if (min === 60) {
          min = 0;
          hour += 1;
        }
      }
    }
    
    // Wednesday to Monday dinner
    const dinnerStart = dataService.getDinnerStartTime();
    const dinnerEnd = dataService.getDinnerEndTime();
    const [dStartHour, dStartMin] = dinnerStart.split(':').map(Number);
    const [dEndHour, dEndMin] = dinnerEnd.split(':').map(Number);

    let hour = dStartHour;
    let min = dStartMin;
    while (hour < dEndHour || (hour === dEndHour && min <= dEndMin)) {
      const val = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      slots.push({ value: val, label: `${displayHour}:${min.toString().padStart(2, '0')} ${ampm} (Dinner)` });
      min += 15;
      if (min === 60) {
        min = 0;
        hour += 1;
      }
    }
    
    return slots;
  };

  // Autocompletes customer fields when a match is found
  useEffect(() => {
    if (matchedCustomer) {
      if (!firstName) setFirstName(matchedCustomer.firstName || '');
      if (!lastName) setLastName(matchedCustomer.lastName || '');
      setWhatsappOptIn(matchedCustomer.whatsappOptIn !== false);
    }
  }, [matchedCustomer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setErrorMsg('First Name is required.');
      return;
    }

    if (phone && !isValidAusMobile(phone)) {
      setErrorMsg('Please enter a valid Australian mobile number (e.g., 0412 345 678) or leave blank.');
      return;
    }

    const day = getDayOfWeek(bookingDate);
    if (!isWaitlist && day === 2) {
      setErrorMsg("We are closed on Tuesdays. Please choose another date.");
      return;
    }

    const totalGuests = adultsCount + childrenCount;
    const isKalyana = !isWaitlist && day === 6 && saturdayMenuType === 'kalyana';

    if (isKalyana) {
      const guestsInSlot = getSlotGuestsCount(kalyanaSlot);
      const capacity = dataService.getKalyanaCapacity();
      if (guestsInSlot + totalGuests > capacity) {
        setErrorMsg(`Selected Kalyana Virundhu slot is fully booked. Only ${capacity - guestsInSlot} seats left.`);
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      await dataService.createManualBooking({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        partySize: totalGuests,
        childSeats: childrenHighChairs.filter(Boolean).length,
        adultsCount,
        childrenCount,
        childrenHighChairs,
        whatsappOptIn,
        type: isWaitlist ? 'walk-in' : 'remote',
        bookingDate: isWaitlist ? undefined : bookingDate,
        bookingTime: isWaitlist ? undefined : (isKalyana ? kalyanaSlot : bookingTime),
        isKalyanaVirundhu: isKalyana,
        kalyanaSlot: isKalyana ? kalyanaSlot : undefined,
        status: isWaitlist ? 'waiting' : 'confirmed',
        source: 'phone/staff',
      });

      onRefresh();
      onClose();
    } catch (err) {
      setErrorMsg('Failed to save manual booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCustomerBadgeText = (cust: Customer) => {
    const count = cust.totalVisits || 0;
    const suffix =
      count % 10 === 1 && count % 100 !== 11
        ? 'st'
        : count % 10 === 2 && count % 100 !== 12
        ? 'nd'
        : count % 10 === 3 && count % 100 !== 13
        ? 'rd'
        : 'th';
    const isRegular = count >= 5;
    return (
      <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-[#8B4513] dark:text-[#D2B48C]">
        <Sparkles className="w-3.5 h-3.5 text-[#E37A08]" />
        <span>Linked Customer ({count}{suffix} visit{isRegular ? ' • REGULAR' : ''})</span>
      </div>
    );
  };

  if (!isOpen) return null;

  const currentSlots = getAvailableTimeSlots(bookingDate);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="relative bg-[#FFFDF9] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden text-left"
        >
          {/* Header */}
          <div className="px-6 py-4 bg-[#F5F2EA] dark:bg-[#26221E] border-b border-[#E8E2D2] dark:border-[#3D352E] flex justify-between items-center">
            <div>
              <h2 className="text-lg font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#E37A08]" />
                <span>New Staff Booking Entry</span>
              </h2>
              <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                Verbal phone confirmation skips review and confirms booking instantly.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-[#6B5E4C] dark:text-[#B8ACA0] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Same Day Waitlist Toggle */}
            <div className="bg-amber-500/5 dark:bg-amber-500/0 border border-[#E8E2D2] dark:border-[#3D352E] rounded-2xl p-4 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-xs font-bold text-[#8B4513] dark:text-[#D2B48C] uppercase tracking-wider block">
                  Add to Waiting List instead
                </span>
                <span className="text-[11px] text-[#6B5E4C] dark:text-[#B8ACA0]">
                  For walk-in style parties who are 10 minutes away or calling on approach.
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isWaitlist}
                  onChange={(e) => {
                    setIsWaitlist(e.target.checked);
                    if (e.target.checked) {
                      setBookingDate(getTodayStr());
                    }
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-[#E37A08] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-zinc-300 dark:after:border-zinc-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E37A08]" />
              </label>
            </div>

            {/* Basic Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                  Last Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nair (Optional)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all"
                />
              </div>
            </div>

            {/* Phone Number with autolink message */}
            <div>
              <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-4 h-4 text-[#6B5E4C] dark:text-[#B8ACA0]" />
                <input
                  type="tel"
                  placeholder="e.g. 0412 345 678 (Optional)"
                  value={phone}
                  onChange={(e) => setPhone(formatAusMobile(e.target.value))}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all"
                />
              </div>
              {matchedCustomer && getCustomerBadgeText(matchedCustomer)}
            </div>

            {/* Party Size Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>Adults *</span>
                  <span className="text-[#E37A08] font-bold">{adultsCount}</span>
                </label>
                <div className="flex items-center gap-2 bg-[#F5F2EA] dark:bg-[#26221E] p-1 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E]">
                  <button
                    type="button"
                    disabled={adultsCount <= 1}
                    onClick={() => setAdultsCount(adultsCount - 1)}
                    className="w-9 h-9 rounded-lg bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] shadow-xs font-bold text-[#2D2926] dark:text-white active:scale-95 disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-sm text-[#2D2926] dark:text-white">
                    {adultsCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdultsCount(adultsCount + 1)}
                    className="w-9 h-9 rounded-lg bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] shadow-xs font-bold text-[#2D2926] dark:text-white active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>Children</span>
                  <span className="text-[#8B4513] dark:text-[#D2B48C] font-bold">{childrenCount}</span>
                </label>
                <div className="flex items-center gap-2 bg-[#F5F2EA] dark:bg-[#26221E] p-1 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E]">
                  <button
                    type="button"
                    disabled={childrenCount <= 0}
                    onClick={() => handleChildrenCountChange(childrenCount - 1)}
                    className="w-9 h-9 rounded-lg bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] shadow-xs font-bold text-[#2D2926] dark:text-white active:scale-95 disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-sm text-[#2D2926] dark:text-white">
                    {childrenCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleChildrenCountChange(childrenCount + 1)}
                    className="w-9 h-9 rounded-lg bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] shadow-xs font-bold text-[#2D2926] dark:text-white active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* High Chairs (only if children) */}
            {childrenCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-[#F5F2EA]/50 dark:bg-[#1C1917]/50 p-4 rounded-2xl border border-[#E8E2D2] dark:border-[#3D352E] space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#E8E2D2] dark:border-[#3D352E] pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#8B4513] dark:text-[#D2B48C] uppercase tracking-wider">
                    <Baby className="w-4 h-4 text-[#E37A08]" />
                    <span>High Chair Setup</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Array.from({ length: childrenCount }).map((_, idx) => (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] cursor-pointer hover:border-[#E37A08] transition-all shadow-xs"
                    >
                      <span className="text-xs font-semibold text-[#2D2926] dark:text-white">
                        Child #{idx + 1}: Needs High Chair?
                      </span>
                      <input
                        type="checkbox"
                        checked={childrenHighChairs[idx] || false}
                        onChange={(e) => {
                          const next = [...childrenHighChairs];
                          next[idx] = e.target.checked;
                          setChildrenHighChairs(next);
                        }}
                        className="w-4 h-4 rounded text-[#E37A08] focus:ring-[#E37A08] border-[#E8E2D2] dark:border-[#3D352E]"
                      />
                    </label>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Date and Time (hidden for waitlist) */}
            {!isWaitlist && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                      Booking Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={bookingDate}
                      onChange={(e) => {
                        setBookingDate(e.target.value);
                        if (getDayOfWeek(e.target.value) === 6) {
                          setSaturdayMenuType('kalyana');
                        } else {
                          setSaturdayMenuType('null');
                        }
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all"
                    />
                    {getDayOfWeek(bookingDate) === 2 && (
                      <span className="text-xs text-rose-500 font-bold mt-1.5 block">
                        ⚠️ Closed on Tuesdays
                      </span>
                    )}
                  </div>

                  <div>
                    {getDayOfWeek(bookingDate) === 6 && saturdayMenuType === 'kalyana' ? (
                      <div>
                        <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                          Time Slot *
                        </label>
                        <div className="py-3 px-4 bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-white text-xs rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] font-bold">
                          {kalyanaSlot.split(':')[0]} Selected
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                          Booking Time *
                        </label>
                        <select
                          value={bookingTime}
                          onChange={(e) => setBookingTime(e.target.value)}
                          disabled={getDayOfWeek(bookingDate) === 2}
                          className="w-full px-4 py-2.5 rounded-xl bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all disabled:opacity-50"
                        >
                          {currentSlots.map((slot) => (
                            <option key={slot.value} value={slot.value}>
                              {slot.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Saturday lunch Menu Type Selector */}
                {getDayOfWeek(bookingDate) === 6 && (
                  <div className="bg-amber-500/5 dark:bg-amber-500/0 border border-amber-400/30 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-[#8B4513] dark:text-[#D2B48C] uppercase">
                      Saturday Menu Selection *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSaturdayMenuType('kalyana');
                          setKalyanaSlot('Slot 1: 11:00am-12:30pm');
                        }}
                        className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                          saturdayMenuType === 'kalyana'
                            ? 'bg-[#8B4513] text-white border-transparent shadow-sm'
                            : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] border-[#E8E2D2] dark:border-[#3D352E]'
                        }`}
                      >
                        Kalyana Virundhu
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSaturdayMenuType('regular');
                        }}
                        className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all ${
                          saturdayMenuType === 'regular'
                            ? 'bg-[#8B4513] text-white border-transparent shadow-sm'
                            : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] border-[#E8E2D2] dark:border-[#3D352E]'
                        }`}
                      >
                        Regular Menu
                      </button>
                    </div>

                    {/* Kalyana Slot Selection */}
                    {saturdayMenuType === 'kalyana' && (
                      <div className="pt-2 space-y-2">
                        <span className="block text-[11px] font-bold text-[#8B4513] dark:text-[#D2B48C] uppercase">
                          Choose Seating Slot:
                        </span>
                        <div className="space-y-2">
                          {['Slot 1: 11:00am-12:30pm', 'Slot 2: 12:30pm-2:00pm', 'Slot 3: 2:00pm-3:30pm'].map((slot) => {
                            const guestsInSlot = getSlotGuestsCount(slot);
                            const capacity = dataService.getKalyanaCapacity();
                            const available = capacity - guestsInSlot;
                            const totalGuests = adultsCount + childrenCount;
                            const isFull = available <= 0;
                            const cannotFit = totalGuests > available;

                            return (
                              <button
                                key={slot}
                                type="button"
                                disabled={isFull || cannotFit}
                                onClick={() => setKalyanaSlot(slot)}
                                className={`w-full p-2.5 rounded-xl border-2 text-left flex items-center justify-between transition-all ${
                                  kalyanaSlot === slot
                                    ? 'border-[#E37A08] bg-white dark:bg-[#26221E] shadow-sm'
                                    : 'border-[#E8E2D2]/60 dark:border-[#3D352E]/60 bg-white/50 dark:bg-[#26221E]/30 disabled:opacity-40 disabled:cursor-not-allowed'
                                }`}
                              >
                                <div>
                                  <span className="font-serif font-bold text-xs text-[#2D2926] dark:text-white block">
                                    {slot}
                                  </span>
                                  <span className="text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0]">
                                    {isFull 
                                      ? 'Fully Booked' 
                                      : cannotFit 
                                      ? `Needs ${totalGuests} seats, only ${available} left`
                                      : `${available} of ${capacity} seats remaining`
                                    }
                                  </span>
                                </div>
                                {isFull ? (
                                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600">
                                    Full
                                  </span>
                                ) : kalyanaSlot === slot ? (
                                  <span className="w-4 h-4 rounded-full bg-[#E37A08] flex items-center justify-center text-white text-[10px] font-bold">
                                    ✓
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* Whatsapp Opt-in */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                id="whatsapp-opt"
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                className="w-4.5 h-4.5 rounded text-[#E37A08] focus:ring-[#E37A08] border-[#E8E2D2] dark:border-[#3D352E] cursor-pointer"
              />
              <label htmlFor="whatsapp-opt" className="text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] cursor-pointer select-none">
                Customer opt-in for automated WhatsApp Booking status & Queue alerts
              </label>
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 border-t border-[#E8E2D2] dark:border-[#3D352E] flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] hover:bg-[#F5F2EA] dark:hover:bg-[#26221E] text-xs font-bold text-[#2D2926] dark:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (!isWaitlist && getDayOfWeek(bookingDate) === 2)}
                className="px-6 py-2.5 bg-[#E37A08] text-white rounded-xl text-xs font-black hover:bg-[#c96906] transition-all shadow-md shadow-[#E37A08]/15 hover:shadow-[#E37A08]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Create Booking</span>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
