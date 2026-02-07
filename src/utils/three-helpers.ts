import {
  AMBIENT_LIGHT_INTENSITY,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_POSITION,
  CONTROLS_DAMPING,
  CONTROLS_MAX_DISTANCE,
  CONTROLS_MIN_DISTANCE,
  CONTROLS_ROTATE_SPEED,
  CONTROLS_ZOOM_SPEED,
  DIRECTIONAL_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_POSITION,
  EARTH_RADIUS,
  EARTH_SEGMENTS,
  EARTH_TEXTURE,
  SCENE_BACKGROUND_COLOR,
} from '@/utils/constants';
import * as THREE from 'three';

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
  return scene;
}

export function createCamera(aspect: number) {
  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    aspect,
    CAMERA_NEAR,
    CAMERA_FAR
  );
  camera.position.set(...CAMERA_POSITION);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function createRenderer(container: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  return renderer;
}

export function createEarth() {
  const geometry = new THREE.SphereGeometry(
    EARTH_RADIUS,
    EARTH_SEGMENTS,
    EARTH_SEGMENTS
  );
  const texture = new THREE.TextureLoader().load(EARTH_TEXTURE);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map: texture });
  return new THREE.Mesh(geometry, material);
}

export function createLights() {
  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT_LIGHT_INTENSITY);
  const directional = new THREE.DirectionalLight(
    0xffffff,
    DIRECTIONAL_LIGHT_INTENSITY
  );
  directional.position.set(...DIRECTIONAL_LIGHT_POSITION);
  return [ambient, directional];
}

export function createCameraControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement
) {
  const target = new THREE.Vector3(0, 0, 0);
  let radius = camera.position.distanceTo(target);

  let vx = 0;
  let vy = 0;
  let isDragging = false;
  let prevX = 0;
  let prevY = 0;

  const quat = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const offset = new THREE.Vector3();

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    isDragging = true;
    prevX = e.clientX;
    prevY = e.clientY;
    domElement.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!isDragging) return;
    vx -= (e.clientX - prevX) * CONTROLS_ROTATE_SPEED;
    vy -= (e.clientY - prevY) * CONTROLS_ROTATE_SPEED;
    prevX = e.clientX;
    prevY = e.clientY;
  }

  function onPointerUp(e: PointerEvent) {
    isDragging = false;
    domElement.releasePointerCapture(e.pointerId);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    radius = THREE.MathUtils.clamp(
      radius * (e.deltaY > 0 ? 1 + CONTROLS_ZOOM_SPEED : 1 - CONTROLS_ZOOM_SPEED),
      CONTROLS_MIN_DISTANCE,
      CONTROLS_MAX_DISTANCE
    );
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('wheel', onWheel, { passive: false });

  function update() {
    if (Math.abs(vx) > 1e-6 || Math.abs(vy) > 1e-6) {
      // Vertical rotation: around camera's local X axis
      axis.set(1, 0, 0).applyQuaternion(camera.quaternion);
      quat.setFromAxisAngle(axis, vy);
      offset.copy(camera.position).sub(target).applyQuaternion(quat);
      camera.up.applyQuaternion(quat);

      // Horizontal rotation: around camera's local Y axis
      axis.set(0, 1, 0).applyQuaternion(camera.quaternion);
      quat.setFromAxisAngle(axis, vx);
      offset.applyQuaternion(quat);
      camera.up.applyQuaternion(quat);

      // Apply position at correct distance
      camera.position.copy(offset.normalize().multiplyScalar(radius).add(target));
      camera.lookAt(target);

      vx *= CONTROLS_DAMPING;
      vy *= CONTROLS_DAMPING;
    } else {
      // Snap distance if only zoom changed
      offset.copy(camera.position).sub(target);
      if (Math.abs(offset.length() - radius) > 1e-4) {
        camera.position.copy(offset.normalize().multiplyScalar(radius).add(target));
      }
    }
  }

  function dispose() {
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('wheel', onWheel);
  }

  return { update, dispose };
}
