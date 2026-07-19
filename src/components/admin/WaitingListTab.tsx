import React, { useState, useEffect, useRef } from 'react';
import { Users, Baby, Phone, Clock, ArrowRight, UserCheck, Sparkles, MessageSquare, XCircle, ChevronDown, AlertTriangle } from 'lucide-react';
import { Booking, Customer, Table } from '../../types';
import { dataService } from '../../services/dataService';
import { getWhatsAppUrl } from '../../utils/phone';
import { formatPartyBreakdown, getRequiredTableSeats } from '../../utils/bookingUtils';
import { playWaitAlertSound } from '../../utils/sound';
import { parseToDate, safeGetElapsedMs, safeFormatWaited } from '../../utils/dateUtils';

interface WaitingListTabProps {
  bookings: Booking[];
  customers: Record<string, Customer>;
  tables: Table[];
  selectedWaitingBooking: Booking | null;
  onSelectWaitingBooking: (booking: Booking | null) => void;
  onRefresh: () => void;
  onOpenNewBooking: () => void;
}

export const WaitingListTab: React.FC<WaitingListTabProps> = ({
  bookings,
  customers,
  tables,
  selectedWaitingBooking,
  onSelectWaitingBooking,
  onRefresh,
  onOpenNewBooking,
}) => {
  const isOnline = dataService.isOnline();
  const [quickSeatBooking, setQuickSeatBooking] = useState<Booking | null>(null);

  // Live timer tick every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const waitingList = React.useMemo(() => {
    return bookings
      .filter((b) => b.status === 'waiting')
      .sort((a, b) => {
        const timeA = parseToDate(a.createdAt)?.getTime() || 0;
        const timeB = parseToDate(b.createdAt)?.getTime() || 0;
        return timeA - timeB;
      });
  }, [bookings]);

  // Track played sound alerts to prevent repeated audio triggers
  const playedAlertsRef = useRef<Record<string, 'warning' | 'critical'>>({});

  useEffect(() => {
    const thresholds = dataService.getWaitTimeAlertThresholds();
    waitingList.forEach((booking) => {
      const diffMins = Math.max(0, Math.round(safeGetElapsedMs(booking.createdAt) / 60000));
      const alreadyPlayed = playedAlertsRef.current[booking.id];

      if (diffMins >= thresholds.high) {
        if (alreadyPlayed !== 'critical') {
          playWaitAlertSound('critical');
          playedAlertsRef.current[booking.id] = 'critical';
        }
      } else if (diffMins >= thresholds.medium) {
        if (!alreadyPlayed) {
          playWaitAlertSound('warning');
          playedAlertsRef.current[booking.id] = 'warning';
        }
      }
    });
  }, [waitingList]);

  const getWaitedTime = (isoString: string): string => {
    return safeFormatWaited(isoString);
  };

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

  const handleCancel = (id: string, name?: string) => {
    dataService.cancelBooking(id);
    if (selectedWaitingBooking?.id === id) {
      onSelectWaitingBooking(null);
    }
    onRefresh();
  };

  const handleQuickSeatTable = async (tableId: number) => {
    if (!quickSeatBooking) return;
    const res = await dataService.allocateTable(quickSeatBooking.id, tableId);
    if (res.success) {
      setQuickSeatBooking(null);
      if (selectedWaitingBooking?.id === quickSeatBooking.id) {
        onSelectWaitingBooking(null);
      }
      onRefresh();
    } else {
      console.error(res.error);
    }
  };

  const vacantTables = tables.filter((t) => !t.isInactive && !t.isOccupied);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#F5F2EA]/60 dark:bg-[#1C1917]/40 p-4 rounded-2xl border border-[#E8E2D2] dark:border-[#3D352E]">
        <div>
          <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white flex items-center gap-2">
            <span>Live Walk-In Waiting Queue</span>
            <span className="px-2 py-0.5 rounded-full bg-[#E37A08] text-white text-xs font-black">
              {waitingList.length} Waiting
            </span>
          </h3>
          <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
            Click <strong>"Select to Seat"</strong> on any party below, then tap a vacant table on the Floor Plan above (or use Quick Seat).
          </p>
        </div>

        <button
          onClick={onOpenNewBooking}
          className="px-3.5 py-2 bg-[#E37A08] text-white hover:bg-[#c96906] rounded-xl text-xs font-black shadow-md shadow-[#E37A08]/15 hover:shadow-[#E37A08]/25 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <span>+ New Booking</span>
        </button>
      </div>

      {waitingList.length === 0 ? (
        <div className="bg-white dark:bg-[#26221E] rounded-3xl p-12 text-center border border-[#E8E2D2] dark:border-[#3D352E]">
          <div className="w-16 h-16 bg-[#F5F2EA] dark:bg-[#1C1917] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#6B5E4C]">
            <Users className="w-8 h-8" />
          </div>
          <h4 className="font-serif font-bold text-base text-[#2D2926] dark:text-white mb-1">
            No parties currently waiting
          </h4>
          <p className="text-xs text-[#6B5E4C] max-w-sm mx-auto">
            When customers join via the QR code or when remote bookings arrive, they will appear here in chronological order.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {waitingList.map((booking, index) => {
            const isSelected = selectedWaitingBooking?.id === booking.id;

            // Escalating wait time alert calculations
            const elapsedMs = safeGetElapsedMs(booking.createdAt);
            const diffMins = Math.max(0, elapsedMs / 60000);
            
            let alertStyle = '';
            let alertBadge = null;
            
            const thresholds = dataService.getWaitTimeAlertThresholds();
            if (diffMins >= thresholds.high) {
              alertStyle = 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/10 ring-1 ring-rose-500/20 animate-pulse';
              alertBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 dark:bg-rose-950 text-white dark:text-rose-300 text-[10px] font-black tracking-wider animate-[bounce_1.5s_infinite]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>CRITICAL WAIT ({thresholds.high}m+)</span>
                </span>
              );
            } else if (diffMins >= thresholds.medium) {
              alertStyle = 'border-amber-500 bg-amber-50/15 dark:bg-amber-950/5';
              alertBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-bold tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>LONG WAIT ({thresholds.medium}m+)</span>
                </span>
              );
            } else if (diffMins >= thresholds.low) {
              alertStyle = 'border-yellow-500/60 bg-yellow-50/5';
              alertBadge = (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-100 dark:bg-yellow-950/20 text-yellow-800 dark:text-yellow-400 text-[10px] font-bold border border-yellow-200 dark:border-yellow-900">
                  <span>Delayed ({thresholds.low}m+)</span>
                </span>
              );
            }

            return (
              <div
                key={booking.id}
                className={`bg-white dark:bg-[#26221E] rounded-2xl p-4 sm:p-5 border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${
                  isSelected
                    ? 'border-[#E37A08] bg-[#F5F2EA]/80 dark:bg-[#1C1917]/60 ring-2 ring-[#E37A08]/20'
                    : alertStyle || 'border-[#E8E2D2] dark:border-[#3D352E] hover:border-[#8B4513] dark:hover:border-[#D2B48C]'
                }`}
              >
                {/* Left info: Queue # and Customer details */}
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#8B4513] text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md shadow-[#8B4513]/20 font-mono">
                    #{index + 1}
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
                      {alertBadge}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                      <div className="flex items-center gap-1 font-semibold text-[#2D2926] dark:text-zinc-200">
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
                      <div className="flex items-center gap-1 text-[#8B4513] dark:text-[#D2B48C] font-medium font-mono">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Waited: <strong className="text-zinc-950 dark:text-white bg-amber-100/60 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/40 font-bold">{getWaitedTime(booking.createdAt)}</strong></span>
                      </div>
                    </div>

                    {(booking.allergies || booking.notes) && (
                      <div className="mt-2.5 space-y-1 bg-amber-500/5 dark:bg-amber-500/0 p-2.5 rounded-xl border border-dashed border-amber-500/20 max-w-lg">
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
                          <div className="mt-2 space-y-1 bg-amber-500/5 dark:bg-[#26221E]/60 p-2.5 rounded-xl border border-[#D2B48C]/30 text-[11px] max-w-lg">
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

                {/* Right actions: Seat buttons */}
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-3 sm:pt-0 border-[#E8E2D2] dark:border-[#3D352E]">

                  <div className="flex items-center gap-2">
                    {/* Quick Seat Button */}
                    <button
                      disabled={!isOnline}
                      onClick={() => setQuickSeatBooking(booking)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 border border-[#E8E2D2] dark:border-[#3D352E] ${
                        !isOnline
                          ? 'bg-zinc-100 dark:bg-zinc-850 text-zinc-400 cursor-not-allowed border-zinc-200 dark:border-zinc-800'
                          : 'bg-[#F5F2EA] dark:bg-[#1C1917] hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-[#2D2926] dark:text-[#D2B48C]'
                      }`}
                      title={isOnline ? "Quick Seat to table without floor plan" : "No connection"}
                    >
                      <span>{isOnline ? 'Quick Seat' : 'No connection'}</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Select for Floor Plan Seating */}
                    <button
                      disabled={!isOnline}
                      onClick={() => onSelectWaitingBooking(isSelected ? null : booking)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                        !isOnline
                          ? 'bg-zinc-100 dark:bg-zinc-850 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-800'
                          : isSelected
                            ? 'bg-[#8B4513] text-white shadow-[#8B4513]/30 animate-pulse'
                            : 'bg-[#E37A08] text-white hover:bg-[#c96906]'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{!isOnline ? 'No connection' : isSelected ? 'Selected (Tap Table ▲)' : 'Select to Seat'}</span>
                    </button>

                    {/* Cancel button */}
                    <button
                      onClick={() => handleCancel(booking.id, `${booking.firstName} ${booking.lastName}`)}
                      title="Remove from queue"
                      className="p-2 rounded-xl text-[#6B5E4C] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Seat Modal */}
      {quickSeatBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#26221E] rounded-3xl p-6 shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E]">
            <h3 className="font-serif font-bold text-lg text-[#2D2926] dark:text-white mb-1">
              Quick Seat: {quickSeatBooking.firstName} {quickSeatBooking.lastName}
            </h3>
            <p className="text-xs text-[#6B5E4C] mb-4">
              {formatPartyBreakdown(quickSeatBooking)}. Select a vacant table below:
            </p>

            {vacantTables.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#8B4513] dark:text-[#D2B48C] text-xs text-center font-medium my-4 border border-[#E8E2D2]">
                No tables are currently vacant! Mark a seated party as finished first.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 my-4">
                {vacantTables.map((t) => {
                  const requiredSeats = getRequiredTableSeats(quickSeatBooking);
                  const canFit = requiredSeats <= t.maxOverrideCapacity;
                  return (
                    <button
                      key={t.id}
                      disabled={!canFit || !isOnline}
                      onClick={() => handleQuickSeatTable(t.id)}
                      className={`p-3 rounded-xl border text-left flex items-center justify-between ${
                        !isOnline
                          ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 cursor-not-allowed opacity-60'
                          : !canFit
                            ? 'border-[#E8E2D2] dark:border-[#3D352E] bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] cursor-not-allowed opacity-60'
                            : 'border-emerald-300 dark:border-emerald-700/60 bg-emerald-50/50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                      }`}
                    >
                      <div>
                        <span className="font-bold block text-sm">{t.name}</span>
                        <span className="text-[10px] text-[#6B5E4C]">Cap: {t.capacity} {t.maxOverrideCapacity > t.capacity ? '(+1)' : ''}</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-emerald-600" />
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setQuickSeatBooking(null)}
              className="w-full py-3 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-[#B8ACA0] font-semibold text-xs mt-2 border border-[#E8E2D2] dark:border-[#3D352E]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
