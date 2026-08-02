import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, CheckCircle2, AlertTriangle, Ban, Clock, X, Check, Plus, UserCheck, 
  DoorOpen, Bath, UtensilsCrossed, Store, Baby, GitMerge, GripVertical, Move, 
  Edit2, Save, Grid, Maximize2, Trash2, RotateCw, Wine, CreditCard, Armchair,
  CheckCircle, Sliders, LayoutGrid
} from 'lucide-react';
import { Table, Booking, LandmarkPosition, FloorCanvasSettings } from '../../types';
import { dataService } from '../../services/dataService';
import { getRequiredTableSeats, formatPartyBreakdownShort } from '../../utils/bookingUtils';
import { parseToDate, safeGetElapsedMs } from '../../utils/dateUtils';
import {
  resolveGroupMembers,
  getGroupPrimary,
  getGroupCombinedCapacity,
  getGroupCombinedMaxCapacity,
  getGroupCombinedName,
  getGroupCombinedShortCode,
  getGroupCombinedOrderingUrl,
  isTableMerged,
  canMerge,
} from '../../utils/mergeUtils';

interface FloorPlanProps {
  tables: Table[];
  bookings: Booking[];
  selectedWaitingBooking: Booking | null;
  onSelectWaitingBooking: (booking: Booking | null) => void;
  onTableUpdated: () => void;
  adminRole?: 'staff' | 'owner';
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  tables,
  bookings,
  selectedWaitingBooking,
  onSelectWaitingBooking,
  onTableUpdated,
  adminRole = 'owner',
}) => {
  const isOwner = adminRole === 'owner';
  const canvasRef = useRef<HTMLDivElement>(null);

  
  // State
  const [overrideConfirmModal, setOverrideConfirmModal] = useState<{ table: Table; booking: Booking } | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [selectedOccupiedTable, setSelectedOccupiedTable] = useState<Table | null>(null);
  const [quickSeatModal, setQuickSeatModal] = useState<Table | null>(null);
  const [quickSeatPartySize, setQuickSeatPartySize] = useState(2);
  const [quickSeatName, setQuickSeatName] = useState('');
  const [quickSeatPhone, setQuickSeatPhone] = useState('');
  const [quickSeatServer, setQuickSeatServer] = useState('');

  // Drag-to-merge state: which table is currently being dragged, its live
  // pointer offset (px), and which other table it's currently hovering over
  // (the merge candidate, highlighted while hovering).
  const [mergeDrag, setMergeDrag] = useState<{ tableId: number; dx: number; dy: number; hoverTargetId: number | null } | null>(null);
  const tableNodeRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const activeMergeDragRef = useRef<{ tableId: number; startClientX: number; startClientY: number; dragging: boolean } | null>(null);
  // Set true the instant a merge-drag crosses the movement threshold, so the
  // native click that follows pointerup on the same element is swallowed
  // instead of being treated as a tap-to-quick-seat/allocate.
  const suppressNextClickRef = useRef(false);

  // Edit Mode & Canvas State
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<{ kind: 'table' | 'landmark'; id: number | string } | null>(null);
  const [layoutToast, setLayoutToast] = useState<string | null>(null);
  const [isAddLandmarkOpen, setIsAddLandmarkOpen] = useState(false);
  const [customLandmarkName, setCustomLandmarkName] = useState('');
  const [customLandmarkType, setCustomLandmarkType] = useState<'door' | 'washroom' | 'kitchen' | 'counter' | 'bar' | 'pos' | 'waiting' | 'custom'>('bar');

  // Canvas settings
  const [canvasSettings, setCanvasSettings] = useState<FloorCanvasSettings>(() => {
    const s = dataService.getSettings();
    return s?.floorCanvasSettings || {
      aspectRatio: '16:9',
      widthMeters: 14,
      heightMeters: 9,
      gridSnapEnabled: true,
      gridSizePercent: 2.5
    };
  });

  // Active interaction refs for smooth 60fps canvas dragging & resizing
  const activeDragRef = useRef<{
    kind: 'table' | 'landmark';
    id: number | string;
    startMouseX: number;
    startMouseY: number;
    startNodeX: number;
    startNodeY: number;
    nodeWidth: number;
    nodeHeight: number;
  } | null>(null);

  const activeResizeRef = useRef<{
    kind: 'table' | 'landmark';
    id: number | string;
    startMouseX: number;
    startMouseY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Fallback coordinate normalizer for tables
  const getTableCoords = (table: Table) => {
    let x = table.x;
    let y = table.y;
    let width = table.width || 18;
    let height = table.height || 18;
    let shape = table.shape || (table.position?.isDiamond || [5, 6, 7].includes(table.id) ? 'diamond' : 'rectangle');

    if (x === undefined || y === undefined) {
      if (table.position?.column === 'top') {
        x = 40; y = 6; width = 22; height = 16;
      } else if (table.position?.column === 'left') {
        x = 6;
        y = table.position.order === 1 ? 10 : table.position.order === 2 ? 35 : 60;
      } else if (table.position?.column === 'middle') {
        x = 43;
        y = table.position.order === 1 ? 28 : table.position.order === 2 ? 46 : 64;
        width = 15; height = 15; shape = 'diamond';
      } else if (table.position?.column === 'right') {
        x = 76;
        y = table.position.order === 1 ? 10 : table.position.order === 2 ? 35 : 60;
      } else {
        x = 10 + (table.id % 4) * 20;
        y = 10 + Math.floor(table.id / 4) * 20;
      }
    }
    return { x: Math.max(0, Math.min(x, 100 - width)), y: Math.max(0, Math.min(y, 100 - height)), width, height, shape };
  };

  // Fallback coordinate normalizer for landmarks
  const getLandmarkCoords = (lm: LandmarkPosition) => {
    let x = lm.x;
    let y = lm.y;
    let width = lm.width || 18;
    let height = lm.height || 10;
    let type = lm.type || (lm.id as any) || 'custom';

    if (x === undefined || y === undefined) {
      if (lm.id === 'door') { x = 5; y = 85; width = 18; height = 10; }
      else if (lm.id === 'washroom') { x = 28; y = 85; width = 18; height = 10; }
      else if (lm.id === 'kitchen') { x = 52; y = 85; width = 20; height = 10; }
      else if (lm.id === 'counter') { x = 76; y = 85; width = 20; height = 10; }
      else { x = 15; y = 85; width = 18; height = 10; }
    }
    return { x: Math.max(0, Math.min(x, 100 - width)), y: Math.max(0, Math.min(y, 100 - height)), width, height, type };
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

  // Only a group's primary (lowest id) ever renders its own card — other
  // members are folded into that one combined card while merged.
  const primaries = tables.filter((t) => getGroupPrimary(resolveGroupMembers(t, tables)).id === t.id);

  const getBestFitTable = (): Table | null => {
    if (!selectedWaitingBooking) return null;
    const requiredSeats = getRequiredTableSeats(selectedWaitingBooking);

    const candidates = primaries.filter((t) => {
      if (t.isOccupied || t.isInactive) return false;
      const group = resolveGroupMembers(t, tables);
      return requiredSeats <= getGroupCombinedMaxCapacity(group);
    });
    if (candidates.length === 0) return null;

    if (requiredSeats <= 2) {
      const activeTwoSeaters = primaries.filter(t => [5, 6, 7].includes(t.id));
      const occupiedCount = activeTwoSeaters.filter(t => t.isOccupied || t.isInactive).length;

      if (occupiedCount >= 2) {
        const vacantSixSeaters = candidates.filter(t => t.capacity === 6);
        if (vacantSixSeaters.length > 0) {
          vacantSixSeaters.sort((a, b) => a.id - b.id);
          return vacantSixSeaters[0];
        }
      }

      const vacantTwoSeaters = candidates.filter(t => [5, 6, 7].includes(t.id));
      if (vacantTwoSeaters.length > 0) {
        vacantTwoSeaters.sort((a, b) => a.id - b.id);
        return vacantTwoSeaters[0];
      }
    }

    candidates.sort((a, b) => {
      const capA = getGroupCombinedCapacity(resolveGroupMembers(a, tables));
      const capB = getGroupCombinedCapacity(resolveGroupMembers(b, tables));
      if (capA !== capB) return capA - capB;
      return a.id - b.id;
    });

    return candidates[0];
  };

  const bestFitTable = getBestFitTable();

  // Handle table seating/allocation click in operational view (merging is
  // now a drag gesture, handled separately by handleTableMergeDragStart /
  // handlePointerMoveCanvas / handlePointerUpCanvas below).
  const handleTableClick = async (table: Table) => {
    if (isEditMode) return;
    if (suppressNextClickRef.current) {
      // A real merge-drag just ended on this element — the trailing native
      // click is not a tap, swallow it.
      suppressNextClickRef.current = false;
      return;
    }
    setErrorToast(null);

    if (table.isOccupied) {
      setSelectedOccupiedTable(table);
      return;
    }

    const group = resolveGroupMembers(table, tables);

    if (selectedWaitingBooking) {
      const requiredSeats = getRequiredTableSeats(selectedWaitingBooking);
      const baseCap = getGroupCombinedCapacity(group);
      const maxCap = getGroupCombinedMaxCapacity(group);
      if (requiredSeats > baseCap) {
        if (requiredSeats <= maxCap) {
          setOverrideConfirmModal({ table, booking: selectedWaitingBooking });
          return;
        } else {
          setErrorToast(`Party of ${selectedWaitingBooking.partySize} (${requiredSeats} required table seats) exceeds ${getGroupCombinedName(group)} capacity (${baseCap} max).`);
          return;
        }
      }

      const res = await dataService.allocateTable(selectedWaitingBooking.id, table.id);
      if (res.success) {
        onSelectWaitingBooking(null);
        onTableUpdated();
      } else {
        setErrorToast(res.error || 'Allocation failed.');
      }
    } else {
      setQuickSeatModal(table);
      setQuickSeatPartySize(Math.min(2, getGroupCombinedCapacity(group)));
      setQuickSeatName('');
      setQuickSeatPhone('');
      setQuickSeatServer(table.assignedServer || '');
    }
  };

  // Starts a candidate merge-drag on pointerdown; whether it becomes a real
  // drag (vs. a stationary tap) is decided in handlePointerMoveCanvas once
  // the pointer crosses the movement threshold.
  const handleTableMergeDragStart = (e: React.PointerEvent, table: Table) => {
    if (isEditMode || table.isOccupied || table.isInactive || selectedWaitingBooking) return;
    activeMergeDragRef.current = {
      tableId: table.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      dragging: false,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleQuickSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSeatModal) return;

    const res = await dataService.addQuickWalkinAndSeat({
      tableId: quickSeatModal.id,
      partySize: quickSeatPartySize,
      name: quickSeatName,
      phone: quickSeatPhone,
      serverName: quickSeatServer,
    });

    if (res.success) {
      setQuickSeatModal(null);
      onTableUpdated();
    } else {
      setErrorToast(res.error || 'Quick seat failed.');
    }
  };

  // Canvas Drag & Resize Pointer Events
  const handlePointerDownDrag = (
    e: React.PointerEvent,
    kind: 'table' | 'landmark',
    id: number | string,
    currentX: number,
    currentY: number,
    width: number,
    height: number
  ) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setSelectedNode({ kind, id });

    activeDragRef.current = {
      kind,
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: currentX,
      startNodeY: currentY,
      nodeWidth: width,
      nodeHeight: height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerDownResize = (
    e: React.PointerEvent,
    kind: 'table' | 'landmark',
    id: number | string,
    currentWidth: number,
    currentHeight: number
  ) => {
    if (!isEditMode) return;
    e.stopPropagation();
    setSelectedNode({ kind, id });

    activeResizeRef.current = {
      kind,
      id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startWidth: currentWidth,
      startHeight: currentHeight,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMoveCanvas = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;

    // Merge-drag lives entirely outside edit mode, and uses live client-pixel
    // hit-testing against other tables' rects rather than the canvas's own
    // percentage math (which the edit-mode drag/resize below relies on).
    if (!isEditMode) {
      const drag = activeMergeDragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startClientX;
      const dy = e.clientY - drag.startClientY;
      if (!drag.dragging && Math.hypot(dx, dy) < 8) return;
      drag.dragging = true;
      suppressNextClickRef.current = true;

      let hoverTargetId: number | null = null;
      for (const other of tables) {
        if (other.id === drag.tableId || other.isOccupied || other.isInactive) continue;
        const rect = tableNodeRefs.current[other.id]?.getBoundingClientRect();
        if (rect && e.clientX >= rect.left - 12 && e.clientX <= rect.right + 12 && e.clientY >= rect.top - 12 && e.clientY <= rect.bottom + 12) {
          hoverTargetId = other.id;
          break;
        }
      }
      setMergeDrag({ tableId: drag.tableId, dx, dy, hoverTargetId });
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    if (!canvasRect.width || !canvasRect.height) return;

    const snapStep = canvasSettings.gridSnapEnabled ? (canvasSettings.gridSizePercent || 2.5) : 0.5;

    // Handle Active Drag
    if (activeDragRef.current) {
      const drag = activeDragRef.current;
      const dxPercent = ((e.clientX - drag.startMouseX) / canvasRect.width) * 100;
      const dyPercent = ((e.clientY - drag.startMouseY) / canvasRect.height) * 100;

      let rawX = drag.startNodeX + dxPercent;
      let rawY = drag.startNodeY + dyPercent;

      let clampedX = Math.max(0, Math.min(rawX, 100 - drag.nodeWidth));
      let clampedY = Math.max(0, Math.min(rawY, 100 - drag.nodeHeight));

      let snappedX = Math.round(clampedX / snapStep) * snapStep;
      let snappedY = Math.round(clampedY / snapStep) * snapStep;

      if (drag.kind === 'table') {
        const tId = Number(drag.id);
        const currentTables = dataService.getTables();
        const updated = currentTables.map(t => {
          if (t.id === tId) {
            return { ...t, x: snappedX, y: snappedY };
          }
          return t;
        });
        dataService.saveTables(updated).catch(() => {});
        onTableUpdated();
      } else {
        const lmId = String(drag.id);
        const currentLandmarks = dataService.getLandmarks();
        const updated = currentLandmarks.map(lm => {
          if (lm.id === lmId) {
            return { ...lm, x: snappedX, y: snappedY };
          }
          return lm;
        });
        dataService.setLandmarks(updated).catch(() => {});
        onTableUpdated();
      }
    }

    // Handle Active Resize
    if (activeResizeRef.current) {
      const resize = activeResizeRef.current;
      const dxPercent = ((e.clientX - resize.startMouseX) / canvasRect.width) * 100;
      const dyPercent = ((e.clientY - resize.startMouseY) / canvasRect.height) * 100;

      let rawW = resize.startWidth + dxPercent;
      let rawH = resize.startHeight + dyPercent;

      let clampedW = Math.max(8, Math.min(rawW, 45));
      let clampedH = Math.max(8, Math.min(rawH, 45));

      let snappedW = Math.round(clampedW / snapStep) * snapStep;
      let snappedH = Math.round(clampedH / snapStep) * snapStep;

      if (resize.kind === 'table') {
        const tId = Number(resize.id);
        const currentTables = dataService.getTables();
        const updated = currentTables.map(t => {
          if (t.id === tId) {
            return { ...t, width: snappedW, height: snappedH };
          }
          return t;
        });
        dataService.saveTables(updated).catch(() => {});
        onTableUpdated();
      } else {
        const lmId = String(resize.id);
        const currentLandmarks = dataService.getLandmarks();
        const updated = currentLandmarks.map(lm => {
          if (lm.id === lmId) {
            return { ...lm, width: snappedW, height: snappedH };
          }
          return lm;
        });
        dataService.setLandmarks(updated).catch(() => {});
        onTableUpdated();
      }
    }
  };

  const handlePointerUpCanvas = () => {
    if (activeDragRef.current || activeResizeRef.current) {
      activeDragRef.current = null;
      activeResizeRef.current = null;
      setLayoutToast('Floor plan layout saved ✓');
      setTimeout(() => setLayoutToast(null), 2000);
      return;
    }

    if (activeMergeDragRef.current) {
      const { tableId: draggedId } = activeMergeDragRef.current;
      const hoverTargetId = mergeDrag?.hoverTargetId ?? null;
      activeMergeDragRef.current = null;
      setMergeDrag(null);

      if (hoverTargetId !== null) {
        const draggedTable = tables.find((t) => t.id === draggedId);
        const targetTable = tables.find((t) => t.id === hoverTargetId);
        if (draggedTable && targetTable) {
          const check = canMerge(draggedTable, targetTable, tables);
          if (!check.ok) {
            setErrorToast(check.reason || 'Cannot merge these tables.');
          } else {
            const groupA = resolveGroupMembers(draggedTable, tables);
            const groupB = resolveGroupMembers(targetTable, tables);
            const allIds = Array.from(new Set([...groupA.map((t) => t.id), ...groupB.map((t) => t.id)]));
            dataService.mergeTables(allIds).then((res) => {
              if (res.success) {
                onTableUpdated();
              } else {
                setErrorToast(res.error || 'Merge failed.');
              }
            });
          }
        }
      }
    }
  };

  // Add custom landmark
  const handleAddLandmark = async () => {
    const name = customLandmarkName.trim() || 'Custom Landmark';
    const newLm: LandmarkPosition = {
      id: `lm_${Date.now()}`,
      name,
      type: customLandmarkType,
      x: 40,
      y: 40,
      width: 18,
      height: 10,
    };
    const current = dataService.getLandmarks();
    await dataService.setLandmarks([...current, newLm]);
    setCustomLandmarkName('');
    setIsAddLandmarkOpen(false);
    setLayoutToast(`Added ${name}`);
    setTimeout(() => setLayoutToast(null), 2000);
    onTableUpdated();
  };

  // Delete custom landmark
  const handleDeleteLandmark = async (id: string) => {
    const current = dataService.getLandmarks();
    const updated = current.filter(lm => lm.id !== id);
    await dataService.setLandmarks(updated);
    setSelectedNode(null);
    setLayoutToast('Landmark removed ✓');
    setTimeout(() => setLayoutToast(null), 2000);
    onTableUpdated();
  };

  // Save Canvas Settings
  const updateCanvasSettings = async (updates: Partial<FloorCanvasSettings>) => {
    const next = { ...canvasSettings, ...updates };
    setCanvasSettings(next);
    await dataService.updateSettings({ floorCanvasSettings: next });
    setLayoutToast('Floor dimensions saved ✓');
    setTimeout(() => setLayoutToast(null), 2000);
  };

  const landmarks = dataService.getLandmarks();

  // Aspect ratio Tailwind mapping
  const getAspectRatioClass = () => {
    switch (canvasSettings.aspectRatio) {
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-[1/1]';
      case '2:1': return 'aspect-[2/1]';
      case '16:9': default: return 'aspect-[16/9]';
    }
  };

  return (
    <div className="bg-white dark:bg-[#26221E] rounded-3xl p-4 sm:p-6 shadow-xl border border-[#E8E2D2] dark:border-[#3D352E] relative select-none">
      {/* Floor Plan Header & Mode Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-4 border-b border-[#E8E2D2] dark:border-[#3D352E]">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
            <span>Restaurant Free-Canvas Floor Plan</span>
            <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] border border-[#E8E2D2] dark:border-[#3D352E]">
              {tables.filter(t => !t.isInactive).length} Active Tables
            </span>
            {layoutToast && (
              <span className="text-xs font-bold px-3 py-0.5 rounded-full bg-emerald-500 text-white animate-fade-in shadow-xs flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {layoutToast}
              </span>
            )}
          </h2>
          <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
            {isEditMode ? (
              <span className="text-[#E37A08] font-bold">
                ✏️ EDIT MODE: Drag tables or landmarks anywhere on the floor. Corner handle resizes real dimensions!
              </span>
            ) : selectedWaitingBooking ? (
              <span className="text-[#E37A08] font-semibold flex items-center gap-1 animate-pulse">
                <UserCheck className="w-4 h-4" />
                Selecting table for <strong>{selectedWaitingBooking.firstName}</strong> (Party of {selectedWaitingBooking.partySize}). Tap a vacant table!
              </span>
            ) : (
              'Tap a vacant table to allocate or quick-seat, drag one vacant table onto another to merge them, or tap an occupied table to finish or view notes.'
            )}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border ${
                isEditMode
                  ? 'bg-[#E37A08] hover:bg-[#c96906] text-white border-transparent ring-2 ring-[#E37A08]/50 shadow-md'
                  : 'bg-[#F5F2EA] dark:bg-[#1C1917] hover:bg-[#E8E2D2] dark:hover:bg-[#26221E] text-[#8B4513] dark:text-[#D2B48C] border-[#E8E2D2] dark:border-[#3D352E]'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'Done Editing' : '✏️ Edit Floor Plan'}</span>
            </button>
          )}

          {/* Operational Legend */}
          {!isEditMode && (
            <div className="hidden sm:flex items-center gap-3 text-xs font-medium pl-2 border-l border-[#E8E2D2] dark:border-[#3D352E]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-md bg-emerald-500" />
                <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Vacant</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-md bg-[#E37A08]" />
                <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Occupied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-md bg-amber-400 border border-amber-500 ring-2 ring-amber-400/40" />
                <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">Best Fit</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODE CANVAS CONTROLS BAR */}
      {isEditMode && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Aspect Ratio Selector */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#6B5E4C] dark:text-[#B8ACA0] flex items-center gap-1">
                <LayoutGrid className="w-3.5 h-3.5" /> Room Shape:
              </span>
              <select
                value={canvasSettings.aspectRatio}
                onChange={(e) => updateCanvasSettings({ aspectRatio: e.target.value as any })}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] font-bold text-[#2D2926] dark:text-white"
              >
                <option value="16:9">16:9 Wide Room</option>
                <option value="4:3">4:3 Standard</option>
                <option value="1:1">1:1 Square Room</option>
                <option value="2:1">2:1 Deep Hall</option>
              </select>
            </div>

            {/* Room Dimensions (Meters) */}
            <div className="flex items-center gap-2 border-l border-[#E8E2D2] dark:border-[#3D352E] pl-3">
              <span className="font-bold text-[#6B5E4C] dark:text-[#B8ACA0]">Room Size:</span>
              <input
                type="number"
                min={5}
                max={50}
                value={canvasSettings.widthMeters}
                onChange={(e) => updateCanvasSettings({ widthMeters: Number(e.target.value) || 10 })}
                className="w-12 px-1.5 py-1 rounded-lg bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] text-center font-bold text-[#2D2926] dark:text-white"
                title="Width in meters"
              />
              <span className="text-[#6B5E4C]">m ×</span>
              <input
                type="number"
                min={5}
                max={50}
                value={canvasSettings.heightMeters}
                onChange={(e) => updateCanvasSettings({ heightMeters: Number(e.target.value) || 8 })}
                className="w-12 px-1.5 py-1 rounded-lg bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] text-center font-bold text-[#2D2926] dark:text-white"
                title="Length in meters"
              />
              <span className="text-[#6B5E4C]">m</span>
            </div>

            {/* Grid Snap Toggle */}
            <div className="flex items-center gap-2 border-l border-[#E8E2D2] dark:border-[#3D352E] pl-3">
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-[#6B5E4C] dark:text-[#B8ACA0]">
                <input
                  type="checkbox"
                  checked={canvasSettings.gridSnapEnabled}
                  onChange={(e) => updateCanvasSettings({ gridSnapEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-[#E37A08] focus:ring-[#E37A08]"
                />
                <Grid className="w-3.5 h-3.5 text-[#E37A08]" /> Snap to Grid
              </label>
            </div>
          </div>

          {/* Add Landmark Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddLandmarkOpen(!isAddLandmarkOpen)}
              className="px-3 py-1.5 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Landmark / Feature
            </button>
          </div>
        </motion.div>
      )}

      {/* Add Landmark Modal / Popover */}
      {isAddLandmarkOpen && isEditMode && (
        <div className="mb-4 p-4 rounded-2xl bg-[#FDFBF7] dark:bg-[#1C1917] border-2 border-[#E37A08] shadow-lg flex flex-wrap items-center gap-3">
          <span className="font-bold text-xs text-[#8B4513] dark:text-[#D2B48C]">New Floor Feature:</span>
          <input
            type="text"
            placeholder="Name e.g. VIP Lounge, Espresso Bar..."
            value={customLandmarkName}
            onChange={(e) => setCustomLandmarkName(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-semibold text-[#2D2926] dark:text-white"
          />
          <select
            value={customLandmarkType}
            onChange={(e) => setCustomLandmarkType(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#26221E] text-xs font-semibold text-[#2D2926] dark:text-white"
          >
            <option value="door">🚪 Door / Entrance</option>
            <option value="washroom">🚻 Washroom</option>
            <option value="kitchen">🍳 Kitchen / Pass</option>
            <option value="counter">🏪 Pay / Counter</option>
            <option value="bar">🍷 Bar / Drinks</option>
            <option value="pos">💳 POS Terminal</option>
            <option value="waiting">🪑 Waiting Lounge</option>
            <option value="custom">📍 Custom Landmark</option>
          </select>
          <button
            type="button"
            onClick={handleAddLandmark}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsAddLandmarkOpen(false)}
            className="px-3 py-1.5 rounded-lg bg-[#E8E2D2] dark:bg-[#3D352E] text-xs font-bold"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Error Toast */}
      {errorToast && (
        <div className="mb-4 p-3 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between">
          <span>{errorToast}</span>
          <button onClick={() => setErrorToast(null)} className="p-1 hover:opacity-80"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* FREE-POSITION CANVAS CONTAINER */}
      <div 
        ref={canvasRef}
        onPointerMove={handlePointerMoveCanvas}
        onPointerUp={handlePointerUpCanvas}
        onPointerLeave={handlePointerUpCanvas}
        className={`w-full ${getAspectRatioClass()} max-h-[75vh] rounded-3xl bg-[#F5F2EA] dark:bg-[#181513] border-2 ${
          isEditMode 
            ? 'border-[#E37A08] shadow-inner cursor-crosshair' 
            : 'border-[#E8E2D2] dark:border-[#3D352E]'
        } relative overflow-hidden transition-all`}
        style={{
          backgroundImage: isEditMode && canvasSettings.gridSnapEnabled
            ? 'radial-gradient(rgba(227, 122, 8, 0.25) 1.5px, transparent 1.5px)'
            : 'radial-gradient(rgba(139, 69, 19, 0.08) 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Floor Dimension Overlay in Edit Mode */}
        {isEditMode && (
          <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-xs text-[10px] font-mono text-white/90 z-10 pointer-events-none">
            {canvasSettings.widthMeters}m × {canvasSettings.heightMeters}m ({canvasSettings.aspectRatio})
          </div>
        )}

        {/* 1. RENDER LANDMARKS */}
        {landmarks.map((lm) => {
          const coords = getLandmarkCoords(lm);
          const isSelected = selectedNode?.kind === 'landmark' && selectedNode.id === lm.id;

          let icon = <DoorOpen className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C]" />;
          if (coords.type === 'washroom') icon = <Bath className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C]" />;
          else if (coords.type === 'kitchen') icon = <UtensilsCrossed className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C]" />;
          else if (coords.type === 'counter') icon = <Store className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C]" />;
          else if (coords.type === 'bar') icon = <Wine className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C]" />;
          else if (coords.type === 'pos') icon = <CreditCard className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C]" />;
          else if (coords.type === 'waiting') icon = <Armchair className="w-5 h-5 text-[#8B4513] dark:text-[#D2B48C]" />;

          return (
            <div
              key={`lm-${lm.id}`}
              onPointerDown={(e) => handlePointerDownDrag(e, 'landmark', lm.id, coords.x, coords.y, coords.width, coords.height)}
              className={`absolute rounded-2xl bg-[#E8E2D2]/80 dark:bg-[#1C1917]/80 border-2 border-dashed border-[#A1917B] dark:border-[#6B5E4C] flex flex-col items-center justify-center p-1.5 text-center text-[#6B5E4C] dark:text-[#B8ACA0] shadow-sm select-none transition-shadow ${
                isEditMode ? 'cursor-grab active:cursor-grabbing hover:border-[#E37A08]' : ''
              } ${isSelected ? 'ring-2 ring-[#E37A08] border-[#E37A08] z-20' : 'z-0'}`}
              style={{
                left: `${coords.x}%`,
                top: `${coords.y}%`,
                width: `${coords.width}%`,
                height: `${coords.height}%`,
              }}
            >
              {icon}
              <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-tight text-[#2D2926] dark:text-white truncate max-w-full">
                {lm.name}
              </span>

              {/* Resize Handle in Edit Mode */}
              {isEditMode && isSelected && (
                <div
                  onPointerDown={(e) => handlePointerDownResize(e, 'landmark', lm.id, coords.width, coords.height)}
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#E37A08] text-white flex items-center justify-center cursor-nwse-resize shadow-md z-30"
                  title="Drag to resize"
                >
                  <Maximize2 className="w-3 h-3" />
                </div>
              )}
            </div>
          );
        })}

        {/* 2. RENDER TABLES — only a group's primary renders; merged members are folded into it */}
        <AnimatePresence>
          {primaries.map((table) => {
            const group = resolveGroupMembers(table, tables);
            const merged = isTableMerged(table);

            // Union bounding box of every member's own stored rect when merged,
            // so the combined unit visually occupies the space of all members.
            const coords = merged
              ? (() => {
                  const rects = group.map(getTableCoords);
                  const x0 = Math.min(...rects.map((r) => r.x));
                  const y0 = Math.min(...rects.map((r) => r.y));
                  const x1 = Math.max(...rects.map((r) => r.x + r.width));
                  const y1 = Math.max(...rects.map((r) => r.y + r.height));
                  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0, shape: 'rectangle' as const };
                })()
              : getTableCoords(table);

            const booking = getTableBooking(table);
            const isBestFit = bestFitTable?.id === table.id;
            const isSelectedNode = selectedNode?.kind === 'table' && selectedNode.id === table.id;
            const isBeingDragged = mergeDrag?.tableId === table.id;
            const isDropHoverTarget = mergeDrag?.hoverTargetId === table.id;
            const combinedCapacity = getGroupCombinedCapacity(group);
            const combinedName = getGroupCombinedName(group);

            let statusBg = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-950 dark:text-emerald-100';
            let badgeColor = 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300';

            if (table.isInactive) {
              statusBg = 'bg-stone-200 dark:bg-stone-900/60 border-stone-400 text-stone-500 opacity-60';
              badgeColor = 'bg-stone-300 dark:bg-stone-800 text-stone-600';
            } else if (table.isOccupied) {
              statusBg = 'bg-[#E37A08]/15 dark:bg-[#E37A08]/25 border-[#E37A08] text-[#2D2926] dark:text-white';
              badgeColor = 'bg-[#E37A08] text-white';
            }

            if (isBestFit && !table.isOccupied && !table.isInactive) {
              statusBg = 'bg-amber-100 dark:bg-amber-950/60 border-amber-400 text-amber-950 dark:text-amber-100 ring-4 ring-amber-400/50 animate-pulse';
            }

            if (isDropHoverTarget) {
              statusBg = 'bg-blue-100 dark:bg-blue-950/80 border-blue-500 ring-4 ring-blue-500/50';
            }

            const isDiamond = !merged && coords.shape === 'diamond';

            return (
              <motion.div
                key={`tbl-${table.id}`}
                layout={!isBeingDragged}
                layoutId={`table-${table.id}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                ref={(el: HTMLDivElement | null) => { tableNodeRefs.current[table.id] = el; }}
                onPointerDown={(e) => {
                  if (isEditMode) {
                    handlePointerDownDrag(e, 'table', table.id, coords.x, coords.y, coords.width, coords.height);
                  } else {
                    handleTableMergeDragStart(e, table);
                  }
                }}
                onClick={() => {
                  if (!isEditMode) handleTableClick(table);
                }}
                className={`absolute rounded-2xl border-2 flex flex-col items-center justify-between p-2 shadow-md select-none ${statusBg} ${
                  isEditMode ? 'cursor-grab active:cursor-grabbing hover:border-[#E37A08]' : 'cursor-pointer'
                } ${isDiamond ? 'rotate-45' : ''} ${isSelectedNode ? 'ring-4 ring-[#E37A08] border-[#E37A08] z-20' : isBeingDragged ? 'z-40 shadow-2xl' : 'z-10'}`}
                style={{
                  left: `${coords.x}%`,
                  top: `${coords.y}%`,
                  width: `${coords.width}%`,
                  height: `${coords.height}%`,
                  transform: isBeingDragged ? `translate(${mergeDrag!.dx}px, ${mergeDrag!.dy}px)` : undefined,
                }}
              >
                {/* Table Content Wrapper (Counter-rotates text if diamond) */}
                <div className={`w-full h-full flex flex-col items-center justify-between ${isDiamond ? '-rotate-45' : ''}`}>
                  <div className="w-full flex items-center justify-between">
                    <span className="font-serif font-black text-xs sm:text-sm text-[#8B4513] dark:text-[#D2B48C]">
                      {combinedName}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${badgeColor}`}>
                      {combinedCapacity}p
                    </span>
                  </div>

                  {/* Seated Info or Status */}
                  <div className="text-center my-auto w-full px-1">
                    {table.isOccupied && booking ? (
                      <div className="space-y-0.5">
                        <p className="font-bold text-[10px] sm:text-xs truncate text-[#2D2926] dark:text-white">
                          {booking.firstName}
                        </p>
                        <p className="text-[9px] font-semibold text-[#6B5E4C] dark:text-[#B8ACA0]">
                          {formatPartyBreakdownShort(booking)}
                        </p>
                        <div className="flex items-center justify-center gap-1 text-[9px] font-bold text-[#E37A08]">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{getSeatedDuration(booking.seatedAt)}</span>
                        </div>
                      </div>
                    ) : table.isInactive ? (
                      <span className="text-[9px] font-bold uppercase text-stone-500">Blocked</span>
                    ) : isDropHoverTarget ? (
                      <span className="text-[9px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-300">Drop to Merge</span>
                    ) : isBestFit ? (
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">★ Best Fit</span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Available</span>
                    )}
                  </div>

                  {/* Merged / Override Indicator */}
                  <div className="w-full text-center">
                    {merged && !table.isOccupied ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          dataService.unmergeGroup(table.id).then((res) => {
                            if (res.success) onTableUpdated();
                            else setErrorToast(res.error || 'Unmerge failed.');
                          });
                        }}
                        className="inline-flex items-center gap-1 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500 hover:bg-blue-600 text-white cursor-pointer"
                        title="Un-merge these tables"
                      >
                        <GitMerge className="w-2.5 h-2.5" />
                        {getGroupCombinedShortCode(group)} · Unmerge
                      </button>
                    ) : merged ? (
                      <span className="text-[8px] font-extrabold uppercase px-1 rounded bg-blue-500 text-white">
                        {getGroupCombinedShortCode(group)}
                      </span>
                    ) : table.maxOverrideCapacity > table.capacity ? (
                      <span className="text-[8px] font-bold text-[#6B5E4C] dark:text-[#B8ACA0]">
                        +1 Allowed
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Resize Handle in Edit Mode */}
                {isEditMode && isSelectedNode && (
                  <div
                    onPointerDown={(e) => handlePointerDownResize(e, 'table', table.id, coords.width, coords.height)}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#E37A08] text-white flex items-center justify-center cursor-nwse-resize shadow-md z-30"
                    title="Drag to resize table"
                  >
                    <Maximize2 className="w-3 h-3" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* INSPECTOR PANEL FOR SELECTED NODE IN EDIT MODE */}
      {isEditMode && selectedNode && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] flex flex-wrap items-center justify-between gap-4"
        >
          {selectedNode.kind === 'table' ? (() => {
            const tId = Number(selectedNode.id);
            const table = tables.find(t => t.id === tId);
            if (!table) return null;
            const coords = getTableCoords(table);

            return (
              <div className="w-full flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 font-bold">
                  <span className="font-serif text-sm text-[#8B4513] dark:text-[#D2B48C]">{table.name} Properties:</span>
                  <span>Capacity: {table.capacity} seats</span>
                  <span>Width: {coords.width}%</span>
                  <span>Height: {coords.height}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#6B5E4C]">Shape:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextShape = coords.shape === 'diamond' ? 'rectangle' : 'diamond';
                        const updated = tables.map(t => t.id === tId ? { ...t, shape: nextShape } : t);
                        dataService.saveTables(updated).catch(() => {});
                        onTableUpdated();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#26221E] border font-bold border-[#E8E2D2] dark:border-[#3D352E]"
                    >
                      {coords.shape === 'diamond' ? 'Diamond (45°)' : 'Rectangle'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-[#6B5E4C]">Capacity:</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newCap = Math.max(1, table.capacity - 1);
                        const updated = tables.map(t => t.id === tId ? { ...t, capacity: newCap, maxOverrideCapacity: Math.max(newCap, t.maxOverrideCapacity) } : t);
                        dataService.saveTables(updated).catch(() => {});
                        onTableUpdated();
                      }}
                      className="w-6 h-6 rounded bg-white dark:bg-[#26221E] border font-black"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold">{table.capacity}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newCap = table.capacity + 1;
                        const updated = tables.map(t => t.id === tId ? { ...t, capacity: newCap, maxOverrideCapacity: Math.max(newCap, t.maxOverrideCapacity) } : t);
                        dataService.saveTables(updated).catch(() => {});
                        onTableUpdated();
                      }}
                      className="w-6 h-6 rounded bg-white dark:bg-[#26221E] border font-black"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="px-3 py-1 rounded-lg bg-[#E8E2D2] dark:bg-[#3D352E] font-bold"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            );
          })() : (() => {
            const lmId = String(selectedNode.id);
            const lm = landmarks.find(l => l.id === lmId);
            if (!lm) return null;

            return (
              <div className="w-full flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3 font-bold">
                  <span className="font-serif text-sm text-[#8B4513] dark:text-[#D2B48C]">Landmark: {lm.name}</span>
                </div>

                <div className="flex items-center gap-3">
                  {lmId.startsWith('lm_') && (
                    <button
                      type="button"
                      onClick={() => handleDeleteLandmark(lmId)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Feature
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedNode(null)}
                    className="px-3 py-1 rounded-lg bg-[#E8E2D2] dark:bg-[#3D352E] font-bold"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            );
          })()}
        </motion.div>
      )}

      {/* OVERRIDE CAPACITY CONFIRM MODAL */}
      <AnimatePresence>
        {overrideConfirmModal && (() => {
          const group = resolveGroupMembers(overrideConfirmModal.table, tables);
          const baseCap = getGroupCombinedCapacity(group);
          const maxCap = getGroupCombinedMaxCapacity(group);
          const overrideAmount = maxCap - baseCap;
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-[#26221E] rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E] space-y-4 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-600 flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-serif font-bold text-[#2D2926] dark:text-white">
                  Override {getGroupCombinedName(group)} Capacity?
                </h3>
                <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] leading-relaxed">
                  Standard capacity is <strong>{baseCap} seats</strong>.
                  Party of <strong>{overrideConfirmModal.booking.partySize}</strong> ({getRequiredTableSeats(overrideConfirmModal.booking)} required table seats) can be seated using the +{overrideAmount} chair override.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setOverrideConfirmModal(null)}
                    className="flex-1 py-3 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] font-bold text-xs hover:bg-[#E8E2D2] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const { table, booking } = overrideConfirmModal;
                      setOverrideConfirmModal(null);
                      const res = await dataService.allocateTable(booking.id, table.id, undefined, overrideAmount);
                      if (res.success) {
                        onSelectWaitingBooking(null);
                        onTableUpdated();
                      } else {
                        setErrorToast(res.error || 'Allocation failed.');
                      }
                    }}
                    className="flex-1 py-3 rounded-2xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                  >
                    Confirm +{overrideAmount} Override
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* QUICK SEAT WALK-IN MODAL */}
      <AnimatePresence>
        {quickSeatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-[#26221E] rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E] space-y-4"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D2] dark:border-[#3D352E]">
                <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                  <span>Quick Seat — {getGroupCombinedName(resolveGroupMembers(quickSeatModal, tables))}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-sans">Vacant</span>
                </h3>
                <button onClick={() => setQuickSeatModal(null)} className="p-1 text-[#6B5E4C] hover:opacity-80">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleQuickSeatSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                    Party Size
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {Array.from(
                      { length: Math.max(8, getGroupCombinedMaxCapacity(resolveGroupMembers(quickSeatModal, tables))) },
                      (_, i) => i + 1
                    ).map((size) => (
                      <button
                        type="button"
                        key={size}
                        onClick={() => setQuickSeatPartySize(size)}
                        className={`w-9 py-2 rounded-xl text-xs font-black transition-all ${
                          quickSeatPartySize === size
                            ? 'bg-[#E37A08] text-white shadow-sm'
                            : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-white hover:bg-[#E8E2D2]'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                      Guest Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Rajesh"
                      value={quickSeatName}
                      onChange={(e) => setQuickSeatName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-semibold text-[#2D2926] dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      placeholder="04xx xxx xxx"
                      value={quickSeatPhone}
                      onChange={(e) => setQuickSeatPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-semibold text-[#2D2926] dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase mb-1">
                    Assigned Staff / Server
                  </label>
                  <select
                    value={quickSeatServer}
                    onChange={(e) => setQuickSeatServer(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-semibold text-[#2D2926] dark:text-white"
                  >
                    <option value="">No specific server</option>
                    {(dataService.getSettings()?.staffList || ['Amrit', 'Sanjay', 'Vasu']).map((staff: string) => (
                      <option key={staff} value={staff}>{staff}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setQuickSeatModal(null)}
                    className="flex-1 py-3 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    Seat Party Now
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OCCUPIED TABLE DETAILS & ACTIONS MODAL */}
      <AnimatePresence>
        {selectedOccupiedTable && (() => {
          const booking = getTableBooking(selectedOccupiedTable);
          const occupiedGroup = resolveGroupMembers(selectedOccupiedTable, tables);
          const occupiedOrderingUrl = getGroupCombinedOrderingUrl(occupiedGroup);
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-[#26221E] rounded-3xl p-6 max-w-md w-full shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E] space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#E8E2D2] dark:border-[#3D352E]">
                  <h3 className="text-base font-serif font-bold text-[#2D2926] dark:text-white flex items-center gap-2">
                    <span>{getGroupCombinedName(occupiedGroup)} Details</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#E37A08] text-white font-bold">Occupied</span>
                  </h3>
                  <button onClick={() => setSelectedOccupiedTable(null)} className="p-1 text-[#6B5E4C] hover:opacity-80">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {booking ? (
                  <div className="space-y-3 text-xs text-[#2D2926] dark:text-white">
                    <div className="p-3.5 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-sm text-[#8B4513] dark:text-[#D2B48C]">
                          {booking.firstName} {booking.lastName}
                        </span>
                        <span className="font-mono text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                          {booking.phone}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                        <span>Party Breakdown: <strong>{formatPartyBreakdownShort(booking)}</strong></span>
                        <span>Seated Time: <strong>{getSeatedDuration(booking.seatedAt)}</strong></span>
                      </div>
                      {booking.serverName && (
                        <p className="text-xs text-[#E37A08] font-bold">
                          Assigned Server: {booking.serverName}
                        </p>
                      )}
                      {booking.notes && (
                        <p className="text-xs italic bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-200 dark:border-amber-900">
                          Notes: {booking.notes}
                        </p>
                      )}
                    </div>

                    {occupiedOrderingUrl && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#8B4513] dark:text-[#D2B48C]">Square QR Ordering URL:</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(occupiedOrderingUrl);
                            setLayoutToast('Ordering URL copied!');
                            setTimeout(() => setLayoutToast(null), 2000);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#E37A08] text-white text-[10px] font-bold"
                        >
                          Copy Link
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">No active booking record attached.</p>
                )}

                <div className="flex items-center gap-3 pt-3">
                  <button
                    onClick={() => setSelectedOccupiedTable(null)}
                    className="flex-1 py-3 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] font-bold text-xs"
                  >
                    Close
                  </button>
                  <button
                    onClick={async () => {
                      const table = selectedOccupiedTable;
                      setSelectedOccupiedTable(null);
                      const res = await dataService.finishTable(table.id);
                      if (res.success) {
                        onTableUpdated();
                      } else {
                        setErrorToast(res.error || 'Failed to mark table finished.');
                      }
                    }}
                    className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors"
                  >
                    Mark Party Finished
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
};
