import React, { useState, useEffect, useRef } from 'react';
import { Users, Calendar, Utensils, UserCheck, BarChart3, Bell, LayoutGrid, RotateCcw, Volume2, Settings as SettingsIcon } from 'lucide-react';
import { AdminTab, Booking, Customer, Table, AdminRole } from '../../types';
import { dataService } from '../../services/dataService';
import { FloorPlan } from './FloorPlan';
import { WaitingListTab } from './WaitingListTab';
import { BookedTab } from './BookedTab';
import { SeatedTab } from './SeatedTab';
import { CustomersTab } from './CustomersTab';
import { SummaryTab } from './SummaryTab';
import { SettingsTab } from './SettingsTab';
import { NewBookingModal } from './NewBookingModal';
import { playNewBookingChime } from '../../utils/sound';

interface AdminDashboardProps {
  adminRole: AdminRole;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminRole }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('waiting');
  const [tables, setTables] = useState<Table[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [selectedWaitingBooking, setSelectedWaitingBooking] = useState<Booking | null>(null);
  const [showFloorPlan, setShowFloorPlan] = useState(true);
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(dataService.isOnline());
  const [toast, setToast] = useState<string | null>(null);

  const [staffName, setStaffName] = useState<string>(() => {
    if (adminRole === 'owner') {
      return 'Manager';
    }
    return sessionStorage.getItem('just_dosa_staff_name') || '';
  });

  const staffList = dataService.getStaffList();
  const shouldShowStaffGrid = adminRole === 'staff' && !staffName && staffList.length > 0;

  useEffect(() => {
    if (adminRole === 'owner') {
      sessionStorage.setItem('just_dosa_staff_name', 'Manager');
      setStaffName('Manager');
    } else {
      const stored = sessionStorage.getItem('just_dosa_staff_name') || '';
      setStaffName(stored);
    }
  }, [adminRole]);

  const prevPendingIdsRef = useRef<string[]>([]);

  // Real-time tab title badge count (e.g. "(3) Just Dosa") & Sound/vibration chime
  useEffect(() => {
    const currentPending = bookings.filter((b) => b.status === 'pending');
    const currentPendingIds = currentPending.map((b) => b.id);
    const prevPendingIds = prevPendingIdsRef.current;

    // Badge count in title
    if (currentPending.length > 0) {
      document.title = `(${currentPending.length}) Just Dosa`;
    } else {
      document.title = 'Just Dosa';
    }

    // PWA Badging API support for iPad and mobile
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      if (currentPending.length > 0) {
        (navigator as any).setAppBadge(currentPending.length).catch((e: any) => console.error(e));
      } else {
        (navigator as any).clearAppBadge().catch((e: any) => console.error(e));
      }
    }

    // New booking check
    const hasNewPending = currentPendingIds.some((id) => !prevPendingIds.includes(id));
    if (hasNewPending && prevPendingIds.length > 0) {
      playNewBookingChime();
    }

    prevPendingIdsRef.current = currentPendingIds;
  }, [bookings]);

  const loadData = () => {
    setTables(dataService.getTables());
    setBookings(dataService.getBookings());
    setCustomers(dataService.getCustomers());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribe(() => {
      loadData();
      const onlineStatus = dataService.isOnline();
      setIsOnline((prev) => {
        if (!prev && onlineStatus) {
          setToast("Back online");
          setTimeout(() => setToast(null), 3000);
        }
        return onlineStatus;
      });
    });
    const intervalId = setInterval(() => {
      loadData();
    }, 3000);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    // Run auto-finish rollover check on mount (delayed to allow initial cache populating)
    const runRollover = async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const clearedCount = await dataService.autoFinishPreviousDaySeatedParties();
      if (clearedCount > 0) {
        setToast(`Cleared ${clearedCount} table${clearedCount > 1 ? 's' : ''} from yesterday.`);
        setTimeout(() => setToast(null), 5000);
      }
    };
    runRollover();

    // Check at midnight
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const checkAtMidnight = setTimeout(async () => {
      const clearedCount = await dataService.autoFinishPreviousDaySeatedParties();
      if (clearedCount > 0) {
        setToast(`Cleared ${clearedCount} table${clearedCount > 1 ? 's' : ''} from yesterday.`);
        setTimeout(() => setToast(null), 5000);
      }
    }, msUntilMidnight);

    return () => clearTimeout(checkAtMidnight);
  }, []);

  // When switching to waiting or booked tabs, clear unread new badges
  useEffect(() => {
    if (activeTab === 'waiting') {
      dataService.clearNewAlerts('waiting');
    } else if (activeTab === 'booked') {
      dataService.clearNewAlerts('booked');
    }
  }, [activeTab]);

  const waitingCount = bookings.filter((b) => b.status === 'waiting').length;
  const bookedCount = bookings.filter(
    (b) => b.type === 'remote' && ['pending', 'booked', 'confirmed', 'alternative_proposed'].includes(b.status)
  ).length;
  const seatedCount = bookings.filter((b) => b.status === 'seated').length;
  const unreadWaiting = bookings.filter((b) => b.status === 'waiting' && b.isNewAlert).length;
  const unreadBooked = bookings.filter(
    (b) => b.type === 'remote' && b.isNewAlert && ['pending', 'booked', 'confirmed', 'alternative_proposed', 'declined', 'cancelled'].includes(b.status)
  ).length;

  useEffect(() => {
    if (adminRole === 'staff' && (activeTab === 'customers' || activeTab === 'summary' || activeTab === 'settings')) {
      setActiveTab('waiting');
    }
  }, [adminRole, activeTab]);

  const stats = dataService.getDailyStats();

  if (shouldShowStaffGrid) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#FFFDF7] dark:bg-[#1C1917] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-[#26221E] rounded-3xl p-8 shadow-xl border border-[#E8E2D2] dark:border-[#3D352E] text-center space-y-6">
          <div className="space-y-2">
            <span className="text-3xl block">🙏</span>
            <h2 className="text-2xl font-serif font-extrabold text-[#2D2926] dark:text-white tracking-tight">
              Who's working?
            </h2>
            <p className="text-sm text-[#6B5E4C] dark:text-[#B8ACA0]">
              Select your name to start the service session.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {staffList.map((name) => (
              <button
                key={name}
                onClick={() => {
                  sessionStorage.setItem('just_dosa_staff_name', name);
                  setStaffName(name);
                }}
                className="p-4 text-center text-sm font-bold rounded-2xl bg-[#F5F2EA] hover:bg-[#E8E2D2] dark:bg-[#1C1917] dark:hover:bg-[#3D352E] text-[#2D2926] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E] transition-all hover:scale-[1.02] active:scale-95 shadow-xs flex flex-col items-center justify-center gap-1.5 min-h-[4.5rem]"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#FFFDF7] dark:bg-[#1C1917] py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Offline Connection Banner */}
        {!isOnline && (
          <div className="bg-amber-600 dark:bg-amber-700 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-md animate-pulse">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 bg-white rounded-full animate-ping shrink-0" />
              <span className="text-sm font-semibold tracking-wide">
                Reconnecting… Live updates are paused and administrative actions are restricted.
              </span>
            </div>
            <span className="text-xs font-mono opacity-80 shrink-0">No Connection</span>
          </div>
        )}

        {/* Admin Header & Welcome */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E2D2] dark:border-[#3D352E]">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${adminRole === 'owner' ? 'bg-[#E37A08]' : 'bg-emerald-500'} animate-ping`} />
              <span className="text-xs font-bold uppercase tracking-widest text-[#E37A08]">
                {adminRole === 'owner' ? 'Manager/Founder Portal (Full Access)' : 'Staff Portal (Service Mode)'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#2D2926] dark:text-white tracking-tight mt-0.5">
              Just Dosa Restaurant Management
            </h1>
            <p className="text-xs sm:text-sm text-[#6B5E4C] dark:text-[#B8ACA0]">
              Manage tables, live queue allocations, WhatsApp notifications, and Customer Data.
            </p>
            {adminRole === 'staff' && staffName && (
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-2">
                <span>Staff: <strong className="font-extrabold">{staffName}</strong></span>
                <span className="text-[#6B5E4C] dark:text-[#B8ACA0]">•</span>
                <button
                  onClick={() => {
                    sessionStorage.removeItem('just_dosa_staff_name');
                    setStaffName('');
                  }}
                  className="px-2 py-0.5 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all border border-emerald-500/20 text-[10px] cursor-pointer"
                >
                  Switch User
                </button>
              </div>
            )}
            {adminRole === 'owner' && (
              <div className="text-xs font-semibold text-[#E37A08] mt-2">
                Manager: <strong className="font-extrabold">Manager</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={playNewBookingChime}
              title="Test Alert Chime Sound"
              className="px-3 py-2 rounded-xl bg-[#F5F2EA] dark:bg-[#26221E] hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-[#2D2926] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Volume2 className="w-4 h-4 text-[#E37A08]" />
              <span className="hidden sm:inline">Test Sound</span>
            </button>

            <button
              onClick={() => setShowFloorPlan(!showFloorPlan)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
                showFloorPlan
                  ? 'bg-[#E37A08] text-white shadow-[#E37A08]/20'
                  : 'bg-[#F5F2EA] dark:bg-[#26221E] text-[#2D2926] dark:text-[#D2B48C] hover:bg-[#E8E2D2] border border-[#E8E2D2] dark:border-[#3D352E]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{showFloorPlan ? 'Hide Floor Plan' : 'Show Floor Plan'}</span>
            </button>
          </div>
        </div>

        {/* Selected party prompt bar if someone is selected for seating */}
        {selectedWaitingBooking && (
          <div className="bg-[#8B4513] p-4 rounded-2xl text-white shadow-lg shadow-[#8B4513]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#D2B48C] block">
                  Active Seating Mode
                </span>
                <span className="font-serif font-extrabold text-base">
                  Seat {selectedWaitingBooking.firstName} {selectedWaitingBooking.lastName} (Party of {selectedWaitingBooking.partySize})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#D2B48C] hidden md:inline">
                Tap a green vacant table below!
              </span>
              <button
                onClick={() => setSelectedWaitingBooking(null)}
                className="px-3 py-1.5 rounded-xl bg-[#E37A08] text-white font-bold text-xs hover:bg-[#c96906] shadow-sm"
              >
                Cancel Selection
              </button>
            </div>
          </div>
        )}

        {/* Live Floor Plan Section */}
        {showFloorPlan && (
          <div className="transition-all duration-300">
            <FloorPlan
              tables={tables}
              bookings={bookings}
              selectedWaitingBooking={selectedWaitingBooking}
              onSelectWaitingBooking={setSelectedWaitingBooking}
              onTableUpdated={loadData}
            />
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#E8E2D2] dark:border-[#3D352E]">
          <button
            onClick={() => setActiveTab('waiting')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 relative ${
              activeTab === 'waiting'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/20'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Waiting List</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'waiting' ? 'bg-white text-[#8B4513]' : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}>
              {waitingCount}
            </span>
            {unreadWaiting > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#EF4444] animate-bounce" title="New arrival!" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('booked')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 relative ${
              activeTab === 'booked'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/20'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Booked</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'booked' ? 'bg-white text-[#8B4513]' : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}>
              {bookedCount}
            </span>
            {unreadBooked > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#EF4444] animate-bounce" title="New remote reservation!" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('seated')}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'seated'
                ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/20'
                : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <Utensils className="w-4 h-4" />
            <span>Seated</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'seated' ? 'bg-white text-[#8B4513]' : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}>
              {seatedCount}
            </span>
          </button>

          {adminRole === 'owner' && (
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/20'
                  : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Customer Data</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'customers' ? 'bg-white text-[#8B4513]' : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E]'
              }`}>
                {Object.keys(customers).length}
              </span>
            </button>
          )}

          {adminRole === 'owner' && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/20'
                  : 'bg-white dark:bg-[#26221E] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] border border-[#E8E2D2] dark:border-[#3D352E]'
              }`}
            >
              <SettingsIcon className="w-4 h-4" />
              <span>Settings</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === 'waiting' && (
            <WaitingListTab
              bookings={bookings}
              customers={customers}
              tables={tables}
              selectedWaitingBooking={selectedWaitingBooking}
              onSelectWaitingBooking={setSelectedWaitingBooking}
              onRefresh={loadData}
              onOpenNewBooking={() => setIsNewBookingOpen(true)}
            />
          )}

          {activeTab === 'booked' && (
            <BookedTab 
              bookings={bookings} 
              customers={customers} 
              onRefresh={loadData} 
              onOpenNewBooking={() => setIsNewBookingOpen(true)}
            />
          )}

          {activeTab === 'seated' && (
            <SeatedTab bookings={bookings} tables={tables} onRefresh={loadData} />
          )}

          {activeTab === 'customers' && adminRole === 'owner' && (
            <CustomersTab customers={customers} bookings={bookings} adminRole={adminRole} onRefresh={loadData} />
          )}

          {activeTab === 'summary' && adminRole === 'owner' && <SummaryTab stats={stats} />}

          {activeTab === 'settings' && adminRole === 'owner' && <SettingsTab />}
        </div>
      </div>

      <NewBookingModal
        isOpen={isNewBookingOpen}
        onClose={() => setIsNewBookingOpen(false)}
        onRefresh={loadData}
        customers={customers}
        bookings={bookings}
      />

      {/* Toast Notification overlay */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#2D2926] text-[#FFFDF7] px-5 py-3 rounded-2xl border border-[#E8E2D2]/20 shadow-xl flex items-center gap-3 animate-bounce">
          <div className="w-2 h-2 rounded-full bg-[#E37A08] animate-ping" />
          <span className="text-sm font-medium tracking-wide">{toast}</span>
        </div>
      )}
    </div>
  );
};
