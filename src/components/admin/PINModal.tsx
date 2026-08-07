import React, { useState, useEffect } from 'react';
import { Lock, Delete, Shield, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminRole } from '../../types';
import { dataService } from '../../services/dataService';
import { LOGO_BASE64 } from '../logoBase64';
import { getLockoutState, recordFailure, recordSuccess } from '../../utils/pinLockout';

// Helper hook to detect user reduced motion preference
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);
  return prefersReducedMotion;
}

interface PINModalProps {
  isOpen: boolean;
  onSuccess: (role: AdminRole) => void;
  onClose: () => void;
}

export const PINModal: React.FC<PINModalProps> = ({
  isOpen,
  onSuccess,
  onClose,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [step, setStep] = useState<'intro' | 'lock' | 'pin'>('intro');
  const [lockoutRemainingMs, setLockoutRemainingMs] = useState(0);

  const prefersReducedMotion = usePrefersReducedMotion();

  // Ticks the lockout countdown once a second while active; clears itself
  // once the cooldown expires so the keypad re-enables without needing a
  // fresh PIN digit to trigger a re-render.
  useEffect(() => {
    if (lockoutRemainingMs <= 0) return;
    const interval = setInterval(() => {
      const state = getLockoutState();
      setLockoutRemainingMs(state.locked ? state.remainingMs : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemainingMs > 0]);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setIsVerifying(false);
      const lockoutState = getLockoutState();
      setLockoutRemainingMs(lockoutState.locked ? lockoutState.remainingMs : 0);

      const skipIntro = sessionStorage.getItem('just_dosa_skip_welcome_intro') === 'true';
      if (skipIntro) {
        setStep('lock');
        sessionStorage.removeItem('just_dosa_skip_welcome_intro');
      } else {
        setStep('intro');
        // Let the intro stay on screen for about 1.2s before transition to lock step
        const timer = setTimeout(() => {
          setStep('lock');
        }, 1800); // 1.8s allows 400ms fade-in, 1s static, and transition out
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && !isVerifying && lockoutRemainingMs <= 0) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(false);

      // Auto-submit when exactly 4 digits are entered
      if (nextPin.length === 4) {
        setIsVerifying(true);
        setTimeout(async () => {
          try {
            const isOwner = await dataService.verifyOwnerPin(nextPin);
            const isStaff = await dataService.verifyStaffPin(nextPin);

            if (isOwner) {
              recordSuccess();
              dataService.logAuditEvent('pin.login.success', { role: 'owner' });
              onSuccess('owner');
              setPin('');
            } else if (isStaff) {
              recordSuccess();
              dataService.logAuditEvent('pin.login.success', { role: 'staff' });
              onSuccess('staff');
              setPin('');
            } else {
              const lockout = recordFailure();
              setLockoutRemainingMs(lockout.remainingMs);
              dataService.logAuditEvent(lockout.locked ? 'pin.login.lockout' : 'pin.login.failure');
              setError(true);
              setIsVerifying(false);
              // Shake effect will trigger, reset PIN after shake
              setTimeout(() => {
                setPin('');
              }, 800);
            }
          } catch (err) {
            console.error("Error verifying PIN: ", err);
            setError(true);
            setIsVerifying(false);
            setTimeout(() => {
              setPin('');
            }, 800);
          }
        }, 450);
      }
    }
  };

  const handleDelete = () => {
    if (pin.length > 0 && !isVerifying) {
      setPin(pin.slice(0, -1));
      setError(false);
    }
  };

  const handleClear = () => {
    if (!isVerifying) {
      setPin('');
      setError(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 overflow-hidden font-sans select-none text-white bg-stone-950"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=1920&q=80')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark warm overlay with step transitions */}
      <div 
        className={`absolute inset-0 z-0 bg-[#0F0D0C]/85 transition-all duration-1000 ${
          step === 'intro' ? 'bg-black/75' : 'bg-[#0F0D0C]/90'
        }`} 
      />



      <div className="w-full max-w-md z-10 flex flex-col items-center justify-center min-h-screen relative py-8">
        <AnimatePresence mode="wait">
          {step === 'intro' && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.05 }}
              transition={prefersReducedMotion ? { duration: 0.5 } : { type: 'spring', damping: 25, stiffness: 120 }}
              className="flex flex-col items-center justify-center text-center px-4"
            >
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-[#E37A08] uppercase mb-4 bg-[#E37A08]/15 px-4 py-1.5 rounded-full border border-[#E37A08]/20 backdrop-blur-xs"
              >
                JUST DOSA • MELBOURNE
              </motion.span>
              <motion.h1 
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.6 }}
                className="font-serif font-bold text-4xl sm:text-5.5xl text-white tracking-tight"
              >
                Welcome Team
              </motion.h1>
            </motion.div>
          )}

          {step === 'lock' && (
            <motion.div
              key="lock"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 25 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -25 }}
              transition={prefersReducedMotion ? { duration: 0.4 } : { type: 'spring', damping: 24, stiffness: 140 }}
              className="flex flex-col items-center justify-center text-center px-4 w-full"
            >
              {/* Branded elements staggering in */}
              <motion.div
                initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={prefersReducedMotion ? { duration: 0.4, delay: 0.1 } : { type: 'spring', damping: 20, stiffness: 120, delay: 0.1 }}
                className="mb-6 relative"
              >
                <div className="absolute inset-0 rounded-full bg-[#E37A08]/10 blur-2xl scale-125 animate-pulse" />
                <img 
                  src={LOGO_BASE64} 
                  alt="Just Dosa Logo" 
                  className="w-28 h-28 sm:w-32 sm:h-32 mx-auto drop-shadow-2xl relative select-none" 
                  referrerPolicy="no-referrer"
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.4, delay: 0.25 } : { type: 'spring', damping: 20, stiffness: 120, delay: 0.25 }}
                className="font-serif font-bold text-3xl sm:text-4xl text-white tracking-tight"
              >
                Just Dosa — Mill Park
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.4, delay: 0.35 } : { type: 'spring', damping: 20, stiffness: 120, delay: 0.35 }}
                className="text-sm text-[#E37A08] font-bold tracking-wide mt-2.5"
              >
                Authentic South Indian
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.4, delay: 0.45 } : { type: 'spring', damping: 20, stiffness: 120, delay: 0.45 }}
                className="text-xs text-white/50 tracking-[0.15em] uppercase font-bold mt-1.5"
              >
                Staff & Management Portal
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={prefersReducedMotion ? { duration: 0.4, delay: 0.6 } : { type: 'spring', damping: 20, stiffness: 120, delay: 0.6 }}
                className="mt-12 w-full flex flex-col items-center gap-3.5"
              >
                <motion.button
                  whileHover={{ scale: prefersReducedMotion ? 1 : 1.03 }}
                  whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
                  onClick={() => setStep('pin')}
                  className="relative flex items-center justify-center gap-2 px-14 py-4 rounded-2xl bg-gradient-to-r from-[#E37A08] via-[#FF9F3B] to-[#E37A08] text-white font-bold text-lg tracking-wider shadow-xl shadow-amber-950/40 border border-[#FFAB4A]/20 overflow-hidden cursor-pointer group w-full max-w-xs"
                >
                  {/* Shimmer element */}
                  {!prefersReducedMotion && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
                      style={{ skewX: -20 }}
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{
                        repeat: Infinity,
                        repeatType: 'loop',
                        duration: 2.2,
                        ease: 'linear',
                        delay: 0.1,
                      }}
                    />
                  )}
                  <Lock className="w-5 h-5 mr-1 text-white/90 group-hover:rotate-12 transition-transform duration-200" />
                  <span>Login</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: prefersReducedMotion ? 1 : 1.03 }}
                  whileTap={{ scale: prefersReducedMotion ? 1 : 0.97 }}
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 px-10 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white font-semibold text-sm border border-white/10 transition-all cursor-pointer w-full max-w-xs"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Main Menu</span>
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {step === 'pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -30 }}
              transition={prefersReducedMotion ? { duration: 0.4 } : { type: 'spring', damping: 25, stiffness: 150 }}
              className="w-full max-w-md bg-[#1C1917]/75 border border-white/10 rounded-[32px] shadow-2xl backdrop-blur-md overflow-hidden p-8 relative"
            >
              {/* Back to Lock Screen button */}
              <button
                type="button"
                onClick={() => setStep('lock')}
                className="absolute top-6 left-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-all duration-200 border border-white/10 cursor-pointer active:scale-90"
                title="Back to Lock Screen"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Upper Card Header Accent */}
              <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-[#8B4513] via-[#E37A08] to-[#8B4513] h-1.5" />

              <div className="flex flex-col items-center text-center mt-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-3xl bg-[#E37A08]/15 blur-xl scale-125 animate-pulse" />
                  <div className="w-14 h-14 rounded-2.5xl bg-white/5 border border-white/15 flex items-center justify-center mb-3.5 relative">
                    <Lock className="w-6 h-6 text-[#E37A08]" />
                  </div>
                </div>

                <span className="text-[9px] font-bold tracking-[0.2em] text-[#E37A08] uppercase mb-1.5 flex items-center gap-1.5 bg-[#E37A08]/15 px-3 py-1 rounded-full border border-[#E37A08]/20">
                  <Shield className="w-3 h-3" />
                  SECURE PORTAL
                </span>
                
                <h2 className="font-serif font-bold text-xl text-white mt-1">
                  Just Dosa Console
                </h2>
                <p className="text-[11px] text-white/60 mt-1 max-w-[260px]">
                  Access terminal for daily waitlist seating, live floor management, and reservations.
                </p>
              </div>

              {/* PIN Dots Area */}
              <div className="my-7 flex flex-col items-center">
                <div className="flex justify-center gap-4 h-12 items-center">
                  {[0, 1, 2, 3].map((idx) => {
                    const isFilled = idx < pin.length;
                    return (
                      <motion.div
                        key={idx}
                        animate={error ? { 
                          x: prefersReducedMotion ? 0 : [-8, 8, -6, 6, -4, 4, 0],
                          backgroundColor: ['#EF4444', '#EF4444', '#EF4444', '#EF4444', '#EF4444', '#EF4444', isFilled ? '#E37A08' : 'rgba(255,255,255,0.05)']
                        } : isVerifying ? {
                          scale: prefersReducedMotion ? 1 : [1, 1.2, 1],
                        } : {}}
                        transition={error ? { duration: 0.5 } : isVerifying ? { repeat: Infinity, duration: 0.6, delay: idx * 0.1 } : { type: 'spring', stiffness: 300, damping: 20 }}
                        className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
                          error
                            ? 'border-[#EF4444] bg-[#EF4444]'
                            : isFilled
                            ? 'bg-[#E37A08] border-[#E37A08] shadow-md shadow-[#E37A08]/30 scale-110'
                            : 'bg-white/5 border-white/20'
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Status Messages */}
                <div className="h-6 flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    {lockoutRemainingMs > 0 ? (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="text-xs font-bold text-[#EF4444] tracking-wider"
                      >
                        TOO MANY ATTEMPTS • TRY AGAIN IN {Math.ceil(lockoutRemainingMs / 1000)}S
                      </motion.p>
                    ) : error ? (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="text-xs font-bold text-[#EF4444] tracking-wider"
                      >
                        ACCESS DENIED • INCORRECT PIN
                      </motion.p>
                    ) : isVerifying ? (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs font-bold text-[#E37A08] tracking-widest animate-pulse flex items-center gap-1"
                      >
                        VERIFYING CREDENTIALS...
                      </motion.p>
                    ) : (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-[11px] font-medium text-white/50 tracking-wider"
                      >
                        Enter 4-digit PIN
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Glassmorphic Tactile Keypad */}
              <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumberClick(num.toString())}
                    disabled={isVerifying || lockoutRemainingMs > 0}
                    className="h-13 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-lg border border-white/10 shadow-xs hover:border-white/20 active:scale-95 transition-all duration-150 flex items-center justify-center cursor-pointer disabled:opacity-40"
                  >
                    {num}
                  </button>
                ))}

                {/* Clear Button */}
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={isVerifying || pin.length === 0 || lockoutRemainingMs > 0}
                  className="h-13 rounded-xl bg-white/5 hover:bg-[#EF4444]/15 hover:text-[#EF4444] hover:border-[#EF4444]/20 text-white/70 font-semibold text-xs border border-white/10 active:scale-95 transition-all duration-150 flex items-center justify-center cursor-pointer disabled:opacity-30"
                >
                  CLEAR
                </button>
                
                {/* Zero */}
                <button
                  type="button"
                  onClick={() => handleNumberClick('0')}
                  disabled={isVerifying || lockoutRemainingMs > 0}
                  className="h-13 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-lg border border-white/10 shadow-xs hover:border-white/20 active:scale-95 transition-all duration-150 flex items-center justify-center cursor-pointer disabled:opacity-40"
                >
                  0
                </button>
                
                {/* Backspace Button */}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isVerifying || pin.length === 0}
                  className="h-13 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 active:scale-95 transition-all duration-150 flex items-center justify-center cursor-pointer disabled:opacity-30"
                  title="Delete last digit"
                >
                  <Delete className="w-5 h-5" />
                </button>
              </div>


            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
