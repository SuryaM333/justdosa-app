import React from 'react';
import { LOGO_BASE64 } from './logoBase64';

interface NavbarProps {
  isAdminRoute?: boolean;
  onNavigateHome?: () => void;
  onExitAdmin?: () => void;
  unreadCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdminRoute = false,
  onNavigateHome,
  onExitAdmin,
  unreadCount,
}) => {
  return (
    <header className="sticky top-0 z-50 border-b bg-[#1C1917]/90 border-[#3D352E] text-[#FDFBF7] backdrop-blur-md">
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
              <span className="font-serif font-bold text-xl sm:text-2xl tracking-tight text-[#D2B48C]">
                Just Dosa
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md font-semibold bg-[#D2B48C]/10 text-[#D2B48C] border border-[#3D352E]">
                Melbourne
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-[#B8ACA0] font-semibold hidden sm:block">
              Authentic South Indian • Mill Park, Melbourne
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAdminRoute && (
            <button
              onClick={onExitAdmin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#26221E] text-xs font-bold text-[#D2B48C] hover:bg-[#3D352E] transition-colors border border-[#3D352E] shadow-xs"
              title="Exit Admin to Customer View"
            >
              <span>Exit Admin</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
