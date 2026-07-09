import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CustomerView } from './components/customer/CustomerView';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { PINModal } from './components/admin/PINModal';
import { dataService } from './services/dataService';
import { Booking, AdminRole } from './types';

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [hash, setHash] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const isModeAdmin = params.get('mode') === 'admin';
    const isAdminDevice = localStorage.getItem('just_dosa_admin_device_v2') === 'true';
    if (isModeAdmin || isAdminDevice) {
      if (isModeAdmin) {
        localStorage.setItem('just_dosa_admin_device_v2', 'true');
      }
      return '#/admin';
    }
    return window.location.hash;
  });
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
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
    const params = new URLSearchParams(window.location.search);
    const isModeAdmin = params.get('mode') === 'admin';
    const isAdminDevice = localStorage.getItem('just_dosa_admin_device_v2') === 'true';

    let nextPathname = window.location.pathname;
    let nextHash = window.location.hash;
    let urlChanged = false;

    if (isModeAdmin || isAdminDevice) {
      if (isModeAdmin) {
        localStorage.setItem('just_dosa_admin_device_v2', 'true');
      }
      
      // Ensure pathname is '/' and hash is '#/admin' and search is empty
      if (window.location.pathname !== '/' || window.location.hash !== '#/admin' || window.location.search !== '') {
        window.history.replaceState({}, '', '/#/admin');
        nextPathname = '/';
        nextHash = '#/admin';
        urlChanged = true;
      }
    } else {
      // Normal customer mode
      // Let's check for combined path like /customer#/admin or /admin
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

    if (urlChanged || pathname !== nextPathname || hash !== nextHash) {
      setPathname(nextPathname);
      setHash(nextHash);
    }
  }, [pathname, hash]);

  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin') || hash === '#/admin' || hash === '#admin' || hash.startsWith('#/admin/') || hash.startsWith('#admin/');
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

  return (
    <div className="min-h-screen font-sans antialiased bg-[#1C1917] text-[#FDFBF7]">
      {/* Top Navbar */}
      <Navbar
        isAdminRoute={isAdminRoute}
        onNavigateHome={handleNavigateHome}
        onExitAdmin={handleExitAdmin}
        unreadCount={unreadCount}
        onResetDemo={handleResetDemo}
      />

      {/* Toast confirmation for Demo Reset */}
      {toastMsg && (
        <div className="fixed top-20 right-4 z-50 bg-[#E37A08] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-[#E37A08]/20 animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Main View Display */}
      <main>
        {isAdminRoute ? (
          isAdminAuthenticated && adminRole ? (
            <AdminDashboard adminRole={adminRole} onResetDemo={handleResetDemo} />
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
      <PINModal
        isOpen={isPinModalOpen}
        onSuccess={handlePinSuccess}
        onClose={handlePinClose}
      />
    </div>
  );
}
