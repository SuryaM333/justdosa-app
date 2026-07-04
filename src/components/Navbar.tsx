import React from 'react';
import { Utensils, Lock, QrCode, Moon, Sun, RotateCcw, Bell } from 'lucide-react';
import { LOGO_BASE64 } from './logoBase64';

interface NavbarProps {
  isAdminRoute?: boolean;
  onNavigateHome?: () => void;
  onExitAdmin?: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  unreadCount: number;
  onResetDemo: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdminRoute = false,
  onNavigateHome,
  onExitAdmin,
  isDarkMode,
  onToggleDarkMode,
  unreadCount,
  onResetDemo,
}) => {
  return (
    <header className={`sticky top-0 z-50 border-b transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-[#1C1917]/90 border-[#3D352E] text-[#FDFBF7]' 
        : 'bg-[#FDFBF7]/90 border-[#E8E2D2] text-[#2D2926]'
    } backdrop-blur-md`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={onNavigateHome}
        >
          <div className="w-11 h-11 rounded-xl bg-transparent flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform shrink-0">
            <img src={LOGO_BASE64} alt="Just Dosa Logo" className={isAdminRoute ? "w-8 h-8 object-contain" : "w-10 h-10 object-contain"} referrerPolicy="no-referrer" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-xl sm:text-2xl tracking-tight text-[#8B4513] dark:text-[#D2B48C]">
                Just Dosa
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-semibold bg-[#8B4513]/10 dark:bg-[#D2B48C]/10 text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E]">
                Melbourne
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-[#A1917B] font-semibold hidden sm:block">
              Authentic South Indian • Mill Park, Melbourne
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAdminRoute && (
            <button
              onClick={onExitAdmin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F5F2EA] dark:bg-[#26221E] text-xs font-bold text-[#8B4513] dark:text-[#D2B48C] hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] transition-colors border border-[#E8E2D2] dark:border-[#3D352E] shadow-xs"
              title="Exit Admin to Customer View"
            >
              <span>Exit Admin</span>
            </button>
          )}

          {/* Reset Demo Data Button (Subtle tool for tester) */}
          <button
            onClick={onResetDemo}
            title="Reset Demo Data to Initial State"
            className="p-2 rounded-xl text-[#6B5E4C] hover:text-[#E37A08] dark:text-[#B8ACA0] dark:hover:text-[#D2B48C] hover:bg-[#F5F2EA] dark:hover:bg-[#26221E] transition-colors border border-transparent hover:border-[#E8E2D2]"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={onToggleDarkMode}
            title="Toggle Dark Mode"
            className="p-2 rounded-xl text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#F5F2EA] dark:hover:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-[#D2B48C]" /> : <Moon className="w-4 h-4 text-[#6B5E4C]" />}
          </button>
        </div>
      </div>
    </header>
  );
};
