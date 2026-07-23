import React from 'react';

export const SkeletonCard: React.FC = () => (
  <div className="p-4 rounded-2xl bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] shadow-sm animate-pulse space-y-3">
    <div className="flex items-center justify-between">
      <div className="h-4 w-28 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-md" />
      <div className="h-5 w-16 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-full" />
    </div>
    <div className="h-3 w-3/4 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-md" />
    <div className="h-3 w-1/2 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-md" />
    <div className="pt-2 flex gap-2">
      <div className="h-8 flex-1 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-xl" />
      <div className="h-8 flex-1 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-xl" />
    </div>
  </div>
);

export const SkeletonFloorPlan: React.FC = () => (
  <div className="p-6 rounded-3xl bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] animate-pulse space-y-6">
    <div className="flex justify-between items-center">
      <div className="h-6 w-48 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-md" />
      <div className="h-8 w-24 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-xl" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-36 w-full bg-[#F5F2EA] dark:bg-[#1C1917] rounded-2xl border border-[#E8E2D2] dark:border-[#3D352E]" />
      ))}
    </div>
  </div>
);

export const SkeletonCustomerRow: React.FC = () => (
  <div className="p-4 rounded-2xl bg-white dark:bg-[#26221E] border border-[#E8E2D2] dark:border-[#3D352E] animate-pulse flex items-center justify-between">
    <div className="space-y-2">
      <div className="h-4 w-36 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-md" />
      <div className="h-3 w-24 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-md" />
    </div>
    <div className="h-8 w-20 bg-[#E8E2D2] dark:bg-[#3D352E] rounded-xl" />
  </div>
);
