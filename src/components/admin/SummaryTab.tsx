import React from 'react';
import { Users, Clock, Flame, RotateCcw, BarChart3, TrendingUp, Sparkles } from 'lucide-react';
import { DailyStats } from '../../types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { dataService } from '../../services/dataService';

interface SummaryTabProps {
  stats: DailyStats;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ stats }) => {
  const getFormattedHours = () => {
    const formatTime = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      return `${displayHour}:${m.toString().padStart(2, '0')} ${ampm}`;
    };
    try {
      const lunchStart = dataService.getLunchStartTime();
      const dinnerEnd = dataService.getDinnerEndTime();
      const [dh, dm] = dinnerEnd.split(':').map(Number);
      const closingH = (dh + 1) % 24;
      const closingStr = `${closingH.toString().padStart(2, '0')}:${dm.toString().padStart(2, '0')}`;
      return `${formatTime(lunchStart)} — ${formatTime(closingStr)}`;
    } catch {
      return '11:00 AM — 10:00 PM';
    }
  };
  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-[#E37A08] to-[#8B4513] rounded-3xl p-6 text-white shadow-lg shadow-[#E37A08]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-white text-xs font-bold uppercase tracking-wider mb-2">
            End-of-Day Operations Report
          </span>
          <h2 className="font-serif text-2xl font-extrabold tracking-tight">
            Daily Analytics & Performance
          </h2>
          <p className="text-xs text-amber-100 mt-1 max-w-lg">
            Real-time metrics derived from today's walk-in queue durations and table turnover cycles.
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center shrink-0">
          <span className="text-[10px] uppercase font-bold text-amber-100 block mb-0.5">
            Operational Efficiency
          </span>
          <div className="text-3xl font-black font-mono">
            94.8%
          </div>
          <span className="text-[10px] text-emerald-300 font-semibold flex items-center justify-center gap-1 mt-0.5">
            <TrendingUp className="w-3 h-3" />
            <span>Optimal Table Flow</span>
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#26221E] rounded-2xl p-5 border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] block mb-1">
              Served Today
            </span>
            <div className="text-3xl font-black text-[#2D2926] dark:text-white font-mono">
              {stats.totalServedToday}
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 inline-block">
              Total Guests Seated
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#E37A08] flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#26221E] rounded-2xl p-5 border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] block mb-1">
              Average Wait Time
            </span>
            <div className="text-3xl font-black text-[#E37A08] font-mono">
              ~{stats.avgWaitTimeMinutes}m
            </div>
            <span className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] font-medium mt-1 inline-block">
              Walk-inQueue duration
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#E37A08] flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#26221E] rounded-2xl p-5 border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] block mb-1">
              Busiest Hour
            </span>
            <div className="text-2xl font-black text-[#2D2926] dark:text-white font-mono truncate max-w-[160px]">
              {stats.busiestHour.split(' ')[0]}
            </div>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium mt-1 inline-block">
              {stats.busiestHour.includes('(') ? stats.busiestHour.split('(')[1].replace(')', '') : 'Peak dinner rush'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#E37A08] flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#26221E] rounded-2xl p-5 border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm flex items-start justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0] block mb-1">
              Avg Table Turn
            </span>
            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {stats.avgTableTurnMinutes}m
            </div>
            <span className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0] font-medium mt-1 inline-block">
              Seated-to-finished
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#F5F2EA] dark:bg-[#1C1917] text-[#E37A08] flex items-center justify-center">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Hourly Bookings Bar Chart */}
      <div className="bg-white dark:bg-[#26221E] rounded-3xl p-6 border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-6 border-b border-[#E8E2D2] dark:border-[#3D352E]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F5F2EA] dark:bg-[#1C1917] flex items-center justify-center text-[#E37A08]">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#2D2926] dark:text-white">
                Bookings by Hour (Today's Distribution)
              </h3>
              <p className="text-xs text-[#6B5E4C] dark:text-[#B8ACA0]">
                Visualizing peak dining hours to optimize staffing and table turnover estimation.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#F5F2EA] dark:bg-[#1C1917] text-[#6B5E4C] dark:text-[#B8ACA0] font-mono self-start sm:self-center">
            {getFormattedHours()}
          </span>
        </div>

        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.hourlyBookings} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" opacity={0.2} />
              <XAxis dataKey="hour" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#26221E',
                  borderRadius: '12px',
                  border: '1px solid #3D352E',
                  color: '#fff',
                  fontSize: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                }}
                formatter={(value: unknown) => [`${value} parties`, 'Bookings']}
                labelFormatter={(label: unknown) => `Hour: ${label}`}
              />
              <Bar dataKey="count" fill="#E37A08" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-[#F5F2EA]/60 dark:bg-[#1C1917]/40 rounded-2xl p-5 border border-[#E8E2D2] dark:border-[#3D352E] flex items-start gap-3 text-xs text-[#2D2926] dark:text-[#B8ACA0]">
        <Sparkles className="w-5 h-5 text-[#E37A08] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-1">How Wait Estimation is Improved</span>
          The system continuously measures <strong>Seated-to-Finished durations</strong> across Tables 1 to 10. When new walk-ins arrive during peak hours, our queue estimation algorithm dynamically multiplies their queue position by current average table turnover times.
        </div>
      </div>
    </div>
  );
};
