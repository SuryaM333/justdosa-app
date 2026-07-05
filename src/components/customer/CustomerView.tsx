import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Utensils, Clock, Calendar, Users, Baby, Phone, MessageSquare, CheckCircle2, Sparkles, ArrowLeft, AlertCircle, XCircle, QrCode } from 'lucide-react';
import { Booking } from '../../types';
import { dataService } from '../../services/dataService';
import { formatAusMobile, isValidAusMobile } from '../../utils/phone';
import { formatPartyBreakdown } from '../../utils/bookingUtils';
import { SignatureDishShowcase } from './SignatureDishShowcase';
import { LOGO_BASE64 } from '../logoBase64';

export const CustomerView: React.FC = () => {
  const [showIntro, setShowIntro] = useState(() => {
    return !sessionStorage.getItem('just_dosa_skip_welcome_intro');
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    if (showIntro) {
      const timer = setTimeout(() => {
        setShowIntro(false);
        sessionStorage.setItem('just_dosa_skip_welcome_intro', 'true');
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [showIntro]);

  const [activeTab, setActiveTab] = useState<'walk-in' | 'remote' | 'status' | 'confirmation'>('walk-in');
  const [activeBookingId, setActiveBookingId] = useState<string | null>(() => {
    return localStorage.getItem('just_dosa_active_customer_booking_id') || null;
  });
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [hasRoutedOnLoad, setHasRoutedOnLoad] = useState(false);
  const [queueInfo, setQueueInfo] = useState<{ position: number; totalWaiting: number; estimatedWaitMinutes: number }>({
    position: 0,
    totalWaiting: 0,
    estimatedWaitMinutes: 0,
  });

  // Automatically load bookingId from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlBookingId = params.get('bookingId');
    if (urlBookingId) {
      localStorage.setItem('just_dosa_active_customer_booking_id', urlBookingId);
      setActiveBookingId(urlBookingId);
      // Clean up search parameters in URL
      const url = new URL(window.location.href);
      url.searchParams.delete('bookingId');
      window.history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  }, []);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [adultsCount, setAdultsCount] = useState(2);
  const [childrenCount, setChildrenCount] = useState(0);
  const [childrenHighChairs, setChildrenHighChairs] = useState<boolean[]>([]);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [bookingDate, setBookingDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getDay() === 2) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    return tomorrow.toISOString().split('T')[0];
  });
  const [bookingTime, setBookingTime] = useState('18:30');
  const [saturdayMenuType, setSaturdayMenuType] = useState<'regular' | 'kalyana' | null>(null);
  const [kalyanaSlot, setKalyanaSlot] = useState('Slot 1: 11:00am-12:30pm');
  const [errorMsg, setErrorMsg] = useState('');
  const [showChangeForm, setShowChangeForm] = useState(false);
  const [changeNote, setChangeNote] = useState('');

  const getDayOfWeek = (dateStr: string) => {
    if (!dateStr) return -1;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return -1;
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return date.getDay();
  };

  useEffect(() => {
    const day = getDayOfWeek(bookingDate);
    if (day === 6) {
      if (!saturdayMenuType) {
        setSaturdayMenuType('kalyana');
      }
    } else {
      setSaturdayMenuType(null);
    }
  }, [bookingDate]);

  const handleAdultsCountChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(48 - childrenCount, newCount));
    setAdultsCount(validCount);
  };

  const handleChildrenCountChange = (newCount: number) => {
    const validCount = Math.max(0, Math.min(48 - adultsCount, newCount));
    setChildrenCount(validCount);
    setChildrenHighChairs((prev) => Array.from({ length: validCount }, (_, i) => prev[i] ?? false));
  };

  // Subscribe to live data changes and poll for active booking state
  useEffect(() => {
    const updateActiveBookingState = () => {
      if (!activeBookingId) {
        setActiveBooking(null);
        return;
      }
      const bookings = dataService.getBookings();
      const found = bookings.find((b) => b.id === activeBookingId);
      if (found) {
        setActiveBooking(found);
        if (!hasRoutedOnLoad) {
          if (found.type === 'walk-in' && (found.status === 'waiting' || found.status === 'seated' || found.status === 'finished')) {
            setActiveTab('status');
          } else if (found.type === 'remote' && ['booked', 'pending', 'confirmed', 'declined', 'alternative_proposed', 'cancelled'].includes(found.status)) {
            setActiveTab('confirmation');
          }
          setHasRoutedOnLoad(true);
        }
        
        // Always keep queueInfo up to date
        if (found.type === 'walk-in') {
          const qInfo = dataService.getWaitingQueuePosition(found.id);
          setQueueInfo(qInfo);
        }
      } else {
        setActiveBooking(null);
        localStorage.removeItem('just_dosa_active_customer_booking_id');
        setActiveBookingId(null);
      }
    };

    updateActiveBookingState();
    const unsubscribe = dataService.subscribe(updateActiveBookingState);
    const pollInterval = setInterval(updateActiveBookingState, 2000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [activeBookingId, hasRoutedOnLoad]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAusMobile(e.target.value);
    setPhone(formatted);
    if (errorMsg) setErrorMsg('');
  };

  const getSlotGuestsCount = (slotName: string) => {
    const bookings = dataService.getBookings();
    return bookings
      .filter((b) => b.bookingDate === bookingDate && b.isKalyanaVirundhu && b.kalyanaSlot === slotName && ['pending', 'confirmed', 'booked'].includes(b.status))
      .reduce((sum, b) => sum + (b.partySize || 0), 0);
  };

  const getAvailableTimeSlots = (dateStr: string) => {
    const day = getDayOfWeek(dateStr);
    if (day === 2) return []; // Closed Tuesdays
    
    const slots: { value: string; label: string; timeString: string }[] = [];
    
    // Saturday or Sunday lunch (11:00 AM - 3:00 PM). Last slot is 1 hour before close, i.e., 2:00 PM (14:00)
    if (day === 6 || day === 0) {
      const lunchStart = dataService.getLunchStartTime();
      const [lStartHour, lStartMin] = lunchStart.split(':').map(Number);
      const lEndHour = 14; // 1 hour before 15:00
      const lEndMin = 0;

      let hour = lStartHour;
      let min = lStartMin;
      while (hour < lEndHour || (hour === lEndHour && min <= lEndMin)) {
        const val = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        const timeString = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
        slots.push({ value: val, label: `${timeString} (Lunch)`, timeString });
        min += 15;
        if (min === 60) {
          min = 0;
          hour += 1;
        }
      }
    }
    
    // Wednesday to Monday dinner (5:30 PM - 10:00 PM). Last slot is 1 hour before close, i.e., 9:00 PM (21:00)
    const dinnerStart = dataService.getDinnerStartTime();
    const [dStartHour, dStartMin] = dinnerStart.split(':').map(Number);
    const dEndHour = 21; // 1 hour before 22:00
    const dEndMin = 0;

    let hour = dStartHour;
    let min = dStartMin;
    while (hour < dEndHour || (hour === dEndHour && min <= dEndMin)) {
      const val = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      const timeString = `${displayHour}:${min.toString().padStart(2, '0')} ${ampm}`;
      slots.push({ value: val, label: `${timeString} (Dinner)`, timeString });
      min += 15;
      if (min === 60) {
        min = 0;
        hour += 1;
      }
    }
    
    return slots;
  };

  useEffect(() => {
    const slots = getAvailableTimeSlots(bookingDate);
    if (slots.length > 0) {
      if (!slots.some((s) => s.value === bookingTime)) {
        setBookingTime(slots[0].value);
      }
    }
  }, [bookingDate, bookingTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('Please enter both first and last name.');
      return;
    }
    if (!isValidAusMobile(phone)) {
      setErrorMsg('Please enter a valid Australian mobile number (e.g. 0412 345 678).');
      return;
    }

    const day = getDayOfWeek(bookingDate);
    if (activeTab === 'remote' && day === 2) {
      setErrorMsg("We're closed on Tuesdays. Please pick another day.");
      return;
    }

    setErrorMsg('');

    const totalGuests = adultsCount + childrenCount;
    const highChairsNeeded = childrenHighChairs.filter(Boolean).length;
    const isKalyana = activeTab === 'remote' && day === 6 && saturdayMenuType === 'kalyana';

    if (isKalyana) {
      const guestsInSlot = getSlotGuestsCount(kalyanaSlot);
      const capacity = dataService.getKalyanaCapacity();
      if (guestsInSlot + totalGuests > capacity) {
        setErrorMsg(`Selected Kalyana Virundhu slot is fully booked. Only ${capacity - guestsInSlot} seats left.`);
        return;
      }
    }

    const newBk = await dataService.createBooking({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone,
      partySize: totalGuests,
      childSeats: highChairsNeeded,
      adultsCount,
      childrenCount,
      childrenHighChairs,
      whatsappOptIn,
      type: activeTab === 'walk-in' ? 'walk-in' : 'remote',
      bookingDate: activeTab === 'remote' ? bookingDate : undefined,
      bookingTime: activeTab === 'remote' ? (isKalyana ? kalyanaSlot : bookingTime) : undefined,
      isKalyanaVirundhu: isKalyana,
      kalyanaSlot: isKalyana ? kalyanaSlot : undefined,
    });

    localStorage.setItem('just_dosa_active_customer_booking_id', newBk.id);
    setActiveBookingId(newBk.id);
    setActiveBooking(newBk);
    setHasRoutedOnLoad(true);

    if (newBk.type === 'walk-in') {
      const qInfo = dataService.getWaitingQueuePosition(newBk.id);
      setQueueInfo(qInfo);
      setActiveTab('status');
    } else {
      setActiveTab('confirmation');
    }
  };

  const handleCancelBooking = () => {
    if (activeBookingId && activeBooking) {
      dataService.cancelBooking(activeBookingId);
    }
  };

  const handleRequestChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeNote.trim() || !activeBookingId) return;
    dataService.requestBookingChange(activeBookingId, changeNote.trim());
    setChangeNote('');
    setShowChangeForm(false);
  };

  const handleResetSession = () => {
    localStorage.removeItem('just_dosa_active_customer_booking_id');
    setActiveBookingId(null);
    setActiveBooking(null);
    setActiveTab('walk-in');
    setFirstName('');
    setLastName('');
    setPhone('');
    setAdultsCount(2);
    setChildrenCount(0);
    setChildrenHighChairs([]);
    setWhatsappOptIn(false);
    setSaturdayMenuType(null);
    setHasRoutedOnLoad(false);
  };

  const handleBackToHome = () => {
    if (activeBooking && ['finished', 'cancelled', 'declined', 'no-show'].includes(activeBooking.status)) {
      handleResetSession();
    } else {
      setActiveTab('walk-in');
    }
  };

  const handleLeaveWaitlist = () => {
    if (activeBookingId) {
      dataService.cancelBooking(activeBookingId);
    }
    handleResetSession();
  };

  // Render Status screen for walk-ins
  if (activeTab === 'status' && activeBooking) {
    const isReady = activeBooking.status === 'seated';
    const isFinished = activeBooking.status === 'finished';
    const allocatedTable = activeBooking.tableId
      ? dataService.getTables().find((t) => t.id.toString() === activeBooking.tableId?.toString() || t.name === activeBooking.tableId?.toString())
      : null;
    const orderingUrl = allocatedTable?.orderingUrl || (activeBooking.tableId ? `https://justdosa.com.au/order/table-${activeBooking.tableId}` : null);

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#1C1917] py-8 px-4 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#26221E] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#3D352E] text-center relative overflow-hidden"
        >
          {/* Top accent line */}
          <div className={`absolute top-0 left-0 right-0 h-2 ${isFinished ? 'bg-[#E37A08]' : isReady ? 'bg-[#22C55E]' : 'bg-[#E37A08]'}`} />

          {isFinished ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              <div className="w-20 h-20 bg-amber-500/10 dark:bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-500 border-4 border-amber-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-2 leading-tight">
                Thank you for dining with us, {activeBooking.firstName}!
              </h2>
              <p className="text-sm text-[#B8ACA0] mb-8">
                We hope you enjoyed your meal. We hope to see you again soon!
              </p>
              
              <button
                onClick={handleResetSession}
                className="w-full py-3.5 px-5 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mb-2"
              >
                <span>Make a new booking</span>
              </button>
            </motion.div>
          ) : isReady ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
            >
              <div className="w-20 h-20 bg-[#22C55E]/10 dark:bg-[#22C55E]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#22C55E] border-4 border-[#22C55E]/20 animate-pulse">
                <Sparkles className="w-10 h-10" />
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white mb-2">
                Welcome to Just Dosa, {activeBooking.firstName}! 🎉
              </h2>
              <p className="text-sm text-[#B8ACA0] mb-6">
                Your table is ready. Our team is ready to serve you freshly prepared food at your service.
              </p>
              <div className="my-6 bg-[#1C1917] border-2 border-[#3D352E] rounded-2xl p-6">
                <p className="text-xs uppercase tracking-wider text-[#D2B48C] font-bold mb-1">
                  Please proceed to
                </p>
                <div className="text-4xl sm:text-5xl font-black text-[#22C55E] font-mono mb-4">
                  Table {activeBooking.tableId}
                </div>

                {orderingUrl && (
                  <div className="mt-4 pt-4 border-t border-[#3D352E] text-left">
                    {(activeBooking.tableId?.toString() === '6' || activeBooking.tableId?.toString() === '7' || !orderingUrl || orderingUrl.includes('table-6') || orderingUrl.includes('table-7')) ? (
                      <div className="text-xs font-semibold text-[#D2B48C] text-center bg-[#26221E] border border-[#3D352E] p-3.5 rounded-xl mb-3 leading-relaxed">
                        Please ask our staff for the menu — we'll take your order at the table.
                      </div>
                    ) : (
                      <a
                        href={orderingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all block mb-3 text-center"
                      >
                        <Utensils className="w-4 h-4" />
                        <span>View Menu & Order Now</span>
                      </a>
                    )}
                    <div className="flex items-start gap-2 text-[11px] text-[#B8ACA0] italic bg-[#26221E] p-2.5 rounded-xl border border-[#3D352E]">
                      <QrCode className="w-4 h-4 shrink-0 text-[#E37A08] mt-0.5" />
                      <span>Note: You can also order directly at your table by scanning the physical QR code display stand.</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div>
              <div className="w-16 h-16 bg-[#1C1917] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#E37A08] border border-[#3D352E]">
                <Clock className="w-8 h-8 animate-spin" style={{ animationDuration: '8s' }} />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mb-1">
                Waiting for Allocation
              </h2>
              <p className="text-xs text-[#B8ACA0] mb-6">
                Hi {activeBooking.firstName}, you are on the live waitlist for {formatPartyBreakdown(activeBooking)}.
              </p>

              {/* Queue Position & Allocation Info */}
              <div className="grid grid-cols-1 gap-4 mb-6">
                <div className="bg-[#1C1917] border border-[#3D352E] rounded-3xl p-5 text-center shadow-xs">
                  <span className="text-xs uppercase font-bold text-[#D2B48C] block mb-2 tracking-widest">
                    Queue Position
                  </span>
                  <div className="text-5xl font-black text-[#E37A08] font-mono tracking-tight mb-2">
                    #{queueInfo.position}
                  </div>
                  <span className="text-xs font-semibold text-[#B8ACA0] block mb-3">
                    of {queueInfo.totalWaiting} parties waiting
                  </span>
                  <div className="pt-3 border-t border-[#3D352E]/60 text-xs sm:text-sm font-semibold text-[#D2B48C] flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E37A08] animate-pulse shrink-0" />
                    <span>Please wait — our team will allocate your table shortly.</span>
                  </div>
                </div>
              </div>

              {/* Premium Signature Dish Showcase slider */}
              <SignatureDishShowcase />

              <div className="bg-[#1C1917] rounded-xl p-3 text-left text-xs text-[#B8ACA0] mb-6 border border-[#3D352E]">
                <div className="flex items-center gap-2 mb-1 text-white font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#E37A08] animate-ping" />
                  Live Auto-Updating Screen
                </div>
                When our staff allocates your table, this screen will instantly change to show your table number!
              </div>
            </div>
          )}

          {!isFinished && (
            <div className="space-y-3">
              <button
                onClick={handleBackToHome}
                className="w-full py-3 rounded-xl bg-[#1C1917] hover:bg-[#3D352E] text-[#B8ACA0] font-bold text-sm transition-colors border border-[#3D352E]"
              >
                Back to Home
              </button>
              <button
                onClick={isReady ? handleResetSession : handleLeaveWaitlist}
                className="w-full py-2.5 rounded-xl bg-transparent hover:bg-rose-500/10 text-rose-500 font-bold text-xs transition-colors border border-rose-500/20"
              >
                {isReady ? 'Done / Make Another Booking' : 'Leave Waitlist / Cancel'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Render Confirmation screen for remote bookings
  if (activeTab === 'confirmation' && activeBooking) {
    const isCancelled = activeBooking.status === 'cancelled';
    const isPending = activeBooking.status === 'pending';
    const isConfirmed = activeBooking.status === 'confirmed' || activeBooking.status === 'booked';
    const isDeclined = activeBooking.status === 'declined';
    const isAltProposed = activeBooking.status === 'alternative_proposed';

    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#1C1917] py-8 px-4 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-[#26221E] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#3D352E] text-center relative overflow-hidden"
        >
          <div className={`absolute top-0 left-0 right-0 h-2 ${isCancelled ? 'bg-[#EF4444]' : isPending ? 'bg-[#F59E0B]' : isDeclined ? 'bg-rose-500' : isAltProposed ? 'bg-amber-400 animate-pulse' : 'bg-[#22C55E]'}`} />

          {isCancelled ? (
            <div>
              <div className="w-16 h-16 bg-[#EF4444]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#EF4444] border border-[#EF4444]/20">
                <XCircle className="w-8 h-8" />
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mb-2">
                Booking Cancelled
              </h2>
              <p className="text-sm text-[#B8ACA0] mb-6">
                Your reservation for {formatPartyBreakdown(activeBooking)} has been cancelled. We hope to see you another time!
              </p>
            </div>
          ) : (
            <div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 border ${
                isPending ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                isDeclined ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                isAltProposed ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-bounce' :
                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                {isPending && <Clock className="w-8 h-8 animate-pulse" />}
                {isDeclined && <AlertCircle className="w-8 h-8" />}
                {isAltProposed && <Clock className="w-8 h-8 animate-pulse text-amber-500" />}
                {isConfirmed && <CheckCircle2 className="w-8 h-8" />}
              </div>

              <h2 className="font-serif text-xl sm:text-2xl font-bold text-white mb-1">
                {isPending && "Booking requested — we'll confirm shortly"}
                {isConfirmed && "Booking Confirmed!"}
                {isDeclined && "Reservation Declined"}
                {isAltProposed && "Alternative Time Proposed"}
              </h2>
              <p className="text-xs text-[#B8ACA0] mb-6">
                {isPending && "We have received your reservation request. Our team is reviewing and will confirm soon."}
                {isConfirmed && "We have confirmed and saved your table reservation at Just Dosa Melbourne."}
                {isDeclined && "We couldn't accommodate the exact time requested. Please check alternative times or contact us."}
                {isAltProposed && "That time isn't available — we can offer you this alternative slot instead:"}
              </p>

              {/* Alternative proposal details call-out */}
              {isAltProposed && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-left space-y-3 mb-6">
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg">🔔</span>
                    <div>
                      <h4 className="font-bold text-xs text-[#D2B48C] uppercase tracking-wider">
                        Suggested Offer
                      </h4>
                      <p className="text-[11px] text-[#B8ACA0] mt-0.5">
                        Please review our team's proposed alternative:
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-[#1C1917] p-3.5 rounded-xl border border-amber-500/20 text-center">
                    <div className="text-xs font-bold text-white">
                      {activeBooking.alternativeDate}
                    </div>
                    <div className="text-lg font-black text-[#E37A08] font-mono mt-0.5">
                      {activeBooking.alternativeIsKalyana ? activeBooking.alternativeKalyanaSlot : activeBooking.alternativeTime}
                    </div>
                    {activeBooking.alternativeIsKalyana && (
                      <span className="inline-block mt-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-bold">
                        Kalyana Virundhu Special Feast
                      </span>
                    )}
                  </div>

                  {activeBooking.proposalNote && (
                    <div className="bg-[#1C1917]/70 p-3.5 rounded-xl border border-amber-500/30 text-xs text-[#B8ACA0] shadow-sm">
                      <span className="font-bold text-[#D2B48C] block mb-1">
                        Note from Just Dosa:
                      </span>
                      <p className="italic font-medium text-white">
                        "{activeBooking.proposalNote}"
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => dataService.acceptAlternativeTime(activeBooking.id)}
                      className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-sm transition-all"
                    >
                      ✓ Accept Proposal
                    </button>
                    <button
                      onClick={() => dataService.declineAlternativeTime(activeBooking.id)}
                      className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition-all"
                    >
                      ✗ Decline
                    </button>
                  </div>
                </div>
              )}

              {/* Booking details card */}
              <div className="bg-[#1C1917] border border-[#3D352E] rounded-2xl p-5 text-left mb-6 space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#B8ACA0]">Status</span>
                  <span className={`font-extrabold uppercase text-xs px-2 py-0.5 rounded ${
                    isPending ? 'bg-amber-500/20 text-amber-400' :
                    isDeclined ? 'bg-rose-500/20 text-rose-400' :
                    isAltProposed ? 'bg-amber-500/20 text-amber-400 animate-pulse' :
                    'bg-emerald-500/20 text-emerald-400'
                  }`}>{activeBooking.status.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#B8ACA0]">Name</span>
                  <span className="font-semibold text-white">{activeBooking.firstName} {activeBooking.lastName}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#B8ACA0]">Date</span>
                  <span className="font-semibold text-[#D2B48C]">{activeBooking.bookingDate}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#B8ACA0]">Time</span>
                  <span className="font-semibold text-[#D2B48C]">{activeBooking.bookingTime}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#B8ACA0]">Menu Type</span>
                  <span className={`font-bold text-xs ${activeBooking.isKalyanaVirundhu ? 'text-[#E37A08]' : 'text-blue-400'}`}>
                    {activeBooking.isKalyanaVirundhu ? `Kalyana Virundhu (${activeBooking.kalyanaSlot?.split(':')[0]})` : 'Regular Menu'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#B8ACA0]">Party Size</span>
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span>{formatPartyBreakdown(activeBooking)}</span>
                    {((activeBooking.childrenHighChairs?.filter(Boolean).length ?? activeBooking.childSeats) > 0) && (
                      <span className="inline-flex items-center gap-0.5 bg-[#E37A08]/10 text-[#E37A08] px-1.5 py-0.5 rounded text-xs font-bold border border-[#E37A08]/30">
                        <Baby className="w-3.5 h-3.5" />
                        <span>High Chair</span>
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {activeBooking.changeRequestedNote && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 text-left mb-6">
                  <strong className="block font-bold">Change Requested:</strong>
                  <p className="italic mt-0.5">"{activeBooking.changeRequestedNote}"</p>
                  <span className="text-[10px] opacity-80 block mt-1">Our staff is reviewing your request.</span>
                </div>
              )}

              {activeBooking.whatsappOptIn && (
                <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 rounded-xl p-3 text-xs text-[#22C55E] flex items-center gap-2 mb-6 font-medium">
                  <MessageSquare className="w-4 h-4 text-[#22C55E] shrink-0" />
                  <span>You're subscribed for updates on WhatsApp!</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 mb-6">
                {!activeBooking.changeRequestedNote && !showChangeForm && (
                  <button
                    onClick={() => setShowChangeForm(true)}
                    className="w-full py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#3D352E] text-[#D2B48C] font-bold text-xs border border-[#3D352E] transition-colors"
                  >
                    Request a change (Date, Time or Size)
                  </button>
                )}

                {showChangeForm && (
                  <form onSubmit={handleRequestChangeSubmit} className="bg-[#1C1917] p-3 rounded-xl border border-[#3D352E] text-left space-y-2">
                    <label className="block text-[11px] font-bold text-[#D2B48C]">
                      What would you like to change?
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Can we change to 7:00 PM or add 1 adult?"
                      value={changeNote}
                      onChange={(e) => setChangeNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#26221E] border border-[#3D352E] text-xs text-white"
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        className="flex-1 py-1.5 bg-[#E37A08] text-white rounded-lg text-xs font-bold hover:bg-[#c96906] transition-colors"
                      >
                        Submit Request
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowChangeForm(false)}
                        className="px-3 py-1.5 bg-[#26221E] text-[#B8ACA0] rounded-lg text-xs font-bold border border-[#3D352E]"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}

                <button
                  onClick={handleCancelBooking}
                  className="text-xs text-rose-500 hover:underline font-semibold block mx-auto transition-all"
                >
                  Cancel my booking
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleBackToHome}
            className="w-full py-3 rounded-xl bg-[#1C1917] hover:bg-[#3D352E] text-[#B8ACA0] font-bold text-sm transition-colors border border-[#3D352E]"
          >
            Back to Home
          </button>
        </motion.div>
      </div>
    );
  }

  // Render main form / selection
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: prefersReducedMotion ? 0 : 0.05,
      }
    }
  };

  const itemVariants = prefersReducedMotion ? {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.4 } }
  } : {
    hidden: { opacity: 0, y: 25 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        type: "spring", 
        damping: 18, 
        stiffness: 110 
      } 
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {showIntro && (
          <motion.div
            key="welcome-intro"
            initial={{ opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -80 }}
            transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
            className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-[#12100E]"
          >
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.65 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={prefersReducedMotion ? { duration: 0.5 } : { type: "spring", damping: 15, stiffness: 100, delay: 0.1 }}
              className="w-56 h-56 mb-4 flex items-center justify-center"
            >
              <img src={LOGO_BASE64} alt="Just Dosa Logo" className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(227,122,8,0.25)]" referrerPolicy="no-referrer" />
            </motion.div>
            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut", delay: 0.4 }}
              className="text-center"
            >
              <h1 className="font-serif text-3xl font-bold text-[#D2B48C] tracking-tight">
                Welcome to Just Dosa
              </h1>
              <p className="text-xs text-[#B8ACA0] tracking-widest uppercase mt-2 font-medium">
                Melbourne
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-[calc(100vh-4rem)] bg-[#12100E] bg-linear-to-b from-[#1C1917] via-[#151210] to-[#12100E] py-8 px-4 sm:px-6 relative overflow-hidden">
        {/* Subtle banana leaf background glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#22C55E]/5 dark:bg-[#22C55E]/2 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#E37A08]/5 dark:bg-[#E37A08]/2 rounded-full blur-3xl pointer-events-none" />

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-xl mx-auto relative z-10"
        >
          {/* Active Booking Top Banner */}
          {activeBookingId && activeBooking && !['finished', 'cancelled', 'declined', 'no-show'].includes(activeBooking.status) && (
            <motion.div
              variants={itemVariants}
              className="mb-6 p-4 rounded-2xl bg-[#E37A08]/10 dark:bg-[#E37A08]/15 border border-[#E37A08]/40 flex items-center justify-between text-xs relative z-20 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E37A08] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E37A08]"></span>
                </span>
                <div className="text-left">
                  <span className="font-bold text-[#E37A08] dark:text-[#D2B48C] block text-sm mb-0.5">
                    You have an active booking!
                  </span>
                  <span className="text-[#6B5E4C] dark:text-[#B8ACA0] font-medium">
                    {activeBooking.firstName} ({formatPartyBreakdown(activeBooking)}) • <span className="uppercase font-bold text-amber-600 dark:text-amber-400">{activeBooking.status.replace('_', ' ')}</span>
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (activeBooking.type === 'walk-in') {
                    setActiveTab('status');
                  } else {
                    setActiveTab('confirmation');
                  }
                }}
                className="px-4 py-2 rounded-xl bg-[#E37A08] text-white font-bold hover:bg-[#C96905] shadow-xs cursor-pointer select-none transition-all whitespace-nowrap"
              >
                View Status
              </button>
            </motion.div>
          )}

          {/* Welcome Header */}
          <motion.div variants={itemVariants} className="text-center mb-8">
            <div className="w-56 h-56 mx-auto mb-2 flex items-center justify-center bg-transparent shrink-0">
              <img src={LOGO_BASE64} alt="Just Dosa Logo" className="w-full h-full object-contain drop-shadow-md animate-[pulse_3s_infinite]" referrerPolicy="no-referrer" />
            </div>
            <span className="inline-block px-3 py-1 rounded-md bg-[#F5F2EA] dark:bg-[#26221E] text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-bold uppercase tracking-widest mb-2">
              Authentic South Indian • Mill Park, Melbourne
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#2D2926] dark:text-white tracking-tight mb-2">
              Welcome to <span className="text-[#8B4513] dark:text-[#D2B48C]">Just Dosa</span>
            </h1>
            <p className="text-sm text-[#6B5E4C] dark:text-[#B8ACA0] mb-4">
              Select an option below to join the live queue or reserve for later.
            </p>

            {/* Operating Hours Info Badge */}
            <div className="mt-4 inline-flex flex-col sm:flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] text-[#6B5E4C] dark:text-[#B8ACA0] bg-[#F5F2EA]/60 dark:bg-[#26221E]/40 px-4 py-2.5 rounded-2xl border border-[#E8E2D2]/60 dark:border-[#3D352E]/60 max-w-lg mx-auto shadow-2xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span><strong className="font-bold">Tue:</strong> Closed</span>
              </div>
              <div className="hidden sm:block text-[#E8E2D2] dark:text-[#3D352E]">|</div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span><strong className="font-bold">Mon, Wed-Fri:</strong> Dinner 5:30 PM - 10:00 PM</span>
              </div>
              <div className="hidden sm:block text-[#E8E2D2] dark:text-[#3D352E]">|</div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span><strong className="font-bold">Sat-Sun:</strong> Lunch 11:00 AM - 3:00 PM &amp; Dinner 5:30 PM - 10:00 PM</span>
              </div>
            </div>
          </motion.div>

          {/* Option Selectors */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <button
            onClick={() => {
              setActiveTab('walk-in');
              setErrorMsg('');
            }}
            className={`p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              activeTab === 'walk-in'
                ? 'border-[#E37A08] bg-[#F5F2EA] dark:bg-[#26221E] shadow-md shadow-[#E37A08]/10'
                : 'border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E]/60 hover:border-[#E37A08]/50'
            }`}
          >
            {activeTab === 'walk-in' && (
              <div className="absolute top-0 right-0 w-8 h-8 bg-[#E37A08] text-white rounded-bl-xl flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            <div className="w-10 h-10 rounded-xl bg-[#E37A08]/10 flex items-center justify-center text-[#E37A08] mb-3">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white mb-1">
                I'm here — join the waitlist
              </h3>
              <p className="text-xs text-[#A1917B] dark:text-[#9C8D7C]">
                Scanned QR code at restaurant? Join queue for immediate seating.
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              setActiveTab('remote');
              setErrorMsg('');
            }}
            className={`p-5 rounded-2xl border-2 text-left transition-all relative overflow-hidden flex flex-col justify-between ${
              activeTab === 'remote'
                ? 'border-[#8B4513] bg-[#F5F2EA] dark:bg-[#26221E] shadow-md shadow-[#8B4513]/10'
                : 'border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E]/60 hover:border-[#8B4513]/50'
            }`}
          >
            {activeTab === 'remote' && (
              <div className="absolute top-0 right-0 w-8 h-8 bg-[#8B4513] text-white rounded-bl-xl flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}
            <div className="w-10 h-10 rounded-xl bg-[#8B4513]/10 flex items-center justify-center text-[#8B4513] dark:text-[#D2B48C] mb-3">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white mb-1">
                Book a table for later
              </h3>
              <p className="text-xs text-[#A1917B] dark:text-[#9C8D7C]">
                Reserve your date & time for a future lunch or dinner.
              </p>
            </div>
          </button>
        </motion.div>

        {/* Form Container */}
        <motion.div variants={itemVariants}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-[#26221E] rounded-3xl p-6 sm:p-8 shadow-xl border border-[#E8E2D2] dark:border-[#3D352E]"
          >
          <div className="flex items-center gap-2 pb-4 mb-6 border-b border-[#E8E2D2] dark:border-[#3D352E]">
            <div className={`w-3 h-3 rounded-full ${activeTab === 'walk-in' ? 'bg-[#E37A08]' : 'bg-[#8B4513]'}`} />
            <h2 className="font-serif font-bold text-lg text-[#2D2926] dark:text-white">
              {activeTab === 'walk-in' ? 'Walk-In Waitlist Form' : 'Remote Reservation Form'}
            </h2>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-xs flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-[#2D2926] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nair"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-[#2D2926] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all"
                />
              </div>
            </div>

            {/* Phone Number with validation hint */}
            <div>
              <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5 flex justify-between">
                <span>Phone Number *</span>
                <span className="text-[10px] text-[#A1917B] font-normal">Aus Mobile (04XX XXX XXX)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A1917B]">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  required
                  placeholder="0412 345 678"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-[#2D2926] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E37A08] font-mono transition-all"
                />
              </div>
            </div>

            {/* Date & Time Pickers for Remote Booking */}
            {activeTab === 'remote' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-2 border-t border-[#E8E2D2] dark:border-[#3D352E]"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                      Booking Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      onKeyDown={(e) => e.preventDefault()}
                      className="w-full px-4 py-3 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-[#2D2926] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all cursor-pointer"
                    />
                    {getDayOfWeek(bookingDate) === 2 && (
                      <span className="text-xs text-rose-500 font-bold mt-1.5 block">
                        ⚠️ We're closed on Tuesdays
                      </span>
                    )}
                  </div>
                  <div>
                    {getDayOfWeek(bookingDate) === 6 && saturdayMenuType === 'kalyana' ? (
                      <div>
                        <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                          Time Slot *
                        </label>
                        <div className="py-3 px-4 bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-white text-sm rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] font-medium">
                          {kalyanaSlot.split(':')[0]} Selected
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                          Time *
                        </label>
                        {getDayOfWeek(bookingDate) === 2 ? (
                          <div className="py-3 px-4 bg-rose-500/10 text-rose-500 text-xs font-bold rounded-xl border border-rose-500/20 text-center">
                            Closed Tuesdays
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-[#F5F2EA]/40 dark:bg-[#1C1917]/40 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E]">
                            {getAvailableTimeSlots(bookingDate).map((slot) => {
                              const isSelected = bookingTime === slot.value;
                              return (
                                <button
                                  key={slot.value}
                                  type="button"
                                  onClick={() => setBookingTime(slot.value)}
                                  className={`py-1.5 px-2 text-[11px] font-bold rounded-lg border transition-all text-center ${
                                    isSelected
                                      ? 'bg-[#E37A08] border-transparent text-white shadow-sm'
                                      : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] border-[#E8E2D2] dark:border-[#3D352E] hover:border-[#E37A08]/50'
                                  }`}
                                >
                                  {slot.timeString}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Saturday Menu Selection Question */}
                {getDayOfWeek(bookingDate) === 6 && (
                  <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-[#8B4513] dark:text-[#D2B48C] uppercase">
                      Saturday Menu Option *
                    </label>
                    <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                      Would you like to enjoy our traditional <strong className="font-bold">Kalyana Virundhu</strong> (special feast served on banana leaf) or order from our <strong className="font-bold">Regular menu</strong>?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSaturdayMenuType('kalyana');
                          setKalyanaSlot('Slot 1: 11:00am-12:30pm');
                        }}
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all ${
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
                        className={`py-2.5 px-3 rounded-xl font-bold text-xs border transition-all ${
                          saturdayMenuType === 'regular'
                            ? 'bg-[#8B4513] text-white border-transparent shadow-sm'
                            : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] border-[#E8E2D2] dark:border-[#3D352E]'
                        }`}
                      >
                        Regular Menu
                      </button>
                    </div>

                    {/* Fixed seating slot selection */}
                    {saturdayMenuType === 'kalyana' && (
                      <div className="pt-2 space-y-2">
                        <span className="block text-xs font-bold text-[#8B4513] dark:text-[#D2B48C]">
                          Choose your Seating Slot:
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
                                className={`w-full p-3 rounded-xl border-2 text-left flex items-center justify-between transition-all ${
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
                                    Fully Booked
                                  </span>
                                ) : kalyanaSlot === slot ? (
                                  <span className="w-4.5 h-4.5 rounded-full bg-[#E37A08] flex items-center justify-center text-white text-xs font-bold">
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

            {/* Adults and Children Counts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>Number of Adults *</span>
                  <span className="text-[10px] text-[#E37A08] font-bold">{adultsCount} {adultsCount === 1 ? 'Adult' : 'Adults'}</span>
                </label>
                <div className="flex items-center gap-2 bg-[#FDFBF7] dark:bg-[#1C1917] p-1.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E]">
                  <button
                    type="button"
                    disabled={adultsCount <= 1}
                    onClick={() => handleAdultsCountChange(adultsCount - 1)}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm font-bold text-lg text-[#2D2926] dark:text-white active:scale-95 disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-base text-[#2D2926] dark:text-white">
                    {adultsCount}
                  </span>
                  <button
                    type="button"
                    disabled={adultsCount + childrenCount >= 48}
                    onClick={() => handleAdultsCountChange(adultsCount + 1)}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm font-bold text-lg text-[#2D2926] dark:text-white active:scale-95 disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5 flex justify-between">
                  <span>Number of Children</span>
                  <span className="text-[10px] text-[#8B4513] dark:text-[#D2B48C] font-bold">{childrenCount} {childrenCount === 1 ? 'Child' : 'Children'}</span>
                </label>
                <div className="flex items-center gap-2 bg-[#FDFBF7] dark:bg-[#1C1917] p-1.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E]">
                  <button
                    type="button"
                    disabled={childrenCount <= 0}
                    onClick={() => handleChildrenCountChange(childrenCount - 1)}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm font-bold text-lg text-[#2D2926] dark:text-white active:scale-95 disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="flex-1 text-center font-bold text-base text-[#2D2926] dark:text-white">
                    {childrenCount}
                  </span>
                  <button
                    type="button"
                    disabled={adultsCount + childrenCount >= 48}
                    onClick={() => handleChildrenCountChange(childrenCount + 1)}
                    className="w-10 h-10 rounded-lg bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm font-bold text-lg text-[#2D2926] dark:text-white active:scale-95 disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Custom note for large parties */}
            {adultsCount + childrenCount > 10 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                <span className="font-bold">Large Party ({(adultsCount + childrenCount)} guests):</span> Our team will review your group size and arrange optimal seating or table joining upon confirmation.
              </div>
            )}

            {/* High Chair Question for Children */}
            {childrenCount > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-[#F5F2EA] dark:bg-[#1C1917] p-4 rounded-2xl border border-[#E8E2D2] dark:border-[#3D352E] space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#E8E2D2] dark:border-[#3D352E] pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#8B4513] dark:text-[#D2B48C] uppercase tracking-wider">
                    <Baby className="w-4 h-4 text-[#E37A08]" />
                    <span>High Chair Requirements</span>
                  </div>
                  <span className="text-[10px] font-semibold text-[#E37A08] bg-[#E37A08]/10 px-2 py-0.5 rounded-md border border-[#E37A08]/30">
                    High chairs don't take table seats!
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Array.from({ length: childrenCount }).map((_, idx) => (
                    <label
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] cursor-pointer hover:border-[#E37A08] transition-all shadow-xs"
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

            {/* Optional WhatsApp Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-3 p-3 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#E37A08] focus:ring-[#E37A08] border-[#E8E2D2]"
                />
                <div>
                  <span className="text-xs font-semibold text-[#2D2926] dark:text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-[#22C55E]" />
                    Send me offers and updates on WhatsApp
                  </span>
                  <span className="text-[11px] text-[#A1917B] dark:text-[#9C8D7C] block mt-0.5">
                    Optional. Receive exclusive specials and dosa festival invitations. Unchecked by default.
                  </span>
                </div>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={getDayOfWeek(bookingDate) === 2 && activeTab === 'remote'}
              className={`w-full py-4 rounded-xl font-bold text-white text-base shadow-lg transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                activeTab === 'walk-in'
                  ? 'bg-[#E37A08] hover:bg-[#C96905] shadow-[#E37A08]/20'
                  : 'bg-[#8B4513] hover:bg-[#72380E] shadow-[#8B4513]/20'
              }`}
            >
              <span>{activeTab === 'walk-in' ? 'Join Live Waitlist' : 'Confirm Table Reservation'}</span>
            </button>
          </form>
        </motion.div>
      </motion.div>
    </motion.div>
  </div>
</>
  );
};
