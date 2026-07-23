import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, CheckCircle2, AlertTriangle, Ban, Clock, X, Check, Plus, UserCheck, DoorOpen, Bath, UtensilsCrossed, Store, Baby, GitMerge } from 'lucide-react';
import { Table, Booking, LandmarkPosition } from '../../types';
import { dataService } from '../../services/dataService';
import { getRequiredTableSeats, formatPartyBreakdownShort } from '../../utils/bookingUtils';
import { parseToDate, safeGetElapsedMs } from '../../utils/dateUtils';

const getCleanMergedWith = (val: any): number | string | null => {
  if (!val) return null;
  if (typeof val === 'object') return null;
  return val;
};

interface FloorPlanProps {
  tables: Table[];
  bookings: Booking[];
  selectedWaitingBooking: Booking | null;
  onSelectWaitingBooking: (booking: Booking | null) => void;
  onTableUpdated: () => void;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  tables,
  bookings,
  selectedWaitingBooking,
  onSelectWaitingBooking,
  onTableUpdated,
}) => {
  const [overrideConfirmModal, setOverrideConfirmModal] = useState<{ table: Table; booking: Booking } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [selectedOccupiedTable, setSelectedOccupiedTable] = useState<Table | null>(null);
  const [quickSeatModal, setQuickSeatModal] = useState<Table | null>(null);
  const [quickSeatPartySize, setQuickSeatPartySize] = useState(2);
  const [quickSeatName, setQuickSeatName] = useState('');
  const [quickSeatPhone, setQuickSeatPhone] = useState('');
  const [quickSeatServer, setQuickSeatServer] = useState('');
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeFirstTableId, setMergeFirstTableId] = useState<number | null>(null);

  const getTableDefaultPosition = (id: number) => {
    switch (id) {
      case 1: return { column: 'right' as const, order: 3 };
      case 2: return { column: 'right' as const, order: 2 };
      case 3: return { column: 'right' as const, order: 1 };
      case 4: return { column: 'top' as const, order: 1 };
      case 5: return { column: 'middle' as const, order: 1, isDiamond: true };
      case 6: return { column: 'middle' as const, order: 2, isDiamond: true };
      case 7: return { column: 'middle' as const, order: 3, isDiamond: true };
      case 8: return { column: 'left' as const, order: 3 };
      case 9: return { column: 'left' as const, order: 2 };
      case 10: return { column: 'left' as const, order: 1 };
      default: return { column: 'right' as const, order: 1 };
    }
  };

  const areTablesAdjacent = (t1: Table, t2: Table): boolean => {
    const p1 = t1.position || getTableDefaultPosition(t1.id);
    const p2 = t2.position || getTableDefaultPosition(t2.id);
    if (p1 && p2 && p1.column === p2.column && Math.abs(p1.order - p2.order) === 1) {
      return true;
    }
    if (Math.abs(t1.id - t2.id) === 1) {
      return true;
    }
    return false;
  };

  const getTableBooking = (table: Table): Booking | undefined => {
    if (!table.currentBookingId) return undefined;
    return bookings.find((b) => b.id === table.currentBookingId);
  };

  const getSeatedDuration = (seatedAt?: string): string => {
    const elapsedMs = safeGetElapsedMs(seatedAt);
    if (elapsedMs === 0 && !parseToDate(seatedAt)) return '0m';
    const diffMins = Math.max(1, Math.round(elapsedMs / 60000));
    return `${diffMins}m`;
  };

  const getBestFitTable = (): Table | null => {
    if (!selectedWaitingBooking) return null;
    const requiredSeats = getRequiredTableSeats(selectedWaitingBooking);

    const candidates = tables.filter((t) => !t.isOccupied && !t.isInactive && requiredSeats <= t.maxOverrideCapacity);
    if (candidates.length === 0) return null;

    // For parties of 1-2 (required seats <= 2)
    if (requiredSeats <= 2) {
      // Prefer the 2-seaters (T5, T6, T7) but always try to leave at least ONE of them vacant
      const activeTwoSeaters = tables.filter(t => [5, 6, 7].includes(t.id));
      const occupiedCount = activeTwoSeaters.filter(t => t.isOccupied || t.isInactive).length;

      // "if two of the three are already occupied, suggest a 6-seater for the next couple instead."
      if (occupiedCount >= 2) {
        const vacantSixSeaters = candidates.filter(t => t.capacity === 6);
        if (vacantSixSeaters.length > 0) {
          vacantSixSeaters.sort((a, b) => a.id - b.id);
          return vacantSixSeaters[0];
        }
      }

      // Otherwise, suggest the preferred vacant 2-seaters
      const vacantTwoSeaters = candidates.filter(t => [5, 6, 7].includes(t.id));
      if (vacantTwoSeaters.length > 0) {
        vacantTwoSeaters.sort((a, b) => a.id - b.id);
        return vacantTwoSeaters[0];
      }
    }

    // Default: Sort by smallest capacity first, then by table id
    candidates.sort((a, b) => {
      if (a.capacity !== b.capacity) return a.capacity - b.capacity;
      return a.id - b.id;
    });

    return candidates[0];
  };

  const bestFitTable = getBestFitTable();

  const handleTableClick = async (table: Table) => {
    setErrorToast(null);

    if (mergeMode) {
      if (table.isOccupied || table.isInactive) {
        setErrorToast("Can only merge vacant, active tables.");
        return;
      }

      if (mergeFirstTableId === null) {
        setMergeFirstTableId(table.id);
      } else {
        if (mergeFirstTableId === table.id) {
          setMergeFirstTableId(null);
          return;
        }

        const firstTable = tables.find(t => t.id === mergeFirstTableId);
        if (!firstTable) return;

        if (!areTablesAdjacent(firstTable, table)) {
          setErrorToast("Tables must be adjacent to merge.");
          return;
        }

        await dataService.mergeTables(mergeFirstTableId, table.id);
        setMergeFirstTableId(null);
        setMergeMode(false);
        onTableUpdated();
      }
      return;
    }

    // If table is occupied
    if (table.isOccupied) {
      setSelectedOccupiedTable(table);
      return;
    }

    // If vacant and a waiting customer is selected for allocation
    if (selectedWaitingBooking) {
      const requiredSeats = getRequiredTableSeats(selectedWaitingBooking);
      // Check capacity
      if (requiredSeats > table.capacity) {
        // Can we override on tables 5, 6, and 7?
        if ((table.id === 5 || table.id === 6 || table.id === 7) && requiredSeats <= table.maxOverrideCapacity) {
          // Open override confirm dialog
          setOverrideConfirmModal({ table, booking: selectedWaitingBooking });
          return;
        } else {
          setErrorToast(`Party of ${selectedWaitingBooking.partySize} (${requiredSeats} required table seats) exceeds Table ${table.id} capacity (${table.capacity} max).`);
          return;
        }
      }

      // Perform allocation
      const res = await dataService.allocateTable(selectedWaitingBooking.id, table.id);
      if (res.success) {
        onSelectWaitingBooking(null);
        onTableUpdated();
      } else {
        setErrorToast(res.error || 'Allocation failed.');
      }
    } else {
      setQuickSeatModal(table);
      setQuickSeatPartySize(Math.min(2, table.capacity));
      setQuickSeatName('');
      setQuickSeatPhone('');
      setQuickSeatServer(table.assignedServer || '');
    }
  };

  const handleQuickSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSeatModal) return;
    const res = await dataService.seatWalkInDirectly(
      quickSeatModal.id,
      quickSeatPartySize,
      quickSeatName.trim() || 'Walk-In',
      quickSeatPhone.trim() || '0400 000 000'
    );
    if (res.success) {
      await dataService.assignServerToTable(quickSeatModal.id, quickSeatServer || null);
      setQuickSeatModal(null);
      onTableUpdated();
    } else {
      setErrorToast(res.error || 'Failed to seat walk-in');
    }
  };

  const confirmOverrideAllocation = async () => {
    if (!overrideConfirmModal) return;
    const { table, booking } = overrideConfirmModal;
    const res = await dataService.allocateTable(booking.id, table.id);
    if (res.success) {
      setOverrideConfirmModal(null);
      onSelectWaitingBooking(null);
      onTableUpdated();
    } else {
      setErrorToast(res.error || 'Override allocation failed.');
      setOverrideConfirmModal(null);
    }
  };

  const handleFinishParty = (tableId: number) => {
    dataService.finishSeatedParty(tableId);
    setSelectedOccupiedTable(null);
    onTableUpdated();
  };

  // Helper to render table box
  const renderTableNode = (tableId: number) => {
    let table = tables.find((t) => t.id === tableId);
    if (!table) {
      table = {
        id: tableId,
        name: `Table ${tableId}`,
        capacity: (tableId === 5 || tableId === 6 || tableId === 7) ? 2 : 6,
        maxOverrideCapacity: (tableId === 5 || tableId === 6 || tableId === 7) ? 3 : 6,
        isOccupied: false,
        isInactive: false,
        position: getTableDefaultPosition(tableId),
      };
    }

    const booking = getTableBooking(table);
    const position = table.position || getTableDefaultPosition(table.id);
    const isDiamond = position?.isDiamond || false;
    const requiredSeats = selectedWaitingBooking ? getRequiredTableSeats(selectedWaitingBooking) : 0;
    const isSelectedTarget = selectedWaitingBooking && !table.isOccupied && !table.isInactive && (
      requiredSeats <= table.capacity || 
      ((table.id === 5 || table.id === 6 || table.id === 7) && requiredSeats <= table.maxOverrideCapacity)
    );
    const isBestFit = bestFitTable?.id === table.id;
    const firstSelectedTable = mergeFirstTableId ? tables.find(t => t.id === mergeFirstTableId) : null;
    const isAdjacentToFirst = firstSelectedTable && !table.isOccupied && !table.isInactive && areTablesAdjacent(firstSelectedTable, table);
    const isFirstSelected = mergeFirstTableId === table.id;

    // Color coding: green = vacant, red = occupied, grey = inactive
    let bgStyle = 'bg-emerald-500/10 border-emerald-500 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20';
    let badgeBg = 'bg-emerald-500 text-white';
    if (table.isInactive) {
      bgStyle = 'bg-[#E8E2D2] dark:bg-[#1C1917]/80 border-[#6B5E4C] dark:border-[#3D352E] text-[#6B5E4C] dark:text-[#B8ACA0] cursor-not-allowed opacity-60';
      badgeBg = 'bg-[#6B5E4C] dark:bg-[#3D352E] text-white';
    } else if (table.isOccupied) {
      bgStyle = 'bg-rose-500/15 border-rose-500 text-rose-800 dark:text-rose-300 hover:bg-rose-500/25 shadow-sm shadow-rose-500/10';
      badgeBg = 'bg-rose-500 text-white';
    } else if (isFirstSelected) {
      bgStyle = 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 ring-4 ring-amber-500 hover:bg-amber-500/30 shadow-lg shadow-amber-500/40 animate-pulse border-2';
      badgeBg = 'bg-amber-500 text-white';
    } else if (isAdjacentToFirst) {
      bgStyle = 'bg-orange-500/20 border-orange-500 text-orange-800 dark:text-orange-300 ring-4 ring-orange-500/50 hover:bg-orange-500/30 shadow-lg shadow-orange-500/40 animate-pulse border-2';
      badgeBg = 'bg-orange-500 text-white';
    } else if (isBestFit) {
      bgStyle = 'bg-[#E37A08]/30 border-[#E37A08] text-[#8B4513] dark:text-[#D2B48C] hover:bg-[#E37A08]/40 ring-4 ring-[#E37A08] animate-pulse border-2 shadow-lg shadow-[#E37A08]/30';
      badgeBg = 'bg-[#E37A08] text-white';
    } else if (isSelectedTarget) {
      bgStyle = 'bg-[#E37A08]/15 border-[#E37A08]/70 text-[#8B4513] dark:text-[#D2B48C] hover:bg-[#E37A08]/25 ring-2 ring-[#E37A08]/30 animate-pulse';
      badgeBg = 'bg-[#E37A08] text-white';
    }

    // For diamond layout, we apply rotate transformation on outer box and inverse on inner content
    return (
      <motion.div
        key={table.id}
        whileHover={!table.isInactive ? { scale: 1.03 } : {}}
        whileTap={!table.isInactive ? { scale: 0.97 } : {}}
        onClick={() => handleTableClick(table)}
        className={`relative cursor-pointer transition-all flex items-center justify-center select-none ${
          isDiamond 
            ? 'w-24 h-24 sm:w-28 sm:h-28 my-4 mx-auto rotate-45 rounded-2xl border-2 shadow-md' 
            : table.id === 4 
            ? 'w-48 sm:w-64 h-24 rounded-2xl border-2 shadow-md mx-auto' 
            : 'w-28 sm:w-36 h-40 rounded-2xl border-2 shadow-md mx-auto'
        } ${bgStyle}`}
      >
        {isBestFit && (
          <div className={`absolute -top-3 left-1/2 -translate-x-1/2 bg-[#E37A08] text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-md whitespace-nowrap z-20 flex items-center gap-1 ${isDiamond ? '-rotate-45' : ''}`}>
            <span>★ Best Fit</span>
          </div>
        )}
        <div className={`flex flex-col items-center justify-center text-center p-2 ${isDiamond ? '-rotate-45' : ''}`}>
          {/* Table Number Badge */}
          <div className="flex flex-col items-center gap-0.5 mb-1.5">
            <div className={`text-xs font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 ${badgeBg}`}>
              <span>{table.name}</span>
            </div>
            {getCleanMergedWith(table.mergedWith) && (
              <span className="text-[9px] font-black tracking-wider uppercase bg-blue-500 text-white px-1.5 py-0.5 rounded border border-blue-600 shadow-xs mt-0.5 whitespace-nowrap">
                🔗 + Table {getCleanMergedWith(table.mergedWith)}
              </span>
            )}
            {table.assignedServer && (
              <span className="text-[9px] font-bold tracking-wider uppercase bg-white/70 dark:bg-[#1C1917]/70 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 shadow-xs mt-0.5 whitespace-nowrap">
                👤 {table.assignedServer}
              </span>
            )}
          </div>

          {/* Status / Content */}
          {table.isInactive ? (
            <div className="flex flex-col items-center">
              <Ban className="w-4 h-4 mb-0.5 text-[#6B5E4C]" />
              <span className="text-[10px] uppercase font-bold tracking-wider">INACTIVE</span>
            </div>
          ) : table.isOccupied ? (
            <div className="flex flex-col items-center">
              <span className="font-bold text-xs sm:text-sm truncate max-w-[80px] text-[#2D2926] dark:text-white">
                {booking ? `${booking.firstName}` : 'Occupied'}
              </span>
              <div className="flex flex-col items-center gap-0.5 mt-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{booking ? formatPartyBreakdownShort(booking) : ''}</span>
                </div>
                {booking && ((booking.childrenHighChairs?.filter(Boolean).length ?? booking.childSeats) > 0) && (
                  <div className="flex items-center gap-0.5 bg-rose-500/20 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-rose-500/30" title="High Chair Needed">
                    <Baby className="w-3 h-3" />
                    <span>High Chair</span>
                  </div>
                )}
                {(() => {
                  const elapsedMs = booking ? safeGetElapsedMs(booking.seatedAt) : 0;
                  const elapsedMins = Math.floor(elapsedMs / 60000);
                  const isTimeUp = elapsedMins >= 60;
                  const isAmber = elapsedMins >= 45 && elapsedMins < 60;
                  const durText = booking ? getSeatedDuration(booking.seatedAt) : '30m';

                  return (
                    <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold mt-0.5 ${
                      isTimeUp
                        ? 'bg-rose-600 text-white animate-pulse'
                        : isAmber
                        ? 'bg-amber-500 text-white'
                        : 'text-[#6B5E4C] dark:text-[#B8ACA0]'
                    }`}>
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      <span>{durText}</span>
                      {isTimeUp && <span className="uppercase text-[8px] font-black">• Time up</span>}
                    </div>
                  );
                })()}
              </div>
              <span className="text-[9px] uppercase font-bold text-rose-500 mt-1 bg-white/60 dark:bg-[#1C1917]/80 px-1.5 py-0.5 rounded border border-rose-300 dark:border-rose-800">
                Tap to Free
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                {isSelectedTarget ? (isBestFit ? 'Best Fit!' : 'Tap to Seat!') : 'Vacant'}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5 font-medium">
                <Users className="w-3 h-3" />
                <span>
                  Cap: {getCleanMergedWith(table.mergedWith) ? table.capacity + (tables.find(t => t.id === Number(getCleanMergedWith(table.mergedWith)))?.capacity || 0) : table.capacity}
                  {!getCleanMergedWith(table.mergedWith) && table.maxOverrideCapacity > table.capacity ? ' (+1)' : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#26221E] rounded-3xl p-4 sm:p-6 shadow-xl border border-[#E8E2D2] dark:border-[#3D352E] relative">
      {/* Floor Plan Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-[#E8E2D2] dark:border-[#3D352E]">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
            <span>Restaurant Floor Plan</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] border border-[#E8E2D2] dark:border-[#3D352E]">
              10 Active
            </span>
          </h2>
          <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
            {selectedWaitingBooking ? (
              <span className="text-[#E37A08] dark:text-[#D2B48C] font-semibold flex items-center gap-1 animate-pulse">
                <UserCheck className="w-4 h-4" />
                Selecting table for <strong>{selectedWaitingBooking.firstName}</strong> (Party of {selectedWaitingBooking.partySize}). Tap a blinking vacant table!
              </span>
            ) : (
              'Tap a vacant table to allocate after selecting a waiting customer, or tap an occupied table to finish.'
            )}
          </p>
        </div>

        {/* Merge and Legend Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (mergeMode) {
                setMergeFirstTableId(null);
              }
              setMergeMode(!mergeMode);
              setErrorToast(null);
            }}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border ${
              mergeMode
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20 ring-2 ring-amber-500'
                : 'bg-[#F5F2EA] dark:bg-[#1C1917] hover:bg-[#E8E2D2] dark:hover:bg-[#26221E] text-[#8B4513] dark:text-[#D2B48C] border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
            title="Toggle Merge Tables Mode"
          >
            <GitMerge className="w-3.5 h-3.5" />
            <span>{mergeMode ? 'Exit Merge Mode' : 'Merge Tables'}</span>
          </button>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-emerald-500" />
              <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Vacant</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-rose-500" />
              <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Occupied</span>
            </div>
          </div>
        </div>
      </div>

      {/* Merge Mode Guidance Banner */}
      <AnimatePresence>
        {mergeMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-800 dark:text-amber-400 font-medium flex items-center justify-between">
              <span>
                {mergeFirstTableId === null
                  ? '👉 Tap a vacant table to select it as the first table to merge.'
                  : `🔗 Table Selected. Now tap an adjacent vacant table (pulsing with orange glow) to combine them.`}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMergeFirstTableId(null);
                  setMergeMode(false);
                }}
                className="text-[10px] underline font-bold"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast if allocation fails */}
      <AnimatePresence>
        {errorToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{errorToast}</span>
            </div>
            <button onClick={() => setErrorToast(null)} className="p-1 hover:bg-amber-200/50 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Smart Table Suggestion Banner */}
      <AnimatePresence>
        {selectedWaitingBooking && bestFitTable && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -5 }}
            className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-[#E37A08]/15 via-[#8B4513]/15 to-[#E37A08]/15 dark:from-[#D2B48C]/15 dark:via-[#3D352E] dark:to-[#D2B48C]/15 border-2 border-[#E37A08] dark:border-[#D2B48C] shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E37A08] text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                T{bestFitTable.id}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#E37A08] dark:text-[#D2B48C] flex items-center gap-1">
                    <span>★ Smart Table Suggestion</span>
                  </span>
                  <span className="text-[10px] bg-[#E37A08]/20 text-[#8B4513] dark:text-[#D2B48C] px-2 py-0.5 rounded-md font-bold">
                    Best Fit ({bestFitTable.capacity} Seats)
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#2D2926] dark:text-white font-medium mt-0.5">
                  Table {bestFitTable.id} is the smallest vacant table that fits <strong>{selectedWaitingBooking.firstName}</strong> ({formatPartyBreakdownShort(selectedWaitingBooking)}).
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleTableClick(bestFitTable)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white text-xs font-bold shadow-md shadow-[#E37A08]/20 flex items-center justify-center gap-1.5 transition-all transform active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Allocate to Table {bestFitTable.id}?</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visual Grid with Landmarks */}
      {(() => {
        const renderLandmarkNode = (lm: LandmarkPosition) => {
          let icon = <DoorOpen className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C] mb-1" />;
          let subtitle = 'Main Entrance';
          if (lm.id === 'washroom') {
            icon = <Bath className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C] mb-1" />;
            subtitle = 'Restrooms';
          } else if (lm.id === 'kitchen') {
            icon = <UtensilsCrossed className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C] mb-1" />;
            subtitle = 'Staff Only';
          } else if (lm.id === 'counter') {
            icon = <Store className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C] mb-1" />;
            subtitle = 'Pay / Service';
          }

          return (
            <div key={`lm-${lm.id}`} className="w-28 sm:w-36 h-20 sm:h-24 my-2 rounded-2xl bg-[#E8E2D2]/40 dark:bg-[#1C1917]/50 border-2 border-dashed border-[#A1917B]/60 dark:border-[#6B5E4C]/60 flex flex-col items-center justify-center p-2 text-center text-[#6B5E4C] dark:text-[#B8ACA0] shadow-inner select-none mx-auto">
              {icon}
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">{lm.name}</span>
              <span className="text-[9px] font-medium opacity-75">{subtitle}</span>
            </div>
          );
        };

        const landmarks = dataService.getLandmarks();

        interface ItemWrapper {
          isTable: boolean;
          tableId?: number;
          landmark?: LandmarkPosition;
          column: 'left' | 'middle' | 'right' | 'top';
          order: number;
        }

        const allItems: ItemWrapper[] = [];

        tables.forEach(t => {
          const pos = t.position || getTableDefaultPosition(t.id);
          allItems.push({
            isTable: true,
            tableId: t.id,
            column: pos.column || 'right',
            order: pos.order || 1
          });
        });

        landmarks.forEach(lm => {
          allItems.push({
            isTable: false,
            landmark: lm,
            column: lm.position?.column || 'left',
            order: lm.position?.order || 1
          });
        });

        const topItems = allItems.filter(i => i.column === 'top').sort((a, b) => a.order - b.order);
        const leftItems = allItems.filter(i => i.column === 'left').sort((a, b) => a.order - b.order);
        const middleItems = allItems.filter(i => i.column === 'middle').sort((a, b) => a.order - b.order);
        const rightItems = allItems.filter(i => i.column === 'right').sort((a, b) => a.order - b.order);

        return (
          <div className="py-4 bg-[#FFFDF7]/60 dark:bg-[#1C1917]/40 rounded-2xl border border-[#E8E2D2]/60 dark:border-[#3D352E]/60 p-4 sm:p-8">
            {/* Top Row */}
            {topItems.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mb-6">
                {topItems.map(item => (
                  <div key={item.isTable ? `t-${item.tableId}` : `lm-${item.landmark?.id}`}>
                    {item.isTable && item.tableId ? renderTableNode(item.tableId) : item.landmark ? renderLandmarkNode(item.landmark) : null}
                  </div>
                ))}
              </div>
            )}

            {/* 3 Columns Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 items-start justify-items-center">
              {/* Left Column */}
              <div className="flex flex-col gap-4 sm:gap-6 w-full items-center">
                {leftItems.map(item => (
                  <div key={item.isTable ? `t-${item.tableId}` : `lm-${item.landmark?.id}`}>
                    {item.isTable && item.tableId ? renderTableNode(item.tableId) : item.landmark ? renderLandmarkNode(item.landmark) : null}
                  </div>
                ))}
              </div>

              {/* Middle Column */}
              <div className="flex flex-col gap-4 sm:gap-6 w-full items-center justify-center my-auto">
                {middleItems.map(item => (
                  <div key={item.isTable ? `t-${item.tableId}` : `lm-${item.landmark?.id}`}>
                    {item.isTable && item.tableId ? renderTableNode(item.tableId) : item.landmark ? renderLandmarkNode(item.landmark) : null}
                  </div>
                ))}
              </div>

              {/* Right Column */}
              <div className="flex flex-col gap-4 sm:gap-6 w-full items-center">
                {rightItems.map(item => (
                  <div key={item.isTable ? `t-${item.tableId}` : `lm-${item.landmark?.id}`}>
                    {item.isTable && item.tableId ? renderTableNode(item.tableId) : item.landmark ? renderLandmarkNode(item.landmark) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Override Confirmation Modal for Tables 5 & 6 (+1 chair) */}
      <AnimatePresence>
        {overrideConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-[#26221E] rounded-3xl p-6 shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E] text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] flex items-center justify-center mx-auto mb-4 text-[#E37A08]">
                <Plus className="w-7 h-7" />
              </div>
              <h3 className="font-serif font-bold text-lg text-[#2D2926] dark:text-white mb-2">
                Add Extra Chair Override?
              </h3>
              <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mb-6">
                <strong>{overrideConfirmModal.table.name}</strong> has a standard capacity of 2 people. 
                You are allocating a party of <strong>{overrideConfirmModal.booking.partySize}</strong> people ({overrideConfirmModal.booking.firstName} {overrideConfirmModal.booking.lastName}).
                <br /><br />
                Do you want to add 1 extra chair to seat them at this table?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setOverrideConfirmModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-[#B8ACA0] font-semibold text-xs border border-[#E8E2D2] dark:border-[#3D352E]"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmOverrideAllocation}
                  className="flex-1 py-2.5 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-semibold text-xs shadow-md shadow-[#E37A08]/20"
                >
                  Confirm (+1 Chair)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Occupied Table Action Modal (Mark Finished) */}
      <AnimatePresence>
        {selectedOccupiedTable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-[#26221E] rounded-3xl p-6 shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E]"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                    {selectedOccupiedTable.name}
                  </span>
                  <h3 className="font-serif font-bold text-lg text-[#2D2926] dark:text-white mt-1">
                    Table Seating Details
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOccupiedTable(null)}
                  className="p-1 rounded-full hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E]"
                >
                  <X className="w-5 h-5 text-[#6B5E4C]" />
                </button>
              </div>

              {(() => {
                const bk = getTableBooking(selectedOccupiedTable);
                return bk ? (
                  <div className="space-y-3 bg-[#F5F2EA] dark:bg-[#1C1917]/50 p-4 rounded-2xl mb-6 text-sm border border-[#E8E2D2]/60 dark:border-[#3D352E]/60">
                    <div className="flex justify-between">
                      <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Guest Name</span>
                      <span className="font-semibold text-[#2D2926] dark:text-white">{bk.firstName} {bk.lastName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Party Size</span>
                      <span className="font-semibold text-[#2D2926] dark:text-white">{bk.partySize} Guests ({bk.childSeats} child)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Phone</span>
                      <span className="font-mono text-[#2D2926] dark:text-white">{bk.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Seated Duration</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{getSeatedDuration(bk.seatedAt)}</span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-[#E8E2D2]/50 dark:border-[#3D352E]/50 text-left">
                      <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1.5">
                        Assigned Floor Server
                      </label>
                      <select
                        value={selectedOccupiedTable.assignedServer || ''}
                        onChange={async (e) => {
                          const val = e.target.value || null;
                          await dataService.assignServerToTable(selectedOccupiedTable.id, val);
                          setSelectedOccupiedTable({ ...selectedOccupiedTable, assignedServer: val || undefined });
                          onTableUpdated();
                        }}
                        className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-bold text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                      >
                        <option value="">-- No Server Assigned --</option>
                        {dataService.getStaffList().map((staffName) => (
                          <option key={staffName} value={staffName}>
                            👤 {staffName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#6B5E4C] mb-6">Occupied table.</p>
                );
              })()}

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedOccupiedTable(null)}
                  className="flex-1 py-3 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-[#B8ACA0] font-semibold text-xs border border-[#E8E2D2] dark:border-[#3D352E]"
                >
                  Close
                </button>
                <button
                  onClick={() => handleFinishParty(selectedOccupiedTable.id)}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Mark Finished & Free</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Seat Walk-In Modal */}
      <AnimatePresence>
        {quickSeatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white dark:bg-[#26221E] rounded-3xl p-6 shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E]"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#E37A08]/10 text-[#E37A08] uppercase">
                    Quick Seat Walk-In
                  </span>
                  <h3 className="font-serif font-bold text-lg text-[#2D2926] dark:text-white mt-1">
                    {getCleanMergedWith(quickSeatModal.mergedWith) 
                      ? `Seat party at ${quickSeatModal.name} + Table ${getCleanMergedWith(quickSeatModal.mergedWith)}`
                      : `Seat party at ${quickSeatModal.name}`}
                  </h3>
                  {getCleanMergedWith(quickSeatModal.mergedWith) && (
                    <button
                      type="button"
                      onClick={async () => {
                        await dataService.dissolveMerge(quickSeatModal.id);
                        setQuickSeatModal(null);
                        onTableUpdated();
                      }}
                      className="mt-2 py-1 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[11px] font-bold border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>⛓ Dissolve Table Merge</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setQuickSeatModal(null)}
                  className="p-1 rounded-full hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E]"
                >
                  <X className="w-5 h-5 text-[#6B5E4C]" />
                </button>
              </div>

              <form onSubmit={handleQuickSeatSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-[#8B4513] dark:text-[#D2B48C] mb-1">
                    Party Size (Required)
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setQuickSeatPartySize((prev) => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] font-bold text-lg border border-[#E8E2D2] flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="text-xl font-black font-mono text-center flex-1">
                      {quickSeatPartySize} {quickSeatPartySize === 1 ? 'Person' : 'People'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const otherMerged = getCleanMergedWith(quickSeatModal.mergedWith) ? tables.find(t => t.id === Number(getCleanMergedWith(quickSeatModal.mergedWith))) : null;
                        const maxCap = otherMerged ? quickSeatModal.capacity + otherMerged.capacity : quickSeatModal.maxOverrideCapacity;
                        setQuickSeatPartySize((prev) => Math.min(maxCap, prev + 1));
                      }}
                      className="w-10 h-10 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] font-bold text-lg border border-[#E8E2D2] flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                    Guest Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Walk-In / John"
                    value={quickSeatName}
                    onChange={(e) => setQuickSeatName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs text-[#2D2926] dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="0400 000 000"
                    value={quickSeatPhone}
                    onChange={(e) => setQuickSeatPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs text-[#2D2926] dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                    Assign Floor Server
                  </label>
                  <select
                    value={quickSeatServer}
                    onChange={(e) => setQuickSeatServer(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-bold text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                  >
                    <option value="">-- No Server Assigned --</option>
                    {dataService.getStaffList().map((staffName) => (
                      <option key={staffName} value={staffName}>
                        👤 {staffName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setQuickSeatModal(null)}
                      className="flex-1 py-3 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-[#B8ACA0] font-semibold text-xs border border-[#E8E2D2] dark:border-[#3D352E]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-md shadow-[#E37A08]/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Seat Party Here</span>
                    </button>
                  </div>
                  {quickSeatServer !== (quickSeatModal.assignedServer || '') && (
                    <button
                      type="button"
                      onClick={async () => {
                        await dataService.assignServerToTable(quickSeatModal.id, quickSeatServer || null);
                        setQuickSeatModal(null);
                        onTableUpdated();
                      }}
                      className="w-full py-2.5 rounded-xl border border-dashed border-[#E37A08]/50 bg-[#E37A08]/5 hover:bg-[#E37A08]/10 text-[#E37A08] font-bold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Assign 👤 {quickSeatServer || 'None'} (No Seating)</span>
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
