import React, { useState } from 'react';
import { Search, ArrowUpDown, MessageSquare, ExternalLink, Sparkles, AlertTriangle, CheckCircle2, XCircle, Trash2, GitMerge, Edit3, ShieldAlert, Download } from 'lucide-react';
import { Customer, Booking } from '../../types';
import { getWhatsAppUrl } from '../../utils/phone';
import { dataService } from '../../services/dataService';
import { parseToDate, safeFormatDate } from '../../utils/dateUtils';

interface CustomersTabProps {
  customers: Record<string, Customer>;
  bookings?: Booking[];
  adminRole?: 'staff' | 'owner';
  onRefresh?: () => void;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({ customers, bookings, adminRole, onRefresh }) => {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState<'visits' | 'lastVisit' | 'name'>('visits');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Debounce search input for instant responsiveness without keystroke lag
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Modal / action states
  const [customerToDelete, setCustomerToDelete] = useState<(Customer & { _docId: string }) | null>(null);
  const [mergePrimary, setMergePrimary] = useState<Customer | null>(null);
  const [mergeSecondary, setMergeSecondary] = useState<Customer | null>(null);
  const [keepPrimaryName, setKeepPrimaryName] = useState(true);

  // Profile Edit states
  const [customerToEdit, setCustomerToEdit] = useState<(Customer & { _docId: string }) | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [allergies, setAllergies] = useState('');
  const [notes, setNotes] = useState('');

  // Anonymous walk-ins (no phone collected) are keyed by booking id, not
  // phone, so every list/lookup below needs the real doc id, not just
  // `phone` -- otherwise every anonymous record (all sharing phone: '')
  // would collide as "duplicates" of each other and share one React key.
  const customerList: (Customer & { _docId: string })[] = Object.entries(customers).map(([docId, c]: [string, Customer]) => ({ ...c, _docId: docId }));

  const getCleanPhone = (p: string) => p.replace(/\D/g, '');

  const getDuplicates = (cust: Customer & { _docId: string }) => {
    if (cust.isAnonymous || !cust.phone) return [];
    const cleaned = getCleanPhone(cust.phone);
    return customerList.filter(other => !other.isAnonymous && other.phone !== cust.phone && getCleanPhone(other.phone) === cleaned);
  };

  const isOwner = adminRole === 'owner';

  const filtered = customerList.filter((c: Customer) => {
    const s = debouncedSearch.toLowerCase();
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    const cleanPhone = c.phone.replace(/\D/g, '');
    return fullName.includes(s) || cleanPhone.includes(s) || c.phone.includes(s);
  });

  const sorted = [...filtered].sort((a: Customer, b: Customer) => {
    let comparison = 0;
    if (sortBy === 'visits') {
      comparison = b.totalVisits - a.totalVisits;
    } else if (sortBy === 'lastVisit') {
      const timeA = parseToDate(a.lastVisitDate)?.getTime() || 0;
      const timeB = parseToDate(b.lastVisitDate)?.getTime() || 0;
      comparison = timeB - timeA;
    } else if (sortBy === 'name') {
      comparison = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    }
    return sortOrder === 'desc' ? comparison : -comparison;
  });

  const toggleSort = (field: 'visits' | 'lastVisit' | 'name') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatDate = (isoStr: string) => {
    return safeFormatDate(isoStr);
  };

  const handleDeleteConfirm = () => {
    if (!customerToDelete) return;
    dataService.deleteCustomer(customerToDelete._docId);
    setCustomerToDelete(null);
    if (onRefresh) onRefresh();
  };

  const handleMergeConfirm = () => {
    if (!mergePrimary || !mergeSecondary) return;
    dataService.mergeCustomers(mergePrimary.phone, mergeSecondary.phone, keepPrimaryName);
    setMergePrimary(null);
    setMergeSecondary(null);
    if (onRefresh) onRefresh();
  };

  const handleSaveProfile = async () => {
    if (!customerToEdit) return;
    await dataService.updateCustomer(customerToEdit._docId, {
      isVip,
      allergies: allergies.trim() || undefined,
      notes: notes.trim() || undefined
    });
    setCustomerToEdit(null);
    if (onRefresh) onRefresh();
  };

  const handleExportCSV = () => {
    const headers = [
      'First Name',
      'Last Name',
      'Phone / WhatsApp',
      'Total Visits',
      'Last Visit Date',
      'VIP Status',
      'Allergies / Preferences',
      'Notes',
      'WhatsApp Opt-In',
      'No-Show Count',
      'Visit History Details'
    ];

    const rows = sorted.map((c) => {
      const custBookings = bookings ? bookings.filter(b => b.phone === c.phone) : [];
      const visitHistoryStr = custBookings.map(b => {
        const dateStr = b.bookingDate || safeFormatDate(b.createdAt);
        const timeStr = b.timeSlot || '';
        return `${dateStr}${timeStr ? ' @ ' + timeStr : ''} (Party: ${b.partySize}, Table: ${b.tableId || 'N/A'}, Status: ${b.status}${b.handledBy ? ', By: ' + b.handledBy : ''})`;
      }).join('; ');

      return [
        `"${(c.firstName || '').replace(/"/g, '""')}"`,
        `"${(c.lastName || '').replace(/"/g, '""')}"`,
        `"${(c.phone || '').replace(/"/g, '""')}"`,
        c.totalVisits || 0,
        `"${(formatDate(c.lastVisitDate) || '').replace(/"/g, '""')}"`,
        c.isVip ? 'YES' : 'NO',
        `"${(c.allergies || '').replace(/"/g, '""')}"`,
        `"${(c.notes || '').replace(/"/g, '""')}"`,
        c.whatsappOptIn ? 'YES' : 'NO',
        c.noShowCount || 0,
        `"${visitHistoryStr.replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `just_dosa_customer_data_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Top filter & stats bar */}
      <div className="bg-white dark:bg-[#26221E] rounded-2xl p-4 border border-[#E8E2D2] dark:border-[#3D352E] flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#6B5E4C] absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-sm focus:outline-none focus:ring-2 focus:ring-[#E37A08] text-[#2D2926] dark:text-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {isOwner ? (
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 rounded-xl bg-[#8B4513] hover:bg-[#6e360e] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0 cursor-pointer"
              title="Export full customer dataset to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1 border border-amber-500/20 shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Staff Mode (Restricted Data)</span>
            </span>
          )}

          <span className="text-xs text-[#6B5E4C] font-semibold uppercase tracking-wider shrink-0 ml-2">
            Sort by:
          </span>
          <button
            onClick={() => toggleSort('visits')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
              sortBy === 'visits'
                ? 'bg-[#E37A08] text-white shadow-sm'
                : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#E8E2D2] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <span>Total Visits</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => toggleSort('lastVisit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
              sortBy === 'lastVisit'
                ? 'bg-[#E37A08] text-white shadow-sm'
                : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#E8E2D2] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <span>Last Visit</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => toggleSort('name')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
              sortBy === 'name'
                ? 'bg-[#E37A08] text-white shadow-sm'
                : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] hover:bg-[#E8E2D2] border border-[#E8E2D2] dark:border-[#3D352E]'
            }`}
          >
            <span>Name</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Database list / table */}
      <div className="bg-white dark:bg-[#26221E] rounded-3xl border border-[#E8E2D2] dark:border-[#3D352E] overflow-hidden shadow-sm">
        <div className="p-4 bg-[#F5F2EA] dark:bg-[#1C1917] border-b border-[#E8E2D2] dark:border-[#3D352E] text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] flex justify-between items-center">
          <span>Customer Database ({sorted.length} records)</span>
          <span>Loyalty & CRM Controls</span>
        </div>

        {customerList.length === 0 ? (
          <div className="p-12 text-center text-[#6B5E4C] text-sm space-y-2">
            <p className="font-serif font-bold text-[#2D2926] dark:text-white text-base">No customers yet</p>
            <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] max-w-sm mx-auto">
              As guests make bookings or join the waiting queue, their loyalty profiles and visit history will automatically appear here.
            </p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center text-[#6B5E4C] text-sm">
            No customer records found matching "{searchInput}".
          </div>
        ) : (
          <div className="divide-y divide-[#E8E2D2] dark:divide-[#3D352E]/60">
            {sorted.map((cust) => {
              const isRegular = cust.totalVisits >= 5;
              const waUrl = getWhatsAppUrl(
                cust.phone,
                `Hi ${cust.firstName}, thanks for visiting Just Dosa Melbourne! Check out our new weekend dosa specials. 🥞✨`
              );

              const duplicateRecords = getDuplicates(cust);
              const hasDup = duplicateRecords.length > 0;
              // Anonymous walk-ins are keyed by booking id (see dataService's
              // finishSeatedParty), so their one visit is matched by that id
              // instead of phone (every anonymous record shares phone: '').
              const custBookings = (bookings || []).filter((b) =>
                cust.isAnonymous ? cust._docId === `anon-${b.id}` : b.phone === cust.phone
              );
              const sourceLabel = (s?: string) => s === 'online' ? 'QR / Online' : s === 'phone/staff' ? 'Phone' : s === 'walk-in' ? 'Walk-in' : null;

              return (
                <div
                  key={cust._docId}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F5F2EA]/50 dark:hover:bg-[#1C1917]/50 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-sm ${
                      isRegular
                        ? 'bg-[#E37A08] text-white shadow-md shadow-[#E37A08]/20'
                        : 'bg-[#F5F2EA] dark:bg-[#1C1917] text-[#2D2926] dark:text-[#B8ACA0] border border-[#E8E2D2] dark:border-[#3D352E]'
                     }`}>
                      {cust.firstName ? cust.firstName[0] : '?'}{cust.lastName ? cust.lastName[0] : ''}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-serif font-bold text-base text-[#2D2926] dark:text-white">
                          {cust.firstName} {cust.lastName}
                        </span>
                        {cust.isVip && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-md shadow-amber-500/20 animate-pulse">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>★ VIP</span>
                          </span>
                        )}
                        {isRegular && !cust.isVip && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-[#E37A08] text-white shadow-sm">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>REGULAR</span>
                          </span>
                        )}
                        {cust.isAnonymous && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700" title="Walk-in seated without a phone number -- can't be matched to future visits">
                            <span>Walk-in (no phone)</span>
                          </span>
                        )}
                        {cust.noShowCount > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800" title="Has prior no-shows">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{cust.noShowCount} No-show{cust.noShowCount > 1 ? 's' : ''}</span>
                          </span>
                        )}
                        {hasDup && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Possible Duplicate</span>
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B5E4C] dark:text-[#B8ACA0] font-medium">
                        <span className="font-mono text-[#2D2926] dark:text-zinc-300">
                          {!isOwner ? '•••• — Manager access required' : (cust.phone || '—')}
                        </span>
                        <span>Total Visits: <strong className="text-[#8B4513] dark:text-[#D2B48C] font-bold">{cust.totalVisits}</strong></span>
                        <span>Last Visit: <strong className="text-[#2D2926] dark:text-zinc-300">{isOwner ? formatDate(cust.lastVisitDate) : '••••'}</strong></span>
                      </div>

                      {isOwner ? (
                        (cust.allergies || cust.notes) && (
                          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                            {cust.allergies && (
                              <span className="bg-rose-500/10 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/40 font-semibold flex items-center gap-1">
                                <span>⚠️ Pref:</span>
                                <span>{cust.allergies}</span>
                              </span>
                            )}
                            {cust.notes && (
                              <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-medium flex items-center gap-1">
                                <span>📝 Notes:</span>
                                <span>{cust.notes}</span>
                              </span>
                            )}
                          </div>
                        )
                      ) : (
                        (cust.allergies || cust.notes) && (
                          <div className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                            Preferences & Notes: •••• — Manager access required
                          </div>
                        )
                      )}

                      {/* Past Visits / Booking History (Owner only) */}
                      {isOwner && custBookings.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-dashed border-[#E8E2D2] dark:border-[#3D352E]/65 max-w-lg">
                          <span className="text-[10px] uppercase font-bold text-[#6B5E4C] dark:text-[#B8ACA0] block mb-1">
                            Visit History & Staff Logs
                          </span>
                          <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
                            {custBookings
                              .sort((a, b) => {
                                const timeA = parseToDate(a.createdAt)?.getTime() || 0;
                                const timeB = parseToDate(b.createdAt)?.getTime() || 0;
                                return timeB - timeA;
                              })
                              .map(b => (
                                <div key={b.id} className="flex items-center justify-between text-[11px] bg-[#F5F2EA]/40 dark:bg-[#1C1917]/40 px-2 py-1 rounded border border-[#E8E2D2]/50 dark:border-[#3D352E]/30">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[#E37A08] font-bold">
                                      {b.bookingDate || formatDate(b.createdAt)}
                                    </span>
                                    <span className="text-zinc-400">•</span>
                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                      Party of {b.partySize}
                                    </span>
                                    {b.tableId && (
                                      <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1 rounded text-[10px] font-bold">
                                        T{b.tableId}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      b.status === 'finished' || b.status === 'seated'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : b.status === 'no-show'
                                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                                        : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                                    }`}>
                                      {b.status}
                                    </span>
                                    {sourceLabel(b.source) && (
                                      <span className="px-1 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/10 text-blue-700 dark:text-blue-400" title="How this booking was made">
                                        {sourceLabel(b.source)}
                                      </span>
                                    )}
                                    {b.handledBy && (
                                      <span className="text-zinc-500 text-[10px] italic">
                                        by {b.handledBy}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right badges & WhatsApp & Management buttons */}
                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E8E2D2] dark:border-[#3D352E]">
                    <div className="flex items-center gap-1.5">
                      {cust.whatsappOptIn ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800/60" title="Opted in for WhatsApp offers">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WhatsApp Opt-In</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] text-[11px] font-medium border border-[#E8E2D2] dark:border-[#3D352E]" title="Did not opt-in for marketing">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>No Marketing</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isOwner && (
                        <button
                          onClick={() => {
                            setCustomerToEdit(cust);
                            setIsVip(!!cust.isVip);
                            setAllergies(cust.allergies || '');
                            setNotes(cust.notes || '');
                          }}
                          className="py-2 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-400 font-semibold text-xs transition-all flex items-center gap-1 shrink-0 border border-amber-500/30 cursor-pointer"
                          title="Edit CRM Profile & VIP details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Profile</span>
                        </button>
                      )}

                      {isOwner && cust.phone && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 shrink-0"
                          title="Send WhatsApp message"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                          <ExternalLink className="w-3 h-3 opacity-80" />
                        </a>
                      )}

                      {/* Owner actions ONLY */}
                      {isOwner && (
                        <>
                          {hasDup && (
                            <button
                              onClick={() => {
                                setMergePrimary(cust);
                                setMergeSecondary(duplicateRecords[0]);
                                setKeepPrimaryName(true);
                              }}
                              className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/60 transition-all"
                              title="Merge with duplicate record"
                            >
                              <GitMerge className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setCustomerToDelete(cust)}
                            className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-800/60 transition-all"
                            title="Delete customer record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DELETE CONFIRMATION DIALOG */}
      {customerToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 max-w-md w-full shadow-2xl text-center">
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif font-bold text-zinc-900 dark:text-white mb-2">
              Delete Customer Record?
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
              Are you sure you want to delete the record for <strong>{customerToDelete.firstName} {customerToDelete.lastName}</strong> ({customerToDelete.phone})? This action is permanent and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCustomerToDelete(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm shadow-md transition-colors"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MERGE CONFIRMATION DIALOG */}
      {mergePrimary && mergeSecondary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 max-w-lg w-full shadow-2xl text-left">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-950/60 text-amber-600 rounded-2xl flex items-center justify-center mb-4 border border-amber-200 dark:border-amber-800">
              <GitMerge className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-bold text-zinc-900 dark:text-white mb-2">
              Merge Duplicate Customer Records
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">
              We detected duplicate records sharing a cleaned phone number. Merging will combine total visits, no-shows, and booking history under one primary record.
            </p>

            {/* Selection details */}
            <div className="space-y-3 bg-[#F5F2EA] dark:bg-[#1C1917] p-4 rounded-2xl border border-[#E8E2D2] dark:border-[#3D352E] mb-5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-800 dark:text-amber-400 block mb-1">
                Choose Name to Preserve:
              </span>
              
              <label className="flex items-start gap-3 p-2.5 rounded-xl bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] cursor-pointer">
                <input
                  type="radio"
                  name="keepName"
                  checked={keepPrimaryName}
                  onChange={() => setKeepPrimaryName(true)}
                  className="mt-1 accent-[#E37A08]"
                />
                <div className="text-xs">
                  <p className="font-bold text-zinc-900 dark:text-white">{mergePrimary.firstName} {mergePrimary.lastName}</p>
                  <p className="text-[10px] text-zinc-500">{mergePrimary.phone} • {mergePrimary.totalVisits} visits</p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-2.5 rounded-xl bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] cursor-pointer">
                <input
                  type="radio"
                  name="keepName"
                  checked={!keepPrimaryName}
                  onChange={() => setKeepPrimaryName(false)}
                  className="mt-1 accent-[#E37A08]"
                />
                <div className="text-xs">
                  <p className="font-bold text-zinc-900 dark:text-white">{mergeSecondary.firstName} {mergeSecondary.lastName}</p>
                  <p className="text-[10px] text-zinc-500">{mergeSecondary.phone} • {mergeSecondary.totalVisits} visits</p>
                </div>
              </label>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3.5 rounded-xl text-xs text-amber-800 dark:text-amber-300 mb-6 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold">Merge Outcomes:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] opacity-90">
                  <li>Total visits will be combined to <strong>{(mergePrimary.totalVisits || 0) + (mergeSecondary.totalVisits || 0)}</strong>.</li>
                  <li>Prior no-shows & cancellations will be summed.</li>
                  <li>Latest visit date will be preserved.</li>
                  <li>All future and past reservation names will map to the chosen name.</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setMergePrimary(null);
                  setMergeSecondary(null);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleMergeConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-semibold text-sm shadow-md transition-colors text-center"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER PROFILE EDITOR MODAL */}
      {customerToEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <h3 className="text-xl font-serif font-bold text-zinc-900 dark:text-white mb-2 flex items-center gap-2">
              <span className="text-amber-500">★</span> Customer Profile Editor
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
              Configure loyalty CRM tags, allergies, and staff notes for <strong>{customerToEdit.firstName} {customerToEdit.lastName}</strong> ({customerToEdit.phone}).
            </p>

            <div className="space-y-4 mb-6 text-left">
              {/* VIP Toggle */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] cursor-pointer">
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400 animate-pulse" />
                    <span>VIP Customer Badge</span>
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Highlights guest as VIP across booking lists
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isVip}
                  onChange={(e) => setIsVip(e.target.checked)}
                  className="w-5 h-5 accent-amber-500 cursor-pointer rounded border-[#E8E2D2]"
                />
              </label>

              {/* Allergies & Preferences */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                  Allergies & CRM Preferences
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gluten-free, prefers window table, peanut allergy"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-zinc-950 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all"
                />
              </div>

              {/* General Staff Notes */}
              <div className="text-left">
                <label className="block text-xs font-semibold text-[#6B5E4C] dark:text-[#B8ACA0] uppercase tracking-wider mb-1.5">
                  Staff Notes (Internal CRM Notes)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Highly valued customer, CEO friend, prefers mild spice level"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#FDFBF7] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-zinc-950 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#E37A08] transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCustomerToEdit(null)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveProfile}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#E37A08] hover:bg-[#c96906] text-white font-semibold text-sm shadow-md transition-colors"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
