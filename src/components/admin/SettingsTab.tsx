import React, { useState } from 'react';
import { KeyRound, Shield, CheckCircle, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { dataService } from '../../services/dataService';

export const SettingsTab: React.FC = () => {
  const [currentOwnerPin, setCurrentOwnerPin] = useState('');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [confirmStaffPin, setConfirmStaffPin] = useState('');
  
  const [currentOwnerPinForOwner, setCurrentOwnerPinForOwner] = useState('');
  const [newOwnerPin, setNewOwnerPin] = useState('');
  const [confirmOwnerPin, setConfirmOwnerPin] = useState('');

  const [whatsappField, setWhatsappField] = useState(() => dataService.getWhatsAppNumber());
  const [capacityField, setCapacityField] = useState(() => dataService.getKalyanaCapacity().toString());
  const [lunchStartField, setLunchStartField] = useState(() => dataService.getLunchStartTime());
  const [lunchEndField, setLunchEndField] = useState(() => dataService.getLunchEndTime());
  const [dinnerStartField, setDinnerStartField] = useState(() => dataService.getDinnerStartTime());
  const [dinnerEndField, setDinnerEndField] = useState(() => dataService.getDinnerEndTime());
  const [configsSuccess, setConfigsSuccess] = useState<string | null>(null);

  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  const [ownerSuccess, setOwnerSuccess] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [showConfirmConvert, setShowConfirmConvert] = useState(false);

  const handleUpdateStaffPin = (e: React.FormEvent) => {
    e.preventDefault();
    setStaffSuccess(null);
    setStaffError(null);

    if (currentOwnerPin !== dataService.getOwnerPin()) {
      setStaffError('Current Manager/Founder PIN is incorrect.');
      return;
    }
    if (newStaffPin.length !== 4 || !/^\d+$/.test(newStaffPin)) {
      setStaffError('New Staff PIN must be exactly 4 numeric digits.');
      return;
    }
    if (newStaffPin !== confirmStaffPin) {
      setStaffError('New PIN and confirmation do not match.');
      return;
    }

    dataService.setStaffPin(newStaffPin);
    setStaffSuccess(`Staff PIN updated successfully!`);
    setCurrentOwnerPin('');
    setNewStaffPin('');
    setConfirmStaffPin('');
  };

  const handleUpdateOwnerPin = (e: React.FormEvent) => {
    e.preventDefault();
    setOwnerSuccess(null);
    setOwnerError(null);

    if (currentOwnerPinForOwner !== dataService.getOwnerPin()) {
      setOwnerError('Current Manager/Founder PIN is incorrect.');
      return;
    }
    if (newOwnerPin.length !== 4 || !/^\d+$/.test(newOwnerPin)) {
      setOwnerError('New Manager/Founder PIN must be exactly 4 numeric digits.');
      return;
    }
    if (newOwnerPin !== confirmOwnerPin) {
      setOwnerError('New PIN and confirmation do not match.');
      return;
    }

    dataService.setOwnerPin(newOwnerPin);
    setOwnerSuccess(`Manager/Founder PIN updated successfully!`);
    setCurrentOwnerPinForOwner('');
    setNewOwnerPin('');
    setConfirmOwnerPin('');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="bg-[#FFFDF7] dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#E37A08]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#E37A08]" />
          </div>
          <div>
            <h2 className="text-lg font-serif font-bold text-[#2D2926] dark:text-white">
              System Settings & PIN Management
            </h2>
            <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
              Secure administrative access control. Only users logged in with Manager/Founder PIN can view and edit these settings.
            </p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs space-y-1">
            <span className="font-bold text-[#8B4513] dark:text-[#D2B48C] block">Active Access Levels</span>
            <p className="text-[#6B5E4C] dark:text-[#B8ACA0]">
              Staff PIN: <strong className="font-mono text-[#2D2926] dark:text-white">••••</strong> (Daily service & waitlist)
            </p>
            <p className="text-[#6B5E4C] dark:text-[#B8ACA0]">
              Manager/Founder PIN: <strong className="font-mono text-[#E37A08]">••••</strong> (Full access including Customer Data & Settings)
            </p>
          </div>
          <button
            onClick={() => {
              dataService.setStaffPin('1357');
              dataService.setOwnerPin('2468');
              setStaffSuccess('Reset both PINs to system defaults');
              setOwnerSuccess(null);
            }}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#26221E] hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-xs font-bold text-[#2D2926] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E] flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#E37A08]" />
            <span>Reset PINs to Default</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Update Staff PIN Form */}
        <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-[#8B4513]" />
              <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white">
                Change Staff PIN
              </h3>
            </div>
            <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mb-4">
              Staff PIN allows hosts and waitstaff to manage the floor plan, tables, and waiting list.
            </p>

            {staffSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{staffSuccess}</span>
              </div>
            )}
            {staffError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{staffError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateStaffPin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                  Current Manager/Founder PIN (Required to confirm)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={currentOwnerPin}
                  onChange={(e) => setCurrentOwnerPin(e.target.value)}
                  placeholder="Enter current Manager/Founder PIN"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#F5F2EA] dark:bg-[#1C1917] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                  New Staff PIN (Exactly 4 digits)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newStaffPin}
                  onChange={(e) => setNewStaffPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#F5F2EA] dark:bg-[#1C1917] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                  Confirm New Staff PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmStaffPin}
                  onChange={(e) => setConfirmStaffPin(e.target.value)}
                  placeholder="Re-enter new staff PIN"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#F5F2EA] dark:bg-[#1C1917] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl bg-[#8B4513] hover:bg-[#72380E] text-white font-bold text-xs shadow-sm transition-colors"
              >
                Update Staff PIN
              </button>
            </form>
          </div>
        </div>

        {/* Update Manager/Founder PIN Form */}
        <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-[#E37A08]" />
              <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white">
                Change Manager/Founder PIN
              </h3>
            </div>
            <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mb-4">
              Manager/Founder PIN grants full access to Customer Data and security settings.
            </p>

            {ownerSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{ownerSuccess}</span>
              </div>
            )}
            {ownerError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{ownerError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateOwnerPin} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                  Current Manager/Founder PIN (Required to confirm)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={currentOwnerPinForOwner}
                  onChange={(e) => setCurrentOwnerPinForOwner(e.target.value)}
                  placeholder="Enter current Manager/Founder PIN"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#F5F2EA] dark:bg-[#1C1917] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                  New Manager/Founder PIN (Exactly 4 digits)
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={newOwnerPin}
                  onChange={(e) => setNewOwnerPin(e.target.value)}
                  placeholder="••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#F5F2EA] dark:bg-[#1C1917] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                  Confirm New Manager/Founder PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={confirmOwnerPin}
                  onChange={(e) => setConfirmOwnerPin(e.target.value)}
                  placeholder="Re-enter new Manager/Founder PIN"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#F5F2EA] dark:bg-[#1C1917] text-sm font-mono text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-sm transition-colors"
              >
                Update Manager/Founder PIN
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Restaurant Info & Saturday Feast Capacity Settings */}
      <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <RefreshCw className="w-5 h-5 text-[#E37A08]" />
          <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white">
            Restaurant Configurations (Manager/Founder Only)
          </h3>
        </div>
        <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mb-4">
          Configure contact numbers, slot capacities, and operating hours used for reservations and customer notifications.
        </p>

        <form onSubmit={(e) => {
          e.preventDefault();
          dataService.setWhatsAppNumber(whatsappField);
          dataService.setKalyanaCapacity(parseInt(capacityField, 10) || 40);
          dataService.setLunchStartTime(lunchStartField);
          dataService.setLunchEndTime(lunchEndField);
          dataService.setDinnerStartTime(dinnerStartField);
          dataService.setDinnerEndTime(dinnerEndField);
          setConfigsSuccess('Restaurant configuration saved successfully!');
          setTimeout(() => setConfigsSuccess(null), 3000);
        }} className="space-y-4">
          {configsSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{configsSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                Restaurant WhatsApp / Contact Number
              </label>
              <input
                type="text"
                value={whatsappField}
                onChange={(e) => setWhatsappField(e.target.value)}
                placeholder="e.g. 0412 345 678"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                Kalyana Virundhu Capacity (Guests per slot)
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={capacityField}
                onChange={(e) => setCapacityField(e.target.value)}
                placeholder="Default is 40"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                Lunch Hours (Sat/Sun, e.g. 11:00 to 14:00)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={lunchStartField}
                  onChange={(e) => setLunchStartField(e.target.value)}
                  placeholder="Start (HH:MM)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] font-mono"
                />
                <input
                  type="text"
                  required
                  value={lunchEndField}
                  onChange={(e) => setLunchEndField(e.target.value)}
                  placeholder="End (HH:MM)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] mb-1">
                Dinner Hours (Wed-Mon, e.g. 17:30 to 21:00)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  value={dinnerStartField}
                  onChange={(e) => setDinnerStartField(e.target.value)}
                  placeholder="Start (HH:MM)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] font-mono"
                />
                <input
                  type="text"
                  required
                  value={dinnerEndField}
                  onChange={(e) => setDinnerEndField(e.target.value)}
                  placeholder="End (HH:MM)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E8E2D2] dark:border-[#3D352E] bg-[#FDFBF7] dark:bg-[#1C1917] text-sm text-[#2D2926] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E37A08] font-mono"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-xs shadow-sm transition-colors"
          >
            Save Configuration
          </button>
        </form>
      </div>

      {/* Device Mode Configuration */}
      <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#E37A08]/10 flex items-center justify-center">
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

        <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-3 mb-4 leading-relaxed">
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
    </div>
  );
};
