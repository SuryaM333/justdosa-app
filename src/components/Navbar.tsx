import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { LOGO_BASE64 } from './logoBase64';

interface NavbarProps {
  isAdminRoute?: boolean;
  onNavigateHome?: () => void;
  onExitAdmin?: () => void;
  unreadCount: number;
  onGoToModeChoice?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isAdminRoute = false,
  onNavigateHome,
  onExitAdmin,
  unreadCount,
  onGoToModeChoice,
}) => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('just_dosa_theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark');
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('just_dosa_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('just_dosa_theme', 'light');
    }
  }, [isDark]);

  const toggleDarkMode = () => {
    setIsDark(prev => !prev);
  };
  return (
    <header className="sticky top-0 z-50 border-b bg-[#1C1917]/90 border-[#3D352E] text-[#FDFBF7] backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Left header group */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onGoToModeChoice && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onGoToModeChoice();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#26221E] hover:bg-[#3D352E] text-xs font-bold text-[#D2B48C] hover:text-[#FF9F3B] transition-all border border-[#3D352E] shadow-sm cursor-pointer mr-1 sm:mr-2"
              title="Return to Mode Choice Screen"
            >
              <svg className="w-3.5 h-3.5 text-[#D2B48C]/95" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span>Menu</span>
            </button>
          )}

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
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dark Mode Toggle Button */}
          <button
            onClick={toggleDarkMode}
            className="p-2.5 rounded-xl bg-[#26221E] hover:bg-[#3D352E] text-[#D2B48C] hover:text-[#FF9F3B] transition-all border border-[#3D352E] shadow-sm cursor-pointer flex items-center justify-center"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle dark mode"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-[#D2B48C]" />
            )}
          </button>

          {isAdminRoute && (
            <button
              onClick={onExitAdmin}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#26221E] text-xs font-bold text-[#D2B48C] hover:bg-[#3D352E] transition-colors border border-[#3D352E] shadow-xs cursor-pointer"
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
