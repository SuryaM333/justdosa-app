import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Garnish {
  emoji: string;
  label: string;
  xPercent: number; // CSS percentage position relative to center
  yPercent: number;
  scale: number;
  speedFactor: number; // 1.5x or 0.7x travel speed
  rotateStart: number;
  rotateEnd: number;
}

interface Dish {
  id: string;
  name: string;
  description: string;
  image: string;
  bgColor: string; // Soft light background wash
  bgColorDark: string; // Soft dark background wash
  textColor: string;
  textColorDark: string;
  garnishes: Garnish[];
}

const DISHES: Dish[] = [
  {
    id: 'masala-dosa',
    name: 'Masala Dosa',
    description: 'Crispy, golden rice crepe rolled with spiced potatoes, served with fresh coconut chutney & sambar.',
    image: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(254, 243, 199, 0.45)', // soft turmeric yellow
    bgColorDark: 'rgba(217, 119, 6, 0.12)',
    textColor: '#B45309',
    textColorDark: '#FBBF24',
    garnishes: [
      { emoji: '🌿', label: 'curry-leaf', xPercent: -35, yPercent: -30, scale: 1.1, speedFactor: 1.5, rotateStart: -45, rotateEnd: 15 },
      { emoji: '🌶️', label: 'red-chilli', xPercent: 38, yPercent: 25, scale: 1.2, speedFactor: 0.7, rotateStart: 30, rotateEnd: -20 },
      { emoji: '✨', label: 'ghee', xPercent: -28, yPercent: 35, scale: 0.9, speedFactor: 1.2, rotateStart: 0, rotateEnd: 45 }
    ]
  },
  {
    id: 'idli-sambar',
    name: 'Idly Sambar',
    description: 'Pillowy soft steamed rice cakes served with our robust, spice-infused vegetable lentil broth.',
    image: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(245, 245, 240, 0.55)', // soft off-white/cream
    bgColorDark: 'rgba(245, 245, 240, 0.08)',
    textColor: '#4B5563',
    textColorDark: '#E5E7EB',
    garnishes: [
      { emoji: '🥥', label: 'coconut', xPercent: -40, yPercent: 15, scale: 1.0, speedFactor: 1.5, rotateStart: 60, rotateEnd: -15 },
      { emoji: '🌿', label: 'curry-leaf', xPercent: 32, yPercent: -35, scale: 1.1, speedFactor: 0.7, rotateStart: -30, rotateEnd: 30 },
      { emoji: '⚪', label: 'mustard', xPercent: 25, yPercent: 38, scale: 0.8, speedFactor: 1.3, rotateStart: 0, rotateEnd: 90 }
    ]
  },
  {
    id: 'medu-vada',
    name: 'Medu Vada',
    description: 'Crispy-on-the-outside, fluffy-on-the-inside spiced black lentil fritters seasoned with fresh black pepper.',
    image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(254, 226, 226, 0.45)', // soft chilli red
    bgColorDark: 'rgba(220, 38, 38, 0.12)',
    textColor: '#DC2626',
    textColorDark: '#FCA5A5',
    garnishes: [
      { emoji: '🌶️', label: 'green-chilli', xPercent: -35, yPercent: -25, scale: 1.1, speedFactor: 1.5, rotateStart: -60, rotateEnd: 45 },
      { emoji: '🌿', label: 'curry-leaf', xPercent: 38, yPercent: -15, scale: 1.0, speedFactor: 0.7, rotateStart: 15, rotateEnd: -45 },
      { emoji: '⚫', label: 'black-pepper', xPercent: -20, yPercent: 40, scale: 0.9, speedFactor: 1.2, rotateStart: 0, rotateEnd: 60 }
    ]
  },
  {
    id: 'chicken-biryani',
    name: 'Kalyana Veetu Chicken Biryani',
    description: 'Rich, highly aromatic wedding-style chicken biryani cooked with premium long-grain basmati rice and rich spices.',
    image: 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(251, 191, 36, 0.35)', // golden yellow
    bgColorDark: 'rgba(245, 158, 11, 0.1)',
    textColor: '#92400E',
    textColorDark: '#FDE68A',
    garnishes: [
      { emoji: '🧅', label: 'onion', xPercent: -35, yPercent: -20, scale: 1.1, speedFactor: 1.4, rotateStart: -30, rotateEnd: 45 },
      { emoji: '🍃', label: 'mint', xPercent: 35, yPercent: 30, scale: 1.1, speedFactor: 0.8, rotateStart: 15, rotateEnd: -30 },
      { emoji: '🍗', label: 'chicken', xPercent: -25, yPercent: 35, scale: 1.0, speedFactor: 1.2, rotateStart: 0, rotateEnd: 90 }
    ]
  },
  {
    id: 'goat-biryani',
    name: 'Seeraga Samba Goat Biryani',
    description: 'Traditional Tamil Nadu wedding style mutton biryani prepared with fragrant short-grain Seeraga Samba rice and tender slow-cooked goat.',
    image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(217, 119, 6, 0.35)', // warm amber
    bgColorDark: 'rgba(180, 83, 9, 0.1)',
    textColor: '#78350F',
    textColorDark: '#FCD34D',
    garnishes: [
      { emoji: '🍖', label: 'mutton', xPercent: -40, yPercent: -15, scale: 1.0, speedFactor: 1.5, rotateStart: -15, rotateEnd: 60 },
      { emoji: '🌿', label: 'mint-leaf', xPercent: 32, yPercent: -30, scale: 1.2, speedFactor: 0.7, rotateStart: 45, rotateEnd: -45 },
      { emoji: '✨', label: 'ghee', xPercent: 22, yPercent: 35, scale: 0.9, speedFactor: 1.3, rotateStart: 0, rotateEnd: 120 }
    ]
  },
  {
    id: 'benne-dosa',
    name: 'Benne Dosa',
    description: 'Delectably crisp and fluffy Davanagere style butter dosa served with classic potato palya and spicy tomato chutney.',
    image: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(253, 230, 138, 0.45)', // soft butter yellow
    bgColorDark: 'rgba(245, 158, 11, 0.08)',
    textColor: '#A16207',
    textColorDark: '#FEF08A',
    garnishes: [
      { emoji: '🧈', label: 'butter', xPercent: -32, yPercent: -25, scale: 1.1, speedFactor: 1.3, rotateStart: -30, rotateEnd: 30 },
      { emoji: '🥔', label: 'potato', xPercent: 36, yPercent: 20, scale: 1.0, speedFactor: 0.8, rotateStart: 0, rotateEnd: -60 },
      { emoji: '✨', label: 'sparkle', xPercent: -15, yPercent: 38, scale: 0.9, speedFactor: 1.2, rotateStart: 45, rotateEnd: 180 }
    ]
  },
  {
    id: 'masala-tea',
    name: 'Masala Tea',
    description: 'Aromatic, strong South Indian style milk tea boiled with fresh ginger, crushed cardamom pods, and spices.',
    image: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(168, 110, 77, 0.35)', // ginger/chai brown
    bgColorDark: 'rgba(139, 92, 26, 0.1)',
    textColor: '#5C3A21',
    textColorDark: '#DDBB99',
    garnishes: [
      { emoji: '🪵', label: 'cinnamon', xPercent: -36, yPercent: -30, scale: 1.1, speedFactor: 1.5, rotateStart: -45, rotateEnd: 45 },
      { emoji: '☕', label: 'tea', xPercent: 35, yPercent: -15, scale: 1.1, speedFactor: 0.6, rotateStart: 15, rotateEnd: -15 },
      { emoji: '🫚', label: 'ginger', xPercent: -20, yPercent: 36, scale: 1.0, speedFactor: 1.3, rotateStart: 0, rotateEnd: 90 }
    ]
  },
  {
    id: 'pallipalayam-chicken',
    name: 'Pallipalayam Chicken',
    description: 'Spicy dry-fried chicken delicacy from Kongunadu, cooked with shallow red chillies, shallots, and fresh coconut slices.',
    image: 'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(239, 68, 68, 0.35)', // spicy chili red
    bgColorDark: 'rgba(185, 28, 28, 0.12)',
    textColor: '#991B1B',
    textColorDark: '#FCA5A5',
    garnishes: [
      { emoji: '🌶️', label: 'red-chili', xPercent: -35, yPercent: -20, scale: 1.2, speedFactor: 1.5, rotateStart: -90, rotateEnd: 15 },
      { emoji: '🥥', label: 'coconut', xPercent: 38, yPercent: -10, scale: 1.1, speedFactor: 0.7, rotateStart: 30, rotateEnd: -60 },
      { emoji: '🌿', label: 'curry-leaf', xPercent: -18, yPercent: 40, scale: 1.0, speedFactor: 1.2, rotateStart: 0, rotateEnd: 45 }
    ]
  },
  {
    id: 'kalyana-virundhu',
    name: 'Kalyana Virundhu',
    description: 'The ultimate grand wedding feast served traditionally on a fresh banana leaf with an array of curries, payasam, and papadum.',
    image: 'https://images.unsplash.com/photo-1610192244261-3f33de3f55e4?w=400&h=400&fit=crop&q=80',
    bgColor: 'rgba(16, 185, 129, 0.35)', // banana leaf green
    bgColorDark: 'rgba(4, 120, 87, 0.12)',
    textColor: '#065F46',
    textColorDark: '#6EE7B7',
    garnishes: [
      { emoji: '🍃', label: 'banana-leaf', xPercent: -38, yPercent: -30, scale: 1.2, speedFactor: 1.5, rotateStart: -45, rotateEnd: 15 },
      { emoji: '🍚', label: 'rice', xPercent: 35, yPercent: 25, scale: 1.1, speedFactor: 0.7, rotateStart: 0, rotateEnd: 90 },
      { emoji: '🥣', label: 'payasam', xPercent: -25, yPercent: 35, scale: 1.0, speedFactor: 1.3, rotateStart: 30, rotateEnd: -30 }
    ]
  }
];

