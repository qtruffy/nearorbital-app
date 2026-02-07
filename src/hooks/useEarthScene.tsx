'use client';

import type { SatelliteGp } from '@/app/api/satellites/route';
import { PICK_THRESHOLD, TIME_WARP_SPEEDS } from '@/utils/constants';
import {
  type OrbitCache,
  computeOrbitPath,
  getOrbitPlaneVectors,
  prepareOrbits,
  propagateFromCache,
} from '@/utils/satellite-helpers';
import {
  computeLocalBasis,
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
  const [satellites, setSatellites] = useState<SatelliteGp[]>([]);
  const [selectedSatellite, setSelectedSatellite] =
    useState<SatelliteGp | null>(null);
  const [simDate, setSimDate] = useState<Date | null>(null);
  const satellitesRef = useRef<SatelliteGp[]>([]);
  const selectByIndexRef = useRef<(index: number) => void>(() => {});
  const clearSelectionRef = useRef<(() => void) | null>(null);
  const resetSimTimeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    timeWarpRef.current = timeWarp;
  }, [timeWarp]);

  const cycleTimeWarp = useCallback(() => {
    setTimeWarp(prev => {
      const idx = TIME_WARP_SPEEDS.indexOf(
        prev as (typeof TIME_WARP_SPEEDS)[number]
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

    resetSimTimeRef.current = () => {
      simTime = Date.now();
      setSimDate(new Date(simTime));
      setTimeWarp(1);
    };

    /* ---- Orbit line, selection & camera follow ---- */
    let orbitLine: THREE.Line | null = null;
    let selectedSatIndex: number | null = null;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    const satWorldPos = new THREE.Vector3();
    const orbitP = new THREE.Vector3();
    const orbitQ = new THREE.Vector3();
    const basis = new THREE.Matrix3();
    const basisInv = new THREE.Matrix3();

    // Track pointer to distinguish click from drag
    let pointerDownPos = { x: 0, y: 0 };

    function buildLocalBasis(satIndex: number) {
      if (!cache || !positions) return;
      const i3 = satIndex * 3;
      satWorldPos.set(positions[i3], positions[i3 + 1], positions[i3 + 2]);
      const pq = getOrbitPlaneVectors(cache, satIndex);
      orbitP.set(pq.px, pq.py, pq.pz);
      orbitQ.set(pq.qx, pq.qy, pq.qz);
      computeLocalBasis(satWorldPos, orbitP, orbitQ, basis, basisInv);
    }

    function clearSelection() {
      if (orbitLine) {
        scene.remove(orbitLine);
        orbitLine.geometry.dispose();
        (orbitLine.material as THREE.Material).dispose();
        orbitLine = null;
      }
      if (selectedSatIndex !== null) {
        selectedSatIndex = null;
        controls.deselect();
      }
      setSelectedSatellite(null);
    }

    function selectSat(satIndex: number) {
      if (!cache || !positions) return;

      // Remove previous orbit line
      if (orbitLine) {
        scene.remove(orbitLine);
        orbitLine.geometry.dispose();
        (orbitLine.material as THREE.Material).dispose();
        orbitLine = null;
      }

      selectedSatIndex = satIndex;

      const path = computeOrbitPath(cache, satIndex);
      orbitLine = createOrbitLine(path);
      scene.add(orbitLine);

      // Lock camera onto satellite
      buildLocalBasis(satIndex);
      controls.select(satWorldPos, basis, basisInv);

      // Update React state
      setSelectedSatellite(satellitesRef.current[satIndex] ?? null);
    }

    selectByIndexRef.current = selectSat;
    clearSelectionRef.current = clearSelection;

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button !== 0 || !cache || !satPoints) return;
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (dx * dx + dy * dy > 9) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.params.Points!.threshold =
        PICK_THRESHOLD * Math.pow(camera.position.length(), 1.5);
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObject(satPoints);

      if (hits.length > 0) {
        selectSat(hits[0].index!);
      } else {
        clearSelection();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        clearSelection();
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);

    fetch('/api/satellites')
      .then(res => res.json())
      .then(json => {
        if (aborted) return;
        const sats = json.data as SatelliteGp[];
        satellitesRef.current = sats;
        setSatellites(sats);
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
    let lastSimDateUpdate = 0;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const deltaReal = now - lastRealTime;
      lastRealTime = now;

      simTime += deltaReal * timeWarpRef.current;

      // Update simDate state at ~4 Hz to avoid excessive re-renders
      if (now - lastSimDateUpdate > 250) {
        lastSimDateUpdate = now;
        setSimDate(new Date(simTime));
      }

      // Propagate positions BEFORE camera update so camera uses current frame data
      if (cache && satPoints && positions) {
        propagateFromCache(cache, new Date(simTime), positions);
        updateSatellitePositions(satPoints, positions);

        // Update follow target before controls.update() computes camera position
        if (selectedSatIndex !== null) {
          buildLocalBasis(selectedSatIndex);
          controls.updateFollow(satWorldPos, basis, basisInv);
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      aborted = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  const selectSatelliteByIndex = useCallback((index: number) => {
    selectByIndexRef.current(index);
  }, []);

  const resetSimTime = useCallback(() => {
    resetSimTimeRef.current?.();
  }, []);

  const deselectSatellite = useCallback(() => {
    clearSelectionRef.current?.();
  }, []);

  return {
    containerRef,
    timeWarp,
    cycleTimeWarp,
    resetSimTime,
    simDate,
    satellites,
    selectedSatellite,
    selectSatelliteByIndex,
    deselectSatellite,
  };
};

export { useEarthScene };
