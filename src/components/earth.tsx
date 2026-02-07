'use client';

import { useEarthScene } from '@/hooks/useEarthScene';

const Earth = () => {
  const { containerRef } = useEarthScene();

  return <div ref={containerRef} className="h-full w-full touch-none" />;
};

export { Earth };
