import React from 'react';

export const PREDEFINED_QUICK_NOTES = [
  'High Chair Needed',
  'Quiet Corner',
  'Wheelchair Access',
  'Birthday Celebration',
  'Window Table',
  'No Spicy / Mild',
  'Nut Allergy',
  'Gluten Free',
  'Near Entrance'
];

interface QuickNotesProps {
  currentNotes: string;
  onNotesChange: (updated: string) => void;
  label?: string;
}

export const QuickNotesSelector: React.FC<QuickNotesProps> = ({ 
  currentNotes, 
  onNotesChange, 
  label = 'Quick Notes & Special Requests:' 
}) => {
  const toggleNote = (note: string) => {
    const existing = currentNotes 
      ? currentNotes.split(',').map(s => s.trim()).filter(Boolean) 
      : [];
    
    let updated: string[];
    if (existing.includes(note)) {
      updated = existing.filter(n => n !== note);
    } else {
      updated = [...existing, note];
    }
    onNotesChange(updated.join(', '));
  };

  const existingList = currentNotes 
    ? currentNotes.split(',').map(s => s.trim()) 
    : [];

  return (
    <div className="space-y-1.5 my-2">
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#6B5E4C] dark:text-[#B8ACA0]">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {PREDEFINED_QUICK_NOTES.map((note) => {
          const isSelected = existingList.includes(note);
          return (
            <button
              key={note}
              type="button"
              onClick={() => toggleNote(note)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border select-none active:scale-95 ${
                isSelected
                  ? 'bg-[#E37A08] text-white border-[#E37A08] shadow-xs'
                  : 'bg-[#FDFBF7] dark:bg-[#1C1917] text-[#2D2926] dark:text-[#D2B48C] border-[#E8E2D2] dark:border-[#3D352E] hover:border-[#E37A08]/50'
              }`}
            >
              {isSelected ? '✓ ' : '+ '}{note}
            </button>
          );
        })}
      </div>
    </div>
  );
};
