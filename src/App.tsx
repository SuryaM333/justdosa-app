import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CustomerView } from './components/customer/CustomerView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { PINModal } from './components/admin/PINModal';
import { dataService } from './services/dataService';
import { Booking, AdminRole } from './types';
import { LOGO_BASE64 } from './components/logoBase64';

export default function App() {
  const isCustomerOnly = (import.meta as any).env.VITE_APP_MODE === 'customer';

  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [hash, setHash] = useState(() => {
    if (isCustomerOnly) {
      return '';
    }
    const params = new URLSearchParams(window.location.search);
    const isModeAdmin = params.get('mode') === 'admin';
    const isAdminDevice = localStorage.getItem('just_dosa_admin_device_v2') === 'true';
    const hasAdminHash = window.location.hash === '#/admin' || window.location.hash === '#admin' || window.location.hash.startsWith('#/admin/') || window.location.hash.startsWith('#admin/');

    if (isModeAdmin || (isAdminDevice && hasAdminHash)) {
      return '#/admin';
    }
    return window.location.hash;
  });
  const [showStaffChoice, setShowStaffChoice] = useState(() => {
    if (isCustomerOnly) {
      return false;
    }
    const params = new URLSearchParams(window.location.search);
    const isModeAdmin = params.get('mode') === 'admin';
    const isAdminDevice = localStorage.getItem('just_dosa_admin_device_v2') === 'true';
    const hasAdminHash = window.location.hash === '#/admin' || window.location.hash === '#admin' || window.location.hash.startsWith('#/admin/') || window.location.hash.startsWith('#admin/');

    return isAdminDevice && !isModeAdmin && !hasAdminHash;
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    if (isCustomerOnly) {
      return false;
    }
    const auth = sessionStorage.getItem('just_dosa_admin_auth') === 'true';
    const authTime = sessionStorage.getItem('just_dosa_admin_auth_time');
    if (auth && authTime) {
      const timeElapsed = Date.now() - parseInt(authTime, 10);
      if (timeElapsed < 12 * 60 * 60 * 1000) {
        return true;
      }
    }
    // Otherwise clear any saved state to invalidate session
    sessionStorage.removeItem('just_dosa_admin_auth');
    sessionStorage.removeItem('just_dosa_admin_role');
    sessionStorage.removeItem('just_dosa_admin_auth_time');
    return false;
  });
  const [adminRole, setAdminRole] = useState<AdminRole | null>(() => {
    if (isCustomerOnly) {
      return null;
    }
    const auth = sessionStorage.getItem('just_dosa_admin_auth') === 'true';
    const authTime = sessionStorage.getItem('just_dosa_admin_auth_time');
    if (auth && authTime) {
      const timeElapsed = Date.now() - parseInt(authTime, 10);
      if (timeElapsed < 12 * 60 * 60 * 1000) {
        return (sessionStorage.getItem('just_dosa_admin_role') as AdminRole) || null;
      }
    }
    return null;
  });
  
  const [modeChoice, setModeChoice] = useState<'customer' | null>(() => {
    if (isCustomerOnly) {
      return 'customer';
    }
    return (sessionStorage.getItem('just_dosa_mode_choice') as 'customer' | null) || null;
  });

  const isDarkMode = true;
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    // Set dark mode class on html/body
    document.documentElement.classList.add('dark');

    const updateUnread = () => {
      const bookings: Booking[] = dataService.getBookings();
      const count = bookings.filter((b) => b.isNewAlert && (b.status === 'waiting' || b.status === 'booked')).length;
      setUnreadCount(count);
    };

    updateUnread();
    const unsubscribe = dataService.subscribe(updateUnread);

    const handleLocationChange = () => {
      setPathname(window.location.pathname);
      setHash(window.location.hash);
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);

    const handleWriteError = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string }>;
      setToastMsg(customEvent.detail?.message || 'Something went wrong, please try again or see staff.');
      setTimeout(() => setToastMsg(null), 5000);
    };
    window.addEventListener('justDosaWriteError', handleWriteError);

    return () => {
      unsubscribe();
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('justDosaWriteError', handleWriteError);
    };
  }, [isDarkMode]);

  // Session timeout checking useEffect
  useEffect(() => {
    if (isAdminAuthenticated) {
      const checkSession = () => {
        const auth = sessionStorage.getItem('just_dosa_admin_auth') === 'true';
        const authTime = sessionStorage.getItem('just_dosa_admin_auth_time');
        if (auth && authTime) {
          const timeElapsed = Date.now() - parseInt(authTime, 10);
          if (timeElapsed >= 12 * 60 * 60 * 1000) {
            sessionStorage.removeItem('just_dosa_admin_auth');
            sessionStorage.removeItem('just_dosa_admin_role');
            sessionStorage.removeItem('just_dosa_admin_auth_time');
            setIsAdminAuthenticated(false);
            setAdminRole(null);
          }
        } else {
          sessionStorage.removeItem('just_dosa_admin_auth');
          sessionStorage.removeItem('just_dosa_admin_role');
          sessionStorage.removeItem('just_dosa_admin_auth_time');
          setIsAdminAuthenticated(false);
          setAdminRole(null);
        }
      };

      checkSession();
      const interval = setInterval(checkSession, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (isCustomerOnly) {
      const hasLeftoverAdminHash = window.location.hash === '#/admin' || window.location.hash === '#admin' || window.location.hash.startsWith('#/admin/') || window.location.hash.startsWith('#admin/');
      const isNotRootPath = window.location.pathname !== '/';
      const hasSearchParams = window.location.search !== '';

      if (hasLeftoverAdminHash || isNotRootPath || hasSearchParams) {
        window.history.replaceState({}, '', '/');
        if (pathname !== '/' || hash !== '') {
          setPathname('/');
          setHash('');
        }
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const isModeAdmin = params.get('mode') === 'admin';
    const isAdminDevice = localStorage.getItem('just_dosa_admin_device_v2') === 'true';
    const hasAdminHash = window.location.hash === '#/admin' || window.location.hash === '#admin' || window.location.hash.startsWith('#/admin/') || window.location.hash.startsWith('#admin/');

    let nextPathname = window.location.pathname;
    let nextHash = window.location.hash;
    let urlChanged = false;

    // Check if we should show staff choice screen
    if (isAdminDevice && !isModeAdmin && !hasAdminHash && !showStaffChoice) {
      setShowStaffChoice(true);
    }

    if (isModeAdmin || (isAdminDevice && hasAdminHash)) {
      // Ensure pathname is '/' and hash is '#/admin' and search is empty
      if (window.location.pathname !== '/' || window.location.hash !== '#/admin' || window.location.search !== '') {
        window.history.replaceState({}, '', '/#/admin');
        nextPathname = '/';
        nextHash = '#/admin';
        urlChanged = true;
      }
    } else {
      // Normal customer mode or bare customer URL on admin device
      if (isAdminDevice && !isModeAdmin && !hasAdminHash) {
         // Bare URL: keep it bare and don't redirect to lock screen
        if (window.location.pathname !== '/' || window.location.search !== '') {
          window.history.replaceState({}, '', '/');
          nextPathname = '/';
          nextHash = '';
          urlChanged = true;
        }
      } else {
        // Normal customer mode
        const hasLeftoverAdminHash = window.location.hash === '#/admin' || window.location.hash === '#admin';
        const isNotRootPath = window.location.pathname !== '/';
        const hasSearchParams = window.location.search !== '';
        
        if (isNotRootPath || hasSearchParams) {
          // If we have a non-root path combined with an admin hash, clear the hash too!
          const targetHash = hasLeftoverAdminHash ? '' : window.location.hash;
          const cleanURL = '/' + targetHash;
          window.history.replaceState({}, '', cleanURL);
          nextPathname = '/';
          nextHash = targetHash;
          urlChanged = true;
        }
      }
    }

    if (urlChanged || pathname !== nextPathname || hash !== nextHash) {
      setPathname(nextPathname);
      setHash(nextHash);
    }
  }, [pathname, hash, showStaffChoice]);

  const isAdminRoute = !isCustomerOnly && (pathname === '/admin' || pathname.startsWith('/admin') || hash === '#/admin' || hash === '#admin' || hash.startsWith('#/admin/') || hash.startsWith('#admin/'));
  const isPinModalOpen = isAdminRoute && !isAdminAuthenticated;

  const handlePinSuccess = (role: AdminRole) => {
    sessionStorage.setItem('just_dosa_admin_auth', 'true');
    sessionStorage.setItem('just_dosa_admin_role', role);
    sessionStorage.setItem('just_dosa_admin_auth_time', Date.now().toString());
    localStorage.setItem('just_dosa_admin_device_v2', 'true');
    setIsAdminAuthenticated(true);
    setAdminRole(role);
  };

  const handlePinClose = () => {
    sessionStorage.removeItem('just_dosa_mode_choice');
    setModeChoice(null);
    window.history.pushState({}, '', '/');
    setPathname('/');
    setHash('');
  };

  const handleNavigateHome = () => {
    window.history.pushState({}, '', '/');
    setPathname('/');
    setHash('');
  };

  const handleExitAdmin = () => {
    sessionStorage.removeItem('just_dosa_admin_auth');
    sessionStorage.removeItem('just_dosa_admin_role');
    sessionStorage.removeItem('just_dosa_admin_auth_time');
    sessionStorage.removeItem('just_dosa_staff_name');
    setIsAdminAuthenticated(false);
    setAdminRole(null);
    window.history.replaceState({}, '', '/#/admin');
    setPathname('/');
    setHash('#/admin');
  };

  const handleResetDemo = () => {
    dataService.resetToSeedData();
    localStorage.removeItem('just_dosa_active_customer_booking_id');
    setToastMsg('Database cleared and reset successfully!');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const isModeChoiceActive = !isCustomerOnly && !isAdminRoute && !isAdminAuthenticated && !showStaffChoice && modeChoice !== 'customer';

  return (
    <div className="min-h-screen font-sans antialiased bg-[#1C1917] text-[#FDFBF7]">
      {/* Top Navbar */}
      {!isModeChoiceActive && (
        <Navbar
          isAdminRoute={isAdminRoute}
          onNavigateHome={handleNavigateHome}
          onExitAdmin={handleExitAdmin}
          unreadCount={unreadCount}
        />
      )}

      {/* Toast confirmation for Demo Reset */}
      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 bg-[#E37A08] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-[#E37A08]/20 animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Main View Display */}
      <main>
        {isModeChoiceActive ? (
          <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#1C1917]">
            <div className="w-full max-w-md p-8 rounded-3xl bg-[#2D2926] border border-[#E8E2D2]/10 shadow-2xl text-center space-y-8 animate-fade-in">
              {/* Branding */}
              <div className="space-y-4">
                <div className="w-36 h-36 mx-auto flex items-center justify-center bg-transparent shrink-0 select-none relative">
                  <div className="absolute inset-0 rounded-full bg-[#E37A08]/5 blur-xl scale-125 animate-pulse" />
                  <img src={LOGO_BASE64} alt="Just Dosa Logo" className="w-full h-full object-contain drop-shadow-md animate-[pulse_3s_infinite]" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <span className="inline-block px-3 py-1 rounded-md bg-[#E37A08]/10 text-[#E37A08] border border-[#E37A08]/20 text-xs font-bold uppercase tracking-widest mb-3">
                    Mill Park • Melbourne
                  </span>
                  <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    Just Dosa
                  </h1>
                  <p className="text-xs text-[#B8ACA0] uppercase tracking-widest font-semibold mt-1">
                    Authentic South Indian
                  </p>
                </div>
              </div>

              {/* Message */}
              <div className="text-sm text-[#B8ACA0] leading-relaxed max-w-xs mx-auto">
                Welcome to Just Dosa Mill Park. Please select a mode to enter the terminal.
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3.5 pt-2">
                <button
                  onClick={() => {
                    sessionStorage.setItem('just_dosa_mode_choice', 'customer');
                    setModeChoice('customer');
                  }}
                  className="w-full py-4.5 px-6 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-base shadow-lg shadow-[#E37A08]/15 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span>Customer view</span>
                </button>
                
                <button
                  onClick={() => {
                    window.history.pushState({}, '', '/#/admin');
                    setPathname('/');
                    setHash('#/admin');
                  }}
                  className="w-full py-4.5 px-6 rounded-xl bg-transparent hover:bg-white/5 text-[#B8ACA0] hover:text-white font-bold text-base border border-[#E8E2D2]/10 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Staff / Admin</span>
                </button>
              </div>
            </div>
          </div>
        ) : showStaffChoice && !isAdminRoute ? (
          <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-[#1C1917]">
            <div className="w-full max-w-md p-8 rounded-3xl bg-[#2D2926] border border-[#E8E2D2]/10 shadow-2xl text-center space-y-6 animate-fade-in">
              <div className="w-16 h-16 bg-[#E37A08]/10 rounded-full flex items-center justify-center mx-auto text-[#E37A08]">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              
              <div className="space-y-2">
                <h2 className="font-serif text-2xl font-bold text-[#FDFBF7]">
                  Staff Terminal Setup
                </h2>
                <p className="text-sm text-[#B8ACA0] leading-relaxed">
                  This device is set up as a staff terminal. How would you like to proceed?
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowStaffChoice(false);
                    window.history.pushState({}, '', '/#/admin');
                    setPathname('/');
                    setHash('#/admin');
                  }}
                  className="w-full py-4 px-5 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-bold text-sm shadow-lg shadow-[#E37A08]/10 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Continue to staff login
                </button>
                
                <button
                  onClick={() => {
                    localStorage.removeItem('just_dosa_admin_device_v2');
                    sessionStorage.setItem('just_dosa_mode_choice', 'customer');
                    setModeChoice('customer');
                    setShowStaffChoice(false);
                  }}
                  className="w-full py-4 px-5 rounded-xl bg-transparent hover:bg-white/5 text-[#B8ACA0] hover:text-[#FDFBF7] font-semibold text-sm border border-[#E8E2D2]/10 transition-all active:scale-[0.98] cursor-pointer"
                >
                  Use as customer
                </button>
              </div>
            </div>
          </div>
        ) : isAdminRoute ? (
          isAdminAuthenticated && adminRole ? (
            <AdminDashboard adminRole={adminRole} />
          ) : (
            <div className="min-h-[70vh] flex items-center justify-center">
              <p className="text-sm text-[#8B4513] dark:text-[#D2B48C] font-medium animate-pulse">
                Awaiting Admin PIN Authentication...
              </p>
            </div>
          )
        ) : (
          <CustomerView />
        )}
      </main>

      {/* Admin PIN Authentication Modal */}
      {!isCustomerOnly && (
        <PINModal
          isOpen={isPinModalOpen}
          onSuccess={handlePinSuccess}
          onClose={handlePinClose}
        />
      )}
    </div>
  );
}
