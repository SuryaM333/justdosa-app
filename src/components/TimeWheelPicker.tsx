import React, { useRef, useEffect, useState } from 'react';
import { dataService } from '../services/dataService';

export interface TimeSlot {
  value: string; // e.g., "18:30"
  label: string; // e.g., "6:30 PM (Dinner)"
  timeString: string; // e.g., "6:30 PM"
}

export const getDayOfWeek = (dateStr: string) => {
  if (!dateStr) return -1;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return -1;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return date.getDay();
};

export const getAvailableTimeSlotsShared = (dateStr: string): TimeSlot[] => {
  const day = getDayOfWeek(dateStr);
  if (day === -1) return [];

  const hours = dataService.getOpeningHours();
  const dayConfig = hours[day.toString()] || hours[day];
  if (!dayConfig || !dayConfig.isOpen) return [];

  const slots: TimeSlot[] = [];
  const interval = dataService.getSlotInterval();

  const parseTimeToMins = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const minsToSlot = (totalMins: number, labelSuffix: string): TimeSlot => {
    const h = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const val = `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    const timeString = `${displayHour}:${mins.toString().padStart(2, '0')} ${ampm}`;
    return {
      value: val,
      label: `${timeString} ${labelSuffix}`,
      timeString,
    };
  };

  // 1. Lunch Service slots
  if (dayConfig.lunchOpen && dayConfig.lunchStart && dayConfig.lunchEnd) {
    const startMins = parseTimeToMins(dayConfig.lunchStart);
    const endMins = parseTimeToMins(dayConfig.lunchEnd);
    const buffer = dataService.getLunchBuffer();
    const endLimitMins = endMins - buffer;

    for (let m = startMins; m <= endLimitMins; m += interval) {
      slots.push(minsToSlot(m, '(Lunch)'));
    }
  }

  // 2. Dinner Service slots
  if (dayConfig.dinnerOpen && dayConfig.dinnerStart && dayConfig.dinnerEnd) {
    const startMins = parseTimeToMins(dayConfig.dinnerStart);
    const endMins = parseTimeToMins(dayConfig.dinnerEnd);
    const buffer = dataService.getDinnerBuffer();
    const endLimitMins = endMins - buffer;

    for (let m = startMins; m <= endLimitMins; m += interval) {
      slots.push(minsToSlot(m, '(Dinner)'));
    }
  }

  // Deduplicate and sort slots chronologically
  const uniqueMap = new Map<string, TimeSlot>();
  slots.forEach((s) => {
    uniqueMap.set(s.value, s);
  });
  const uniqueSlots = Array.from(uniqueMap.values());

  return uniqueSlots.sort((a, b) => {
    const [ha, ma] = a.value.split(':').map(Number);
    const [hb, mb] = b.value.split(':').map(Number);
    return (ha * 60 + ma) - (hb * 60 + mb);
  });
};

interface TimeWheelPickerProps {
  slots: TimeSlot[];
  selectedValue: string;
  onChange: (value: string) => void;
}

export const TimeWheelPicker: React.FC<TimeWheelPickerProps> = ({
  slots,
  selectedValue,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const ITEM_HEIGHT = 44; // Perfect large touch targets (at least 44px for mobile/tablet)
  const VISIBLE_ITEMS = 5; // 5 items visible: 2 top, 1 middle, 2 bottom
  const CONTAINER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 220px
  const PADDING_HEIGHT = ITEM_HEIGHT * 2; // 88px top and bottom padding

  const selectedIndex = slots.findIndex((s) => s.value === selectedValue);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;

  // Sync scroll position with external activeIndex changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targetScrollTop = activeIndex * ITEM_HEIGHT;
    if (Math.abs(container.scrollTop - targetScrollTop) > 1.5) {
      container.scrollTop = targetScrollTop;
      setScrollTop(targetScrollTop);
    }
  }, [selectedValue, activeIndex, slots]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);

    const computedIndex = Math.round(target.scrollTop / ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(slots.length - 1, computedIndex));

    if (slots[clampedIndex] && slots[clampedIndex].value !== selectedValue) {
      onChange(slots[clampedIndex].value);
    }
  };

  const handleItemClick = (index: number) => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: index * ITEM_HEIGHT,
      behavior: 'smooth',
    });
  };

  if (slots.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-rose-500 font-bold bg-rose-500/10 border border-rose-500/20 rounded-2xl">
        No times available for this day.
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-xs mx-auto overflow-hidden rounded-2xl border border-[#E8E2D2] dark:border-[#3D352E] bg-white dark:bg-[#1C1917]/40 shadow-inner select-none">
      <style>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* 3D cylindrical fade effect */}
      <div 
        className="absolute inset-x-0 top-0 pointer-events-none z-10 bg-gradient-to-b from-white via-white/40 to-transparent dark:from-[#1C1917] dark:via-[#1C1917]/40 dark:to-transparent" 
        style={{ height: `${PADDING_HEIGHT}px` }}
      />
      <div 
        className="absolute inset-x-0 bottom-0 pointer-events-none z-10 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-[#1C1917] dark:via-[#1C1917]/40 dark:to-transparent" 
        style={{ height: `${PADDING_HEIGHT}px` }}
      />

      {/* Brand orange selection overlay highlight */}
      <div 
        className="absolute inset-x-2 border-y border-[#E37A08]/40 bg-[#E37A08]/5 pointer-events-none z-10 rounded-lg"
        style={{ 
          top: `${PADDING_HEIGHT}px`, 
          height: `${ITEM_HEIGHT}px` 
        }}
      />

      {/* Scrollable wheel list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-scroll snap-y snap-mandatory scrollbar-none relative z-0"
        style={{ 
          height: `${CONTAINER_HEIGHT}px`,
          paddingTop: `${PADDING_HEIGHT}px`,
          paddingBottom: `${PADDING_HEIGHT}px`
        }}
      >
        {slots.map((slot, idx) => {
          const isSelected = selectedValue === slot.value;
          
          // Continuous distance calculation for smooth physical feel during scrolling
          const itemScrollTop = idx * ITEM_HEIGHT;
          const distanceFromCenter = Math.abs(scrollTop - itemScrollTop);
          const ratio = Math.min(distanceFromCenter / (ITEM_HEIGHT * 2.2), 1); // 0 at center, 1 at edges

          const opacity = 1 - ratio * 0.75; // 1.0 down to 0.25
          const scale = 1 - ratio * 0.2; // 1.0 down to 0.8
          const rotateX = ratio * 50 * (scrollTop > itemScrollTop ? 1 : -1); // 3D rotate cylinder effect

          return (
            <div
              key={slot.value}
              onClick={() => handleItemClick(idx)}
              className="snap-center flex items-center justify-center cursor-pointer select-none transition-transform duration-75 text-center"
              style={{ 
                height: `${ITEM_HEIGHT}px`,
                transform: `perspective(220px) rotateX(${rotateX}deg) scale(${scale})`,
                opacity: opacity
              }}
            >
              <span className={`text-sm font-mono font-bold tracking-wide ${isSelected ? 'text-[#E37A08] dark:text-amber-500 scale-105 font-black' : 'text-[#6B5E4C] dark:text-[#B8ACA0]'}`}>
                {slot.timeString}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
