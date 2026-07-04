import React, { useState } from 'react';
import { Search, ArrowUpDown, MessageSquare, ExternalLink, Sparkles, AlertTriangle, CheckCircle2, XCircle, Trash2, GitMerge } from 'lucide-react';
import { Customer } from '../../types';
import { getWhatsAppUrl } from '../../utils/phone';
import { dataService } from '../../services/dataService';

interface CustomersTabProps {
  customers: Record<string, Customer>;
  adminRole?: 'staff' | 'owner';
  onRefresh?: () => void;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({ customers, adminRole, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'visits' | 'lastVisit' | 'name'>('visits');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal / action states
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [mergePrimary, setMergePrimary] = useState<Customer | null>(null);
  const [mergeSecondary, setMergeSecondary] = useState<Customer | null>(null);
  const [keepPrimaryName, setKeepPrimaryName] = useState(true);

  const customerList: Customer[] = Object.values(customers);

  const getCleanPhone = (p: string) => p.replace(/\D/g, '');

  const getDuplicates = (cust: Customer) => {
    const cleaned = getCleanPhone(cust.phone);
    return customerList.filter(other => other.phone !== cust.phone && getCleanPhone(other.phone) === cleaned);
  };

  const isOwner = adminRole === 'owner';

  const filtered = customerList.filter((c: Customer) => {
    const s = searchTerm.toLowerCase();
    const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
    const cleanPhone = c.phone.replace(/\D/g, '');
    return fullName.includes(s) || cleanPhone.includes(s) || c.phone.includes(s);
  });

  const sorted = [...filtered].sort((a: Customer, b: Customer) => {
    let comparison = 0;
    if (sortBy === 'visits') {
      comparison = b.totalVisits - a.totalVisits;
    } else if (sortBy === 'lastVisit') {
      comparison = new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime();
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
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const handleDeleteConfirm = () => {
    if (!customerToDelete) return;
    dataService.deleteCustomer(customerToDelete.phone);
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

  return (
    <div className="space-y-4">
      {/* Top filter & stats bar */}
      <div className="bg-white dark:bg-[#26221E] rounded-2xl p-4 border border-[#E8E2D2] dark:border-[#3D352E] flex flex-col sm:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#6B5E4C] absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F2EA] dark:bg-[#1C1917] border border-[#E8E2D2] dark:border-[#3D352E] text-sm focus:outline-none focus:ring-2 focus:ring-[#E37A08] text-[#2D2926] dark:text-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-[#6B5E4C] font-semibold uppercase tracking-wider shrink-0">
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

        {sorted.length === 0 ? (
          <div className="p-12 text-center text-[#6B5E4C] text-sm">
            No customer records found matching "{searchTerm}".
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

              return (
                <div
                  key={cust.phone}
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
                        {isRegular && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-[#E37A08] text-white shadow-sm">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>REGULAR</span>
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
                        <span className="font-mono text-[#2D2926] dark:text-zinc-300">{cust.phone}</span>
                        <span>Total Visits: <strong className="text-[#8B4513] dark:text-[#D2B48C] font-bold">{cust.totalVisits}</strong></span>
                        <span>Last Visit: <strong className="text-[#2D2926] dark:text-zinc-300">{formatDate(cust.lastVisitDate)}</strong></span>
                      </div>
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
    </div>
  );
};
