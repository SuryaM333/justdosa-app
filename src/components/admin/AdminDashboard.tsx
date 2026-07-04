import React, { useState, useEffect } from 'react';
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
  onResetDemo: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminRole, onResetDemo }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('waiting');
  const [tables, setTables] = useState<Table[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [selectedWaitingBooking, setSelectedWaitingBooking] = useState<Booking | null>(null);
  const [showFloorPlan, setShowFloorPlan] = useState(true);
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);

  const loadData = () => {
    setTables(dataService.getTables());
    setBookings(dataService.getBookings());
    setCustomers(dataService.getCustomers());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = dataService.subscribe(() => {
      loadData();
    });
    const intervalId = setInterval(() => {
      loadData();
    }, 3000);
    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
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

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#FFFDF7] dark:bg-[#1C1917] py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
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
            <CustomersTab customers={customers} adminRole={adminRole} onRefresh={loadData} />
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
    </div>
  );
};
