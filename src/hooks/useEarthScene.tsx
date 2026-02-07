'use client';

import {
  createCamera,
  createCameraControls,
  createEarth,
  createLights,
  createRenderer,
  createScene,
} from '@/utils/three-helpers';
import { useEffect, useRef } from 'react';

const useEarthScene = () => {
  const containerRef = useRef<HTMLDivElement>(null);

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

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return { containerRef };
};

export { useEarthScene };
