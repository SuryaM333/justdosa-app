import React from 'react';
import { Calendar, Clock, Users, Baby, Phone, CheckCircle, XCircle, Sparkles, AlertTriangle, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Booking, Customer } from '../../types';
import { dataService } from '../../services/dataService';
import { formatPartyBreakdown } from '../../utils/bookingUtils';
import { getLocalDateStr } from '../../utils/dateUtils';

interface BookedTabProps {
  bookings: Booking[];
  customers: Record<string, Customer>;
  onRefresh: () => void;
  onOpenNewBooking: () => void;
}

export const BookedTab: React.FC<BookedTabProps> = ({ bookings, customers, onRefresh, onOpenNewBooking }) => {
  const [dateFilter, setDateFilter] = React.useState<'upcoming' | 'today' | 'all'>('upcoming');
  const isOnline = dataService.isOnline();

  const getTodayStr = () => getLocalDateStr();

  const remoteBookings = React.useMemo(() => {
    const today = getTodayStr();
    return bookings
      .filter((b) => {
        if (b.type !== 'remote') return false;
        if (!['pending', 'booked', 'confirmed', 'declined', 'cancelled', 'alternative_proposed'].includes(b.status)) return false;
        
        if (dateFilter === 'today') {
          return b.bookingDate === today;
        } else if (dateFilter === 'upcoming') {
          return b.bookingDate ? b.bookingDate >= today : true;
        }
        return true;
      })
      .sort((a, b) => {
        const statusOrder: Record<string, number> = {
          pending: 1,
          alternative_proposed: 2,
          booked: 3,
          confirmed: 3,
          declined: 4,
          cancelled: 5,
        };
        const orderDiff = (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        if (orderDiff !== 0) return orderDiff;
        const dateCompare = (a.bookingDate || '').localeCompare(b.bookingDate || '');
        if (dateCompare !== 0) return dateCompare;
        return (a.bookingTime || '').localeCompare(b.bookingTime || '');
      });
  }, [bookings, dateFilter]);

  // Identify table conflicts ONLY when the SAME physical table is allocated to two active bookings for the same date & time
  const overlapSet = new Set<string>();
  const tableTimeMap: Record<string, string[]> = {};
  remoteBookings.forEach((b) => {
    if (b.status !== 'cancelled' && b.status !== 'declined' && b.tableId) {
      const key = `${b.tableId}_${b.bookingDate}_${b.bookingTime}`;
      if (!tableTimeMap[key]) tableTimeMap[key] = [];
      tableTimeMap[key].push(b.id);
    }
  });
  Object.values(tableTimeMap).forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach((id) => overlapSet.add(id));
    }
  });

  const getCustomerBadge = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const cust = customers[cleaned];
    if (!cust || cust.totalVisits === 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#F5F2EA] dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] border border-[#E8E2D2] dark:border-[#3D352E]">
          1st Visit
        </span>
      );
    }
    const currentVisitNum = cust.totalVisits + 1;
    const suffix =
      currentVisitNum % 10 === 1 && currentVisitNum % 100 !== 11
        ? 'st'
        : currentVisitNum % 10 === 2 && currentVisitNum % 100 !== 12
        ? 'nd'
        : currentVisitNum % 10 === 3 && currentVisitNum % 100 !== 13
        ? 'rd'
        : 'th';
    const isRegular = cust.totalVisits >= 5;
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#F5F2EA] dark:bg-[#26221E] text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E]">
          {currentVisitNum}{suffix} visit
        </span>
        {isRegular && (
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-[#E37A08] text-white shadow-sm">
            <Sparkles className="w-2.5 h-2.5" />
            <span>REGULAR</span>
          </span>
        )}
      </div>
    );
  };

  const handleArrived = (id: string) => {
    dataService.markBookingArrived(id);
    onRefresh();
  };

  const handleNoShow = (id: string) => {
    dataService.markBookingNoShow(id);
    onRefresh();
  };

  const handleConfirm = (id: string) => {
    dataService.confirmBooking(id);
    onRefresh();
  };

  const handleDecline = (id: string) => {
    dataService.declineBooking(id);
    onRefresh();
  };

  const openWhatsApp = (phone: string, text: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    return dateStr === getLocalDateStr();
  };

  const getDayOfWeek = (dateStr?: string) => {
    if (!dateStr) return -1;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return -1;
    const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return date.getDay();
  };

  const getAltTimeSlots = (dateStr: string) => {
    const day = getDayOfWeek(dateStr);
    if (day === 2) return []; // Closed Tuesday
    
    const slots: { value: string; label: string }[] = [];
    if (day === 0 || day === 6) {
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
        if (min === 60) { min = 0; hour += 1; }
      }
    }
    
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
      if (min === 60) { min = 0; hour += 1; }
    }
    return slots;
  };

  const [proposingAltBookingId, setProposingAltBookingId] = React.useState<string | null>(null);
  const [altDate, setAltDate] = React.useState('');
  const [altTime, setAltTime] = React.useState('18:30');
  const [altIsKalyana, setAltIsKalyana] = React.useState(false);
  const [altKalyanaSlot, setAltKalyanaSlot] = React.useState(() => dataService.getKalyanaSlots()[0]?.range || 'Slot 1: 11:00am-12:30pm');
  const [altNote, setAltNote] = React.useState('');
  const [shareProposalModal, setShareProposalModal] = React.useState<{
    id: string;
    phone: string;
    firstName: string;
    lastName: string;
    bookingDate: string;
    proposedTime: string;
    note: string;
  } | null>(null);

  const todayStr = getLocalDateStr();
  const kalyanaDates = Array.from(new Set(
    bookings
      .filter((b) => b.isKalyanaVirundhu && b.bookingDate && b.bookingDate >= todayStr)
      .map((b) => b.bookingDate)
      .filter(Boolean) as string[]
  )).sort();

  let displayDates = [...kalyanaDates];
  if (displayDates.length === 0) {
    const d = new Date();
    const day = d.getDay();
    const diff = (6 - day + 7) % 7;
    const nextSat = new Date(d.getTime() + diff * 86400000);
    displayDates.push(getLocalDateStr(nextSat));
  }

  return (
    <div className="space-y-4">
      {/* Saturday Kalyana Virundhu Slots Status Panel */}
      <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-5 shadow-xs">
        <h4 className="font-serif font-bold text-sm text-[#8B4513] dark:text-[#D2B48C] mb-3 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[#E37A08]" />
          <span>Saturday Kalyana Virundhu Slots Status (Capacity: {dataService.getKalyanaCapacity()} guests/slot)</span>
        </h4>
        <div className="space-y-4">
          {displayDates.map((date) => {
            return (
              <div key={date} className="p-3 bg-[#F5F2EA] dark:bg-[#1C1917] rounded-xl border border-[#E8E2D2] dark:border-[#3D352E]">
                <div className="text-xs font-bold text-[#8B4513] dark:text-[#D2B48C] mb-2 flex justify-between">
                  <span>Saturday Feast Date: {date}</span>
                  {kalyanaDates.includes(date) ? (
                    <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">Has Bookings</span>
                  ) : (
                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">No Bookings Yet</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {dataService.getKalyanaSlots().map((slotObj) => {
                    const slot = slotObj.range;
                    const guests = bookings
                      .filter((b) => b.bookingDate === date && b.isKalyanaVirundhu && b.kalyanaSlot === slot && ['pending', 'confirmed', 'booked'].includes(b.status))
                      .reduce((sum, b) => sum + (b.partySize || 0), 0);
                    const capacity = slotObj.capacity;
                    const percent = Math.min(100, Math.round((guests / capacity) * 100));
                    return (
                      <div key={slot} className="bg-white dark:bg-[#26221E] p-2.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] text-xs">
                        <div className="font-bold text-[#2D2926] dark:text-white truncate">{slot}</div>
                        <div className="flex justify-between items-center mt-1.5">
                          <span className="text-[11px] text-[#6B5E4C] dark:text-[#B8ACA0]">Booked: {guests} / {capacity}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${percent >= 100 ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                            {percent >= 100 ? 'FULL' : `${percent}%`}
                          </span>
                        </div>
                        <div className="w-full bg-[#F5F2EA] dark:bg-[#1C1917] h-1.5 rounded-full mt-2 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${percent >= 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-[#F5F2EA]/60 dark:bg-[#1C1917]/40 p-4 rounded-2xl border border-[#E8E2D2] dark:border-[#3D352E] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white flex items-center gap-2">
            <span>Remote Reservations Workflow</span>
            <span className="px-2 py-0.5 rounded-full bg-[#E37A08] text-white text-xs font-black">
              {remoteBookings.length} Scheduled
            </span>
          </h3>
          <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
            Grouped by status (<strong>PENDING</strong> review first). Review requests, confirm, decline, or propose alternative times.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-2">
            <label htmlFor="booked-date-filter" className="text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] whitespace-nowrap">
              Date Filter:
            </label>
            <select
              id="booked-date-filter"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as 'upcoming' | 'today' | 'all')}
              className="px-3 py-1.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-bold text-[#2D2926] dark:text-white focus:outline-hidden focus:ring-1 focus:ring-[#E37A08] cursor-pointer shadow-xs"
            >
              <option value="upcoming">Upcoming & Today (Default)</option>
              <option value="today">Today Only</option>
              <option value="all">All Dates</option>
            </select>
          </div>

          <button
            onClick={onOpenNewBooking}
            className="px-4 py-2 bg-[#E37A08] text-white hover:bg-[#c96906] rounded-xl text-xs font-black shadow-md shadow-[#E37A08]/15 hover:shadow-[#E37A08]/25 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <span>+ New Booking</span>
          </button>
        </div>
      </div>

      {remoteBookings.length === 0 ? (
        <div className="bg-white dark:bg-[#26221E] rounded-3xl p-12 text-center border border-[#E8E2D2] dark:border-[#3D352E]">
          <div className="w-16 h-16 bg-[#F5F2EA] dark:bg-[#1C1917] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#6B5E4C]">
            <Calendar className="w-8 h-8" />
          </div>
          <h4 className="font-serif font-bold text-base text-[#2D2926] dark:text-white mb-1">
            No remote reservations scheduled
          </h4>
          <p className="text-xs text-[#6B5E4C] max-w-sm mx-auto">
            Bookings made through the "Book a table for later" option will be listed here sorted by status and date.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {remoteBookings.map((booking) => {
            const todayBooking = isToday(booking.bookingDate);
            const isOverlap = overlapSet.has(booking.id);
            const isPending = booking.status === 'pending';
            const isConfirmed = booking.status === 'confirmed' || booking.status === 'booked';
            const isDeclined = booking.status === 'declined';
            const isCancelled = booking.status === 'cancelled';
            const isAltProposed = booking.status === 'alternative_proposed';

            // Construct precise WhatsApp message depending on whether an alternative was proposed
            let whatsappText = `Hi ${booking.firstName}, regarding your reservation at Just Dosa Melbourne for ${booking.bookingDate} at ${booking.bookingTime}...`;
            if (isAltProposed) {
              const altTimeStr = booking.isKalyanaVirundhu ? booking.kalyanaSlot : `${booking.alternativeTime} on ${booking.alternativeDate}`;
              whatsappText = `Hi ${booking.firstName}, regarding your reservation at Just Dosa Melbourne: that time isn't available. We can offer ${altTimeStr} instead. Please check your live booking link to Accept or Decline!`;
            }

            return (
              <div
                key={booking.id}
                className={`bg-white dark:bg-[#26221E] rounded-2xl p-4 sm:p-5 border-2 transition-all flex flex-col justify-between gap-4 shadow-sm ${
                  isOverlap
                    ? 'border-rose-500 bg-rose-500/5 dark:bg-rose-500/10'
                    : isPending
                    ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/10'
                    : isAltProposed
                    ? 'border-amber-400 bg-amber-400/5 dark:bg-amber-400/10'
                    : todayBooking
                    ? 'border-[#E37A08] bg-[#F5F2EA]/80 dark:bg-[#1C1917]/60'
                    : 'border-[#E8E2D2] dark:border-[#3D352E]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center text-center font-bold shrink-0 ${
                      isPending
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                        : todayBooking
                        ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/20'
                        : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-[#B8ACA0] border border-[#E8E2D2] dark:border-[#3D352E]'
                    }`}>
                      <span className="text-[10px] uppercase font-bold leading-none mb-0.5">
                        {todayBooking ? 'TODAY' : booking.bookingDate?.split('-')[2] || 'Day'}
                      </span>
                      <span className="text-sm font-mono leading-none">
                        {booking.isKalyanaVirundhu ? 'Feast' : booking.bookingTime?.split(' ')[0]}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-serif font-bold text-base text-[#2D2926] dark:text-white">
                          {booking.firstName} {booking.lastName}
                        </span>
                        {getCustomerBadge(booking.phone)}
                        {(() => {
                          const customerProfile = dataService.getCustomerByPhone(booking.phone);
                          if (customerProfile?.isVip) {
                            return (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-md shadow-amber-500/20 animate-pulse">
                                <Sparkles className="w-2.5 h-2.5" />
                                <span>★ VIP</span>
                              </span>
                            );
                          }
                          return null;
                        })()}
                        {booking.source === 'phone/staff' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-xs" title="Manual Staff Booking">
                            <Phone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span>Staff Phone Booking</span>
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isPending ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' :
                          isAltProposed ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' :
                          isConfirmed ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' :
                          isDeclined ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30' :
                          'bg-zinc-500/20 text-zinc-600 dark:text-zinc-300'
                        }`}>
                          {booking.status === 'alternative_proposed' ? 'PROPOSAL SENT' : booking.status}
                        </span>
                        {todayBooking && (
                          <span className="px-2 py-0.5 rounded-full bg-[#F5F2EA] dark:bg-[#1C1917] text-[#E37A08] border border-[#E8E2D2] dark:border-[#3D352E] text-[10px] font-bold">
                            Today's Booking
                          </span>
                        )}
                        {isOverlap && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse shadow-sm">
                            <AlertTriangle className="w-3 h-3" />
                            <span>SAME TABLE CONFLICT</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                        <div className="flex items-center gap-1 font-semibold text-[#2D2926] dark:text-zinc-200">
                          <Calendar className="w-3.5 h-3.5 text-[#E37A08]" />
                          <span>{booking.bookingDate} at <strong>{booking.bookingTime}</strong></span>
                        </div>
                        <div className="flex items-center gap-1 font-semibold text-[#2D2926] dark:text-zinc-300">
                          <Users className="w-3.5 h-3.5 text-[#E37A08]" />
                          <span>{formatPartyBreakdown(booking)}</span>
                          {((booking.childrenHighChairs?.filter(Boolean).length ?? booking.childSeats) > 0) && (
                            <span className="inline-flex items-center gap-0.5 bg-[#E37A08]/10 text-[#E37A08] dark:text-[#D2B48C] px-1.5 py-0.5 rounded text-xs font-bold ml-1 border border-[#E37A08]/30" title="High Chair Needed">
                              <Baby className="w-3.5 h-3.5" />
                              <span>High Chair</span>
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 font-mono">
                          <Phone className="w-3.5 h-3.5 text-[#6B5E4C]" />
                          <span>{booking.phone}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {booking.isKalyanaVirundhu ? (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                            <Sparkles className="w-3 h-3" />
                            <span>Kalyana Virundhu Feast ({booking.kalyanaSlot || 'Saturday Lunch'})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded text-[10px] font-bold">
                            Regular Menu
                          </span>
                        )}

                        {isAltProposed && (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-semibold">
                            Proposed: {booking.isKalyanaVirundhu ? booking.kalyanaSlot : `${booking.alternativeTime} on ${booking.alternativeDate}`}
                          </span>
                        )}
                      </div>

                      {booking.changeRequestedNote && (
                        <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between">
                          <div>
                            <strong className="font-bold">Change Requested:</strong>
                            <span className="italic ml-1">"{booking.changeRequestedNote}"</span>
                          </div>
                        </div>
                      )}

                      {(booking.allergies || booking.notes) && (
                        <div className="mt-2 space-y-1 bg-amber-500/5 dark:bg-amber-500/0 p-2.5 rounded-xl border border-dashed border-amber-500/20">
                          {booking.allergies && (
                            <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                              ⚠️ <strong className="font-bold">Allergies/Pref:</strong> {booking.allergies}
                            </div>
                          )}
                          {booking.notes && (
                            <div className="text-[11px] font-semibold text-[#6B5E4C] dark:text-[#B8ACA0]">
                              📝 <strong className="font-bold">Notes:</strong> {booking.notes}
                            </div>
                          )}
                        </div>
                      )}

                      {(() => {
                        const customerProfile = dataService.getCustomerByPhone(booking.phone);
                        if (customerProfile && (customerProfile.isVip || customerProfile.allergies || customerProfile.notes)) {
                          return (
                            <div className="mt-2 space-y-1 bg-amber-500/5 dark:bg-[#26221E]/60 p-2.5 rounded-xl border border-[#D2B48C]/30 text-[11px]">
                              <div className="font-bold text-[#E37A08] flex items-center gap-1 mb-1">
                                <span>★</span> CRM Guest Profile:
                              </div>
                              {customerProfile.isVip && (
                                <div className="text-amber-600 dark:text-amber-400 font-bold">
                                  • Designated VIP Guest
                                </div>
                              )}
                              {customerProfile.allergies && (
                                <div className="text-rose-700 dark:text-rose-400 font-semibold">
                                  • Profile Allergy Tag: {customerProfile.allergies}
                                </div>
                              )}
                              {customerProfile.notes && (
                                <div className="text-[#6B5E4C] dark:text-[#B8ACA0] font-medium italic">
                                  • Profile Staff Note: "{customerProfile.notes}"
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E8E2D2] dark:border-[#3D352E] self-end sm:self-center">
                    {isPending && (
                      <>
                        <button
                          disabled={!isOnline}
                          onClick={() => handleConfirm(booking.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                            !isOnline
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-750'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{isOnline ? 'Confirm' : 'No connection'}</span>
                        </button>
                        <button
                          disabled={!isOnline}
                          onClick={() => {
                            setProposingAltBookingId(booking.id);
                            setAltDate(booking.bookingDate || '');
                            setAltTime(booking.bookingTime || '18:30');
                            setAltIsKalyana(booking.isKalyanaVirundhu || false);
                            setAltKalyanaSlot(booking.kalyanaSlot || dataService.getKalyanaSlots()[0]?.range || 'Slot 1: 11:00am-12:30pm');
                            setAltNote('');
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                            !isOnline
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-750'
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{isOnline ? 'Propose Alt Time' : 'No connection'}</span>
                        </button>
                        <button
                          disabled={!isOnline}
                          onClick={() => handleDecline(booking.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                            !isOnline
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-750'
                              : 'bg-rose-600 hover:bg-rose-700 text-white'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{isOnline ? 'Decline Outright' : 'No connection'}</span>
                        </button>
                      </>
                    )}

                    {isConfirmed && (
                      <>
                        <button
                          disabled={!isOnline}
                          onClick={() => handleNoShow(booking.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 border ${
                            !isOnline
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border-zinc-200 dark:border-zinc-750'
                              : 'bg-[#F5F2EA] dark:bg-[#1C1917] hover:bg-[#EF4444]/10 text-[#6B5E4C] dark:text-[#B8ACA0] hover:text-[#EF4444] border-[#E8E2D2] dark:border-[#3D352E]'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{isOnline ? 'No-Show' : 'No connection'}</span>
                        </button>

                        <button
                          disabled={!isOnline}
                          onClick={() => handleArrived(booking.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95 ${
                            !isOnline
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-750'
                              : 'bg-[#E37A08] hover:bg-[#c96906] text-white shadow-[#E37A08]/20'
                          }`}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>{isOnline ? 'Arrived → Queue' : 'No connection'}</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => openWhatsApp(booking.phone, whatsappText)}
                      className="px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#1ebd59] text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                      title="Send WhatsApp Message"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* Inline form for proposing alt time */}
                {proposingAltBookingId === booking.id && (
                  <div className="w-full mt-3 p-4 bg-[#F5F2EA] dark:bg-[#1C1917] rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] space-y-3 text-left">
                    <h4 className="font-serif font-bold text-xs text-[#8B4513] dark:text-[#D2B48C] uppercase tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Configure Alternative Option</span>
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                          Alternative Date
                        </label>
                        <input
                          type="date"
                          required
                          min={new Date().toISOString().split('T')[0]}
                          value={altDate}
                          onChange={(e) => {
                            setAltDate(e.target.value);
                            setAltIsKalyana(false);
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs text-[#2D2926] dark:text-white"
                        />
                      </div>

                      {getDayOfWeek(altDate) === 6 ? (
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                            Saturday Lunch Type
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setAltIsKalyana(true)}
                              className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold border transition-colors ${
                                altIsKalyana
                                  ? 'bg-[#8B4513] text-white border-transparent'
                                  : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] border-[#E8E2D2] dark:border-[#3D352E]'
                              }`}
                            >
                              Kalyana Feast
                            </button>
                            <button
                              type="button"
                              onClick={() => setAltIsKalyana(false)}
                              className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold border transition-colors ${
                                !altIsKalyana
                                  ? 'bg-[#8B4513] text-white border-transparent'
                                  : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] border-[#E8E2D2] dark:border-[#3D352E]'
                              }`}
                            >
                              Regular Menu
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {altIsKalyana && getDayOfWeek(altDate) === 6 ? (
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                            Kalyana Slot
                          </label>
                          <select
                            value={altKalyanaSlot}
                            onChange={(e) => setAltKalyanaSlot(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs text-[#2D2926] dark:text-white"
                          >
                            {dataService.getKalyanaSlots().map((s) => (
                              <option key={s.id} value={s.range}>{s.range}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[10px] font-bold uppercase text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                            Alternative Time
                          </label>
                          <select
                            value={altTime}
                            onChange={(e) => setAltTime(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs text-[#2D2926] dark:text-white"
                          >
                            {getAltTimeSlots(altDate).map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold uppercase text-[#6B5E4C] dark:text-[#B8ACA0]">
                        Proposal Notes (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={altNote}
                        onChange={(e) => setAltNote(e.target.value)}
                        placeholder="e.g. We can seat you at 2pm, or Sunday lunch has plenty of space"
                        className="w-full px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs text-[#2D2926] dark:text-white resize-none"
                      />
                    </div>

                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          dataService.proposeAlternativeTime(
                            booking.id,
                            altDate,
                            altTime,
                            altIsKalyana && getDayOfWeek(altDate) === 6,
                            altIsKalyana && getDayOfWeek(altDate) === 6 ? altKalyanaSlot : undefined,
                            altNote.trim() || undefined
                          );
                          const proposedTimeStr = altIsKalyana && getDayOfWeek(altDate) === 6
                            ? `${altKalyanaSlot} on ${altDate}`
                            : `${altTime} on ${altDate}`;
                          setShareProposalModal({
                            id: booking.id,
                            phone: booking.phone,
                            firstName: booking.firstName,
                            lastName: booking.lastName,
                            bookingDate: booking.bookingDate || '',
                            proposedTime: proposedTimeStr,
                            note: altNote.trim()
                          });
                          setProposingAltBookingId(null);
                          onRefresh();
                        }}
                        className="px-3 py-1.5 bg-[#E37A08] hover:bg-[#c96906] text-white rounded-lg text-xs font-bold shadow-sm"
                      >
                        Send Proposal
                      </button>
                      <button
                        type="button"
                        onClick={() => setProposingAltBookingId(null)}
                        className="px-3 py-1.5 bg-white dark:bg-[#26221E] text-[#6B5E4C] rounded-lg text-xs font-bold border border-[#E8E2D2]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Share Proposal Modal */}
      <AnimatePresence>
        {shareProposalModal && (() => {
          const proposedTimeStr = shareProposalModal.proposedTime;
          const noteText = shareProposalModal.note ? `${shareProposalModal.note.trim()} ` : '';
          const shareText = `Hi ${shareProposalModal.firstName}, about your Just Dosa booking on ${shareProposalModal.bookingDate}: that time isn't available — we can offer ${proposedTimeStr} instead. ${noteText}Check and respond here: ${window.location.origin}/?bookingId=${shareProposalModal.id}`;

          const handleWhatsAppShare = () => {
            const cleaned = shareProposalModal.phone.replace(/\D/g, '');
            const url = `https://wa.me/${cleaned}?text=${encodeURIComponent(shareText)}`;
            window.open(url, '_blank');
          };

          const handleSMSShare = () => {
            const cleaned = shareProposalModal.phone.replace(/\D/g, '');
            const url = `sms:${cleaned}?body=${encodeURIComponent(shareText)}`;
            window.open(url, '_self');
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-white dark:bg-[#26221E] rounded-3xl p-6 shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E]"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                      PROPOSAL SAVED
                    </span>
                    <h3 className="font-serif font-bold text-lg text-[#2D2926] dark:text-white mt-1">
                      Share with Customer
                    </h3>
                  </div>
                  <button
                    onClick={() => setShareProposalModal(null)}
                    className="p-1 rounded-full hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E]"
                  >
                    <X className="w-5 h-5 text-[#6B5E4C]" />
                  </button>
                </div>

                <div className="space-y-3 bg-[#F5F2EA]/60 dark:bg-[#1C1917]/50 p-4 rounded-2xl mb-6 text-xs border border-[#E8E2D2]/60 dark:border-[#3D352E]/60 text-left">
                  <span className="font-bold text-[#8B4513] dark:text-[#D2B48C] block uppercase tracking-wider text-[10px]">
                    Message Preview:
                  </span>
                  <p className="font-mono text-[#2D2926] dark:text-[#FDFBF7] break-words whitespace-pre-wrap">
                    {shareText}
                  </p>
                </div>

                <div className="flex flex-col gap-2 mb-4">
                  <button
                    onClick={handleWhatsAppShare}
                    className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebd59] text-white font-bold text-xs shadow-md shadow-[#25D366]/20 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send via WhatsApp</span>
                  </button>

                  <button
                    onClick={handleSMSShare}
                    className="w-full py-3 rounded-xl bg-[#007AFF] hover:bg-[#0062cc] text-white font-bold text-xs shadow-md shadow-[#007AFF]/20 flex items-center justify-center gap-2 transition-all transform active:scale-95"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Send via SMS</span>
                  </button>
                </div>

                <button
                  onClick={() => setShareProposalModal(null)}
                  className="w-full py-2.5 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-[#B8ACA0] font-semibold text-xs border border-[#E8E2D2] dark:border-[#3D352E] hover:bg-[#E8E2D2]/40 transition-colors"
                >
                  Done
                </button>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
