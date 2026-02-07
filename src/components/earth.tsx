'use client';

import { useEarthScene } from '@/hooks/useEarthScene';

const Earth = () => {
  const { containerRef, timeWarp, cycleTimeWarp } = useEarthScene();

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none">
      <button
        onClick={cycleTimeWarp}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white/90 backdrop-blur-md transition-colors active:bg-white/20 sm:hover:bg-white/20"
      >
        {timeWarp === 1 ? '1x' : `${timeWarp}x`}
      </button>
    </div>
  );
};

export { Earth };
