import React, { useEffect, useState } from 'react';
import { User, Phone, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { dataService, CustomerSuggestion } from '../services/dataService';

interface CustomerAutoSuggestProps {
  query: string;
  onSelect: (suggestion: CustomerSuggestion) => void;
  onClose?: () => void;
  className?: string;
}

export const CustomerAutoSuggest: React.FC<CustomerAutoSuggestProps> = ({
  query,
  onSelect,
  onClose,
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const results = dataService.searchCustomerSuggestions(query);
    setSuggestions(results);
  }, [query]);

  if (suggestions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -5, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -5, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className={`absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-2xl shadow-xl overflow-hidden ${className}`}
      >
        <div className="px-3 py-1.5 bg-[#F5F2EA] dark:bg-[#1C1917] border-b border-[#E8E2D2] dark:border-[#3D352E] text-[10px] font-bold uppercase tracking-wider text-[#8B4513] dark:text-[#D2B48C] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#E37A08]" />
            Matched Customer Profiles
          </span>
          <span>Click to Auto-fill</span>
        </div>

        <div className="max-h-56 overflow-y-auto divide-y divide-[#E8E2D2]/50 dark:divide-[#3D352E]/50">
          {suggestions.map((s, idx) => (
            <button
              key={`${s.phone}_${idx}`}
              type="button"
              onClick={() => {
                onSelect(s);
                if (onClose) onClose();
              }}
              className="w-full text-left p-3 hover:bg-[#FDFBF7] dark:hover:bg-[#1C1917] transition-colors flex items-start justify-between gap-2 group cursor-pointer"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-xs text-[#2D2926] dark:text-white group-hover:text-[#E37A08] transition-colors">
                    {s.firstName} {s.lastName}
                  </span>
                  {s.totalVisits && s.totalVisits > 1 && (
                    <span className="px-1.5 py-0.2 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-[9px] font-black rounded-full">
                      {s.totalVisits} visits
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-[#6B5E4C] dark:text-[#B8ACA0]">
                  <Phone className="w-3 h-3 text-zinc-400" />
                  <span>{s.phone}</span>
                </div>

                {(s.allergies || s.notes) && (
                  <div className="flex items-center gap-2 pt-1 text-[10px]">
                    {s.allergies && (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" />
                        {s.allergies}
                      </span>
                    )}
                    {s.notes && (
                      <span className="text-[#6B5E4C] dark:text-[#B8ACA0] font-medium italic flex items-center gap-0.5 truncate max-w-[180px]">
                        <FileText className="w-2.5 h-2.5" />
                        {s.notes}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <span className="text-[10px] font-bold text-[#E37A08] opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
                Auto-fill ↵
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
