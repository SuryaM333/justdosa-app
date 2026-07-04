import React, { useState, useEffect } from 'react';
import { Lock, Delete, X, Shield, KeyRound, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminRole } from '../../types';
import { dataService } from '../../services/dataService';

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

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const staffPin = dataService.getStaffPin();
  const ownerPin = dataService.getOwnerPin();

  const handleNumberClick = (num: string) => {
    if (pin.length < 4 && !isVerifying) {
      const nextPin = pin + num;
      setPin(nextPin);
      setError(false);
      
      // Auto-submit when exactly 4 digits are entered
      if (nextPin.length === 4) {
        setIsVerifying(true);
        setTimeout(() => {
          if (nextPin === ownerPin) {
            onSuccess('owner');
            setPin('');
          } else if (nextPin === staffPin) {
            onSuccess('staff');
            setPin('');
          } else {
            setError(true);
            setIsVerifying(false);
            // Shake effect will trigger, reset PIN after shake
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/85 backdrop-blur-md p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 180 }}
        className="w-full max-w-md bg-[#FFFDF7] dark:bg-[#26221E] rounded-[32px] shadow-2xl border border-[#E8E2D2] dark:border-[#3D352E] overflow-hidden"
      >
        {/* Upper Card Header Accent */}
        <div className="bg-gradient-to-r from-[#8B4513] via-[#E37A08] to-[#8B4513] p-1 h-2 w-full" />

        <div className="p-8 relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 rounded-full bg-[#F5F2EA] dark:bg-[#1C1917] hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-[#6B5E4C] dark:text-[#B8ACA0] transition-colors border border-[#E8E2D2]/60 dark:border-[#3D352E]/60"
            title="Cancel and return home"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Badge */}
          <div className="flex flex-col items-center text-center mt-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-[#E37A08]/10 blur-xl scale-125 animate-pulse" />
              <div className="w-16 h-16 rounded-3xl bg-[#E37A08]/10 dark:bg-[#E37A08]/20 border border-[#E37A08]/20 dark:border-[#E37A08]/40 flex items-center justify-center mb-4 relative">
                <Lock className="w-7 h-7 text-[#E37A08]" />
              </div>
            </div>

            <span className="text-[10px] font-bold tracking-[0.2em] text-[#E37A08] uppercase mb-1 flex items-center gap-1.5 bg-[#E37A08]/10 dark:bg-[#E37A08]/20 px-3 py-1 rounded-full">
              <Shield className="w-3 h-3" />
              SECURE PORTAL
            </span>
            
            <h2 className="font-serif font-bold text-2xl text-[#2D2926] dark:text-white mt-2">
              Just Dosa Console
            </h2>
            <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-1.5 max-w-[280px]">
              Access terminal for daily waitlist seating, live floor management, and reservations.
            </p>
          </div>

          {/* PIN Dots Area */}
          <div className="my-8 flex flex-col items-center">
            <div className="flex justify-center gap-4 h-12 items-center">
              {[0, 1, 2, 3].map((idx) => {
                const isFilled = idx < pin.length;
                return (
                  <motion.div
                    key={idx}
                    animate={error ? { 
                      x: [-10, 10, -8, 8, -5, 5, 0],
                      backgroundColor: ['#EF4444', '#EF4444', '#EF4444', '#EF4444', '#EF4444', '#EF4444', isFilled ? '#E37A08' : '#F5F2EA']
                    } : isVerifying ? {
                      scale: [1, 1.2, 1],
                    } : {}}
                    transition={error ? { duration: 0.5 } : isVerifying ? { repeat: Infinity, duration: 0.6, delay: idx * 0.1 } : { type: 'spring', stiffness: 300, damping: 20 }}
                    className={`w-4.5 h-4.5 rounded-full border-2 transition-all duration-200 ${
                      error
                        ? 'border-[#EF4444] bg-[#EF4444]'
                        : isFilled
                        ? 'bg-[#E37A08] border-[#E37A08] shadow-md shadow-[#E37A08]/30 scale-110'
                        : 'bg-[#F5F2EA] dark:bg-[#1C1917] border-[#E8E2D2] dark:border-[#3D352E]'
                    }`}
                  />
                );
              })}
            </div>

            {/* Status Messages */}
            <div className="h-6 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {error ? (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="text-xs font-semibold text-[#EF4444] tracking-wide"
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
                    className="text-[11px] font-medium text-[#6B5E4C] dark:text-[#B8ACA0] tracking-wider"
                  >
                    Enter 4-digit PIN
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Custom Luxury Tactile Keypad */}
          <div className="grid grid-cols-3 gap-3.5 max-w-[290px] mx-auto">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberClick(num.toString())}
                disabled={isVerifying}
                className="h-14 rounded-2xl bg-white dark:bg-[#1C1917] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] hover:text-[#E37A08] dark:hover:text-[#D2B48C] text-lg font-bold text-[#2D2926] dark:text-white transition-all duration-150 flex items-center justify-center active:scale-90 border border-[#E8E2D2]/80 dark:border-[#3D352E] shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            
            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              disabled={isVerifying || pin.length === 0}
              className="h-14 rounded-2xl bg-[#F5F2EA]/50 dark:bg-[#1C1917]/50 hover:bg-[#EF4444]/10 hover:text-[#EF4444] text-[#6B5E4C] dark:text-[#B8ACA0] font-semibold text-xs transition-all duration-150 flex items-center justify-center active:scale-90 border border-[#E8E2D2]/40 dark:border-[#3D352E]/40 disabled:opacity-30 cursor-pointer"
            >
              CLEAR
            </button>
            
            {/* Zero */}
            <button
              type="button"
              onClick={() => handleNumberClick('0')}
              disabled={isVerifying}
              className="h-14 rounded-2xl bg-white dark:bg-[#1C1917] hover:bg-[#F5F2EA] dark:hover:bg-[#3D352E] hover:text-[#E37A08] dark:hover:text-[#D2B48C] text-lg font-bold text-[#2D2926] dark:text-white transition-all duration-150 flex items-center justify-center active:scale-90 border border-[#E8E2D2]/80 dark:border-[#3D352E] shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
            >
              0
            </button>
            
            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={isVerifying || pin.length === 0}
              className="h-14 rounded-2xl bg-[#F5F2EA]/50 dark:bg-[#1C1917]/50 hover:bg-[#E8E2D2] dark:hover:bg-[#3D352E] text-[#6B5E4C] dark:text-[#B8ACA0] transition-all duration-150 flex items-center justify-center active:scale-90 border border-[#E8E2D2]/40 dark:border-[#3D352E]/40 disabled:opacity-30 cursor-pointer"
              title="Delete last digit"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Sandbox Guide Badge */}
          <div className="mt-8 pt-4 border-t border-[#E8E2D2]/60 dark:border-[#3D352E]/60 flex flex-col items-center">
            <span className="text-[10px] font-bold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#E37A08]" />
              Sandboxed Testing Credentials
            </span>
            <div className="flex gap-2 text-[11px] font-mono">
              <span className="px-2 py-1 rounded-md bg-[#F5F2EA] dark:bg-[#1C1917] text-[#8B4513] dark:text-[#D2B48C] border border-[#E8E2D2] dark:border-[#3D352E]">
                Staff: ••••
              </span>
              <span className="px-2 py-1 rounded-md bg-[#F5F2EA] dark:bg-[#1C1917] text-[#E37A08] border border-[#E8E2D2] dark:border-[#3D352E]">
                Manager: ••••
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
