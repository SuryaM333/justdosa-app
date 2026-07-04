import React from 'react';
import { Users, Baby, Phone, Clock, MessageSquare, Check, Utensils, ExternalLink } from 'lucide-react';
import { Booking, Table } from '../../types';
import { dataService } from '../../services/dataService';
import { getWhatsAppUrl } from '../../utils/phone';
import { formatPartyBreakdown } from '../../utils/bookingUtils';

interface SeatedTabProps {
  bookings: Booking[];
  tables: Table[];
  onRefresh: () => void;
}

export const SeatedTab: React.FC<SeatedTabProps> = ({ bookings, tables, onRefresh }) => {
  const seatedList = bookings
    .filter((b) => b.status === 'seated')
    .sort((a, b) => {
      const timeA = a.seatedAt ? new Date(a.seatedAt).getTime() : 0;
      const timeB = b.seatedAt ? new Date(b.seatedAt).getTime() : 0;
      return timeB - timeA;
    });

  const getSeatedDuration = (seatedAt?: string): string => {
    if (!seatedAt) return '0m';
    const diffMins = Math.max(1, Math.round((Date.now() - new Date(seatedAt).getTime()) / 60000));
    return `${diffMins} mins`;
  };

  const handleFinish = (tableId?: number, name?: string) => {
    if (!tableId) return;
    dataService.finishSeatedParty(tableId);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#F5F2EA]/60 dark:bg-[#1C1917]/40 p-4 rounded-2xl border border-[#E8E2D2] dark:border-[#3D352E] flex items-center justify-between">
        <div>
          <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white flex items-center gap-2">
            <span>Currently Seated Parties</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-xs font-black">
              {seatedList.length} Tables Occupied
            </span>
          </h3>
          <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mt-0.5">
            Send instant WhatsApp notifications that their table is ready or mark parties as <strong>"Finished"</strong> when they leave to free the table.
          </p>
        </div>
      </div>

      {seatedList.length === 0 ? (
        <div className="bg-white dark:bg-[#26221E] rounded-3xl p-12 text-center border border-[#E8E2D2] dark:border-[#3D352E]">
          <div className="w-16 h-16 bg-[#F5F2EA] dark:bg-[#1C1917] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#6B5E4C]">
            <Utensils className="w-8 h-8" />
          </div>
          <h4 className="font-serif font-bold text-base text-[#2D2926] dark:text-white mb-1">
            No parties currently seated
          </h4>
          <p className="text-xs text-[#6B5E4C] max-w-sm mx-auto">
            When you allocate a table to a waiting customer on the Floor Plan, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {seatedList.map((booking) => {
            const table = tables.find((t) => t.id === booking.tableId);
            const waMsg = `Hi ${booking.firstName}, your table (Table ${booking.tableId}) at Just Dosa is ready! Please come to the host desk. 🥞🎉`;
            const waUrl = getWhatsAppUrl(booking.phone, waMsg);

            return (
              <div
                key={booking.id}
                className="bg-white dark:bg-[#26221E] rounded-2xl p-5 border-2 border-[#E8E2D2] dark:border-[#3D352E] shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E8E2D2] dark:border-[#3D352E]">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-md shadow-emerald-600/20 font-mono">
                        {booking.tableId ? `T${booking.tableId}` : 'T?'}
                      </div>
                      <div>
                        <span className="font-serif font-bold text-base text-[#2D2926] dark:text-white block leading-tight">
                          {booking.firstName} {booking.lastName}
                        </span>
                        <span className="text-[11px] text-[#6B5E4C] dark:text-[#B8ACA0] font-medium">
                          {table ? table.name : `Table ${booking.tableId}`} ({table?.capacity || 6} seats)
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-[#6B5E4C] block">
                        Duration
                      </span>
                      <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                        {getSeatedDuration(booking.seatedAt)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-[#6B5E4C] dark:text-[#B8ACA0] mb-4">
                    <div className="flex items-center gap-1.5 font-semibold text-[#2D2926] dark:text-zinc-200">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span>{formatPartyBreakdown(booking)}</span>
                      {((booking.childrenHighChairs?.filter(Boolean).length ?? booking.childSeats) > 0) && (
                        <span className="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 px-1.5 py-0.5 rounded text-xs font-bold border border-emerald-300 dark:border-emerald-800" title="High Chair Needed">
                          <Baby className="w-3.5 h-3.5" />
                          <span>High Chair</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 font-mono">
                      <Phone className="w-3.5 h-3.5 text-[#6B5E4C]" />
                      <span>{booking.phone}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-[#E8E2D2] dark:border-[#3D352E]">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-semibold text-xs border border-emerald-300 dark:border-emerald-800/60 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp "Table Ready!"</span>
                    <ExternalLink className="w-3 h-3 text-emerald-600" />
                  </a>

                  <button
                    onClick={() => handleFinish(booking.tableId, `${booking.firstName} ${booking.lastName}`)}
                    className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Finished</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