export const SignatureDishShowcase: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<number>(0); // -1 for left, 1 for right
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Detect accessibility preference for reduced motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Set up auto-advance timer
  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDirection(1);
      setIndex((prevIndex) => (prevIndex + 1) % DISHES.length);
    }, 5000);
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [index]);

  // Handle visibility API to pause slider when page is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } else {
        resetTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Swiping functions
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;
    
    // Swipe threshold is 50px
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        // Swipe right -> Go previous
        setDirection(-1);
        setIndex((prevIndex) => (prevIndex - 1 + DISHES.length) % DISHES.length);
      } else {
        // Swipe left -> Go next
        setDirection(1);
        setIndex((prevIndex) => (prevIndex + 1) % DISHES.length);
      }
    }
    touchStartX.current = null;
  };

  const currentDish = DISHES[index];

  // Motion variants for custom parallax and spring layout
  const sliderVariants = {
    enter: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir * 300,
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.85
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: prefersReducedMotion 
        ? { duration: 0.4 } 
        : {
            x: { type: 'spring', stiffness: 120, damping: 15, mass: 0.8 },
            scale: { type: 'spring', stiffness: 100, damping: 16 },
            opacity: { duration: 0.4 }
          }
    },
    exit: (dir: number) => ({
      x: prefersReducedMotion ? 0 : -dir * 300,
      opacity: 0,
      scale: prefersReducedMotion ? 1 : 0.85,
      transition: prefersReducedMotion 
        ? { duration: 0.4 } 
        : {
            x: { type: 'spring', stiffness: 120, damping: 15, mass: 0.8 },
            scale: { type: 'spring', stiffness: 100, damping: 16 },
            opacity: { duration: 0.3 }
          }
    })
  };

  return (
    <div className="mt-8 border border-[#E8E2D2] dark:border-[#3D352E] rounded-3xl overflow-hidden relative shadow-sm transition-colors duration-500 bg-white dark:bg-[#1E1A16]">
      {/* Background wash layer that smoothly crossfades */}
      <div 
        className="absolute inset-0 transition-all duration-700 ease-out z-0 opacity-40 dark:opacity-30"
        style={{
          background: `radial-gradient(circle at center, ${currentDish.bgColor} 0%, transparent 80%)`,
        }}
      />

      {/* Header Label */}
      <div className="pt-5 px-6 pb-2 flex justify-between items-center relative z-10 border-b border-[#E8E2D2]/40 dark:border-[#3D352E]/30">
        <span className="text-[10px] uppercase font-bold tracking-widest text-[#8B4513] dark:text-[#D2B48C]">
          ✨ Signature Chef Showcases
        </span>
        {/* Pagination Dots */}
        <div className="flex gap-1.5">
          {DISHES.map((_, dotIdx) => (
            <button
              key={dotIdx}
              onClick={() => {
                setDirection(dotIdx > index ? 1 : -1);
                setIndex(dotIdx);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                dotIdx === index 
                  ? 'bg-[#E37A08] w-4' 
                  : 'bg-[#E8E2D2] dark:bg-[#3D352E] hover:bg-[#A1917B]'
              }`}
              aria-label={`Go to slide ${dotIdx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Primary Interactive Stage */}
      <div 
        className="h-64 sm:h-72 w-full relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={index}
            custom={direction}
            variants={sliderVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0 flex items-center justify-center z-10"
          >
            {/* Layer 2: Large Display Name behind the photo */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden select-none pointer-events-none z-0">
              <div className="flex justify-center flex-wrap select-none tracking-widest text-4xl sm:text-6xl font-serif font-black uppercase text-center w-full px-4 text-[#8B4513]/10 dark:text-[#D2B48C]/15">
                {currentDish.name.split('').map((char, charIdx) => {
                  const centerIdx = currentDish.name.length / 2;
                  const distanceFromCenter = charIdx - centerIdx;
                  // Old characters push outwards from the center on exit, new characters slide up
                  const pushX = prefersReducedMotion ? 0 : distanceFromCenter * 16;
                  
                  return (
                    <motion.span
                      key={charIdx}
                      className="inline-block"
                      initial={prefersReducedMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
                      animate={{ 
                        y: 0, 
                        opacity: 1,
                        transition: prefersReducedMotion 
                          ? { duration: 0.3 } 
                          : {
                              y: { type: 'tween', duration: 0.5, ease: [0.25, 1, 0.5, 1], delay: charIdx * 0.025 },
                              opacity: { duration: 0.3, delay: charIdx * 0.025 }
                            }
                      }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { 
                        x: pushX,
                        y: -15,
                        opacity: 0,
                        transition: {
                          type: 'tween',
                          duration: 0.45,
                          ease: 'easeIn'
                        }
                      }}
                    >
                      {char === ' ' ? '\u00A0' : char}
                    </motion.span>
                  );
                })}
              </div>
            </div>

            {/* Layer 4: Parallax Garnish Accents */}
            {!prefersReducedMotion && currentDish.garnishes.map((garnish, gIdx) => {
              // Parallax factor shifts the garnish faster or slower relative to the slide direction
              const gEnterX = direction * 150 * garnish.speedFactor;
              const gExitX = -direction * 150 * garnish.speedFactor;

              return (
                <motion.div
                  key={`${garnish.label}-${gIdx}`}
                  className="absolute pointer-events-none z-20 text-3xl select-none"
                  style={{
                    left: `calc(50% + ${garnish.xPercent}%)`,
                    top: `calc(50% + ${garnish.yPercent}%)`,
                  }}
                  initial={{ 
                    x: gEnterX, 
                    opacity: 0, 
                    scale: 0, 
                    rotate: garnish.rotateStart 
                  }}
                  animate={{ 
                    x: 0, 
                    opacity: 1, 
                    scale: garnish.scale, 
                    rotate: (garnish.rotateStart + garnish.rotateEnd) / 2,
                    transition: {
                      x: { type: 'spring', stiffness: 100, damping: 14, mass: 0.9 },
                      scale: { type: 'spring', stiffness: 120, damping: 12, delay: 0.1 },
                      opacity: { duration: 0.3 },
                      rotate: { duration: 0.8, ease: 'easeOut' }
                    }
                  }}
                  exit={{ 
                    x: gExitX, 
                    opacity: 0, 
                    scale: 0, 
                    rotate: garnish.rotateEnd,
                    transition: {
                      x: { type: 'spring', stiffness: 100, damping: 14, mass: 0.9 },
                      scale: { duration: 0.2 },
                      opacity: { duration: 0.2 }
                    }
                  }}
                >
                  {garnish.emoji}
                </motion.div>
              );
            })}

            {/* Layer 3: Main centered dish photo */}
            <div className="relative w-40 h-40 sm:w-44 sm:h-44 z-10 select-none">
              {/* Backing halo ring */}
              <div className="absolute inset-0 rounded-full scale-[1.08] border-2 border-dashed border-[#E37A08]/20 dark:border-[#D2B48C]/30 animate-[spin_40s_linear_infinite]" />
              
              {/* Image Container with slow idle float */}
              <motion.div
                className="w-full h-full rounded-full overflow-hidden border-4 border-white dark:border-[#2D2926] shadow-md relative group bg-transparent select-none pointer-events-none"
                animate={prefersReducedMotion ? {} : {
                  y: [0, -6, 0],
                }}
                transition={{
                  y: {
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut'
                  }
                }}
              >
                <img
                  src={currentDish.image}
                  alt={currentDish.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Description Caption Banner below image */}
      <div className="px-6 pb-6 pt-2 text-center relative z-10 border-t border-[#E8E2D2]/30 dark:border-[#3D352E]/30 bg-stone-50/80 dark:bg-[#221E19]/80 backdrop-blur-xs">
        <h3 
          className="font-serif font-black text-sm tracking-tight transition-colors duration-500"
          style={{ color: prefersReducedMotion ? undefined : currentDish.textColor }}
        >
          {currentDish.name}
        </h3>
        <p className="text-[11px] text-[#6B5E4C] dark:text-[#B8ACA0] leading-relaxed mt-1 max-w-sm mx-auto font-medium">
          {currentDish.description}
        </p>
      </div>
    </div>
  );
};
