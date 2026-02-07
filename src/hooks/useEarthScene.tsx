'use client';

import { PICK_THRESHOLD, TIME_WARP_SPEEDS } from '@/utils/constants';
import {
  type OrbitCache,
  type SatelliteOrbitalData,
  computeOrbitPath,
  prepareOrbits,
  propagateFromCache,
} from '@/utils/satellite-helpers';
import {
  createCamera,
  createCameraControls,
  createEarth,
  createLights,
  createOrbitLine,
  createRenderer,
  createSatellitePoints,
  createScene,
  updateSatellitePositions,
} from '@/utils/three-helpers';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

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
    let satPoints: THREE.Points | null = null;
    let positions: Float32Array | null = null;
    let aborted = false;

    // Simulated time
    let simTime = Date.now();
    let lastRealTime = performance.now();

    /* ---- Orbit line (click selection) ---- */
    let orbitLine: THREE.Line | null = null;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    // Track pointer to distinguish click from drag
    let pointerDownPos = { x: 0, y: 0 };

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button !== 0 || !cache || !satPoints) return;
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      // Only treat as click if pointer barely moved
      if (dx * dx + dy * dy > 9) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.params.Points!.threshold =
        PICK_THRESHOLD * Math.pow(camera.position.length(), 1.5);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(satPoints);

      // Remove previous orbit line
      if (orbitLine) {
        scene.remove(orbitLine);
        orbitLine.geometry.dispose();
        (orbitLine.material as THREE.Material).dispose();
        orbitLine = null;
      }

      if (hits.length > 0) {
        const satIndex = hits[0].index!;
        const path = computeOrbitPath(cache, satIndex);
        orbitLine = createOrbitLine(path);
        scene.add(orbitLine);
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return { containerRef, timeWarp, cycleTimeWarp };
};

export { useEarthScene };
