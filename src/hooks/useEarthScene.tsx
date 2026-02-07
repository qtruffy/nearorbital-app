'use client';

import { TIME_WARP_SPEEDS } from '@/utils/constants';
import {
  type OrbitCache,
  type SatelliteOrbitalData,
  prepareOrbits,
  propagateFromCache,
} from '@/utils/satellite-helpers';
import {
  createCamera,
  createCameraControls,
  createEarth,
  createLights,
  createRenderer,
  createSatellitePoints,
  createScene,
  updateSatellitePositions,
} from '@/utils/three-helpers';
import { useCallback, useEffect, useRef, useState } from 'react';

const useEarthScene = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [timeWarp, setTimeWarp] = useState(1);
  const timeWarpRef = useRef(timeWarp);

  useEffect(() => {
    timeWarpRef.current = timeWarp;
  }, [timeWarp]);

  const cycleTimeWarp = useCallback(() => {
    setTimeWarp(prev => {
      const idx = TIME_WARP_SPEEDS.indexOf(
        prev as (typeof TIME_WARP_SPEEDS)[number],
      );
      return TIME_WARP_SPEEDS[(idx + 1) % TIME_WARP_SPEEDS.length];
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = createScene();
    const camera = createCamera(container.clientWidth / container.clientHeight);
    const renderer = createRenderer(container);

    scene.add(createEarth());
    createLights().forEach(light => scene.add(light));

    const controls = createCameraControls(camera, renderer.domElement);

    const handleResize = () => {
      const { clientWidth, clientHeight } = container;
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(clientWidth, clientHeight);
    };
    window.addEventListener('resize', handleResize);

    /* ---- Satellites ---- */
    let cache: OrbitCache | null = null;
    let satPoints: ReturnType<typeof createSatellitePoints> | null = null;
    let positions: Float32Array | null = null;
    let aborted = false;

    // Simulated time
    let simTime = Date.now();
    let lastRealTime = performance.now();

    fetch('/api/satellites')
      .then(res => res.json())
      .then(json => {
        if (aborted) return;
        const sats = json.data as SatelliteOrbitalData[];
        cache = prepareOrbits(sats);
        positions = new Float32Array(sats.length * 3);
        satPoints = createSatellitePoints(sats.length);
        scene.add(satPoints);

        propagateFromCache(cache, new Date(simTime), positions);
        updateSatellitePositions(satPoints, positions);
      })
      .catch(() => {});

    /* ---- Animation loop ---- */
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const deltaReal = now - lastRealTime;
      lastRealTime = now;

      simTime += deltaReal * timeWarpRef.current;

      controls.update();

      // Propagate every frame for smooth movement
      if (cache && satPoints && positions) {
        propagateFromCache(cache, new Date(simTime), positions);
        updateSatellitePositions(satPoints, positions);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      aborted = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return { containerRef, timeWarp, cycleTimeWarp };
};

export { useEarthScene };
