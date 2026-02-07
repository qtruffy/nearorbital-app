import {
  AMBIENT_LIGHT_INTENSITY,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_POSITION,
  CONTROLS_DAMPING,
  CONTROLS_MAX_DISTANCE,
  CONTROLS_MIN_DISTANCE,
  CONTROLS_ROLL_SPEED,
  CONTROLS_ROTATE_SPEED,
  CONTROLS_TOUCH_MULTIPLIER,
  CONTROLS_ZOOM_SPEED,
  DIRECTIONAL_LIGHT_INTENSITY,
  DIRECTIONAL_LIGHT_POSITION,
  EARTH_RADIUS,
  EARTH_SEGMENTS,
  EARTH_TEXTURE,
  ORBIT_DASH_SIZE,
  ORBIT_GAP_SIZE,
  ORBIT_LINE_COLOR,
  ORBIT_LINE_OPACITY,
  SATELLITE_COLOR,
  SATELLITE_OPACITY,
  SATELLITE_POINT_SIZE,
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
  let isRolling = false;
  let prevX = 0;
  let prevY = 0;

  const activePointers = new Map<number, { x: number; y: number }>();
  let prevPinchDist = 0;
  let prevPinchAngle = 0;
  let prevMidX = 0;
  let prevMidY = 0;

  const quat = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const offset = new THREE.Vector3();

  function getPointerDistance() {
    const pts = [...activePointers.values()];
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getPointerAngle() {
    const pts = [...activePointers.values()];
    return Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
  }

  function getPointerMidpoint() {
    const pts = [...activePointers.values()];
    return {
      x: (pts[0].x + pts[1].x) / 2,
      y: (pts[0].y + pts[1].y) / 2,
    };
  }

  function onContextMenu(e: Event) {
    e.preventDefault();
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 2) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    domElement.setPointerCapture(e.pointerId);

    if (e.button === 2) {
      isRolling = true;
      prevX = e.clientX;
    } else if (activePointers.size === 1) {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    } else if (activePointers.size === 2) {
      isDragging = false;
      prevPinchDist = getPointerDistance();
      prevPinchAngle = getPointerAngle();
      const mid = getPointerMidpoint();
      prevMidX = mid.x;
      prevMidY = mid.y;
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      // Zoom via pinch
      const dist = getPointerDistance();
      const scale = prevPinchDist / dist;
      radius = THREE.MathUtils.clamp(
        radius * scale,
        CONTROLS_MIN_DISTANCE,
        CONTROLS_MAX_DISTANCE
      );
      prevPinchDist = dist;

      // Roll via twist
      const angle = getPointerAngle();
      const deltaAngle = angle - prevPinchAngle;
      if (Math.abs(deltaAngle) > 1e-6) {
        axis.copy(camera.position).sub(target).normalize();
        quat.setFromAxisAngle(axis, deltaAngle);
        camera.up.applyQuaternion(quat);
        camera.lookAt(target);
      }
      prevPinchAngle = angle;

      // Rotate via midpoint movement
      const mid = getPointerMidpoint();
      const speed =
        CONTROLS_ROTATE_SPEED *
        (radius / CONTROLS_MAX_DISTANCE) *
        CONTROLS_TOUCH_MULTIPLIER;
      vx -= (mid.x - prevMidX) * speed;
      vy -= (mid.y - prevMidY) * speed;
      prevMidX = mid.x;
      prevMidY = mid.y;
    } else if (isRolling) {
      const delta = (e.clientX - prevX) * CONTROLS_ROLL_SPEED;
      axis.copy(camera.position).sub(target).normalize();
      quat.setFromAxisAngle(axis, delta);
      camera.up.applyQuaternion(quat);
      camera.lookAt(target);
      prevX = e.clientX;
    } else if (isDragging) {
      const isTouch = e.pointerType === 'touch';
      const speed =
        CONTROLS_ROTATE_SPEED *
        (radius / CONTROLS_MAX_DISTANCE) *
        (isTouch ? CONTROLS_TOUCH_MULTIPLIER : 1);
      vx -= (e.clientX - prevX) * speed;
      vy -= (e.clientY - prevY) * speed;
      prevX = e.clientX;
      prevY = e.clientY;
    }
  }

  function onPointerUp(e: PointerEvent) {
    activePointers.delete(e.pointerId);
    domElement.releasePointerCapture(e.pointerId);

    if (e.button === 2) {
      isRolling = false;
    } else if (activePointers.size === 1) {
      const remaining = [...activePointers.values()][0];
      isDragging = true;
      prevX = remaining.x;
      prevY = remaining.y;
    } else if (activePointers.size === 0) {
      isDragging = false;
    }
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
  domElement.addEventListener('contextmenu', onContextMenu);

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
    domElement.removeEventListener('contextmenu', onContextMenu);
  }

  return { update, dispose };
}

export function createSatellitePoints(count: number) {
  const positions = new Float32Array(count * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: SATELLITE_POINT_SIZE,
    color: SATELLITE_COLOR,
    transparent: true,
    opacity: SATELLITE_OPACITY,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

export function updateSatellitePositions(
  points: THREE.Points,
  positions: Float32Array,
) {
  const attr = points.geometry.getAttribute(
    'position',
  ) as THREE.BufferAttribute;
  attr.array.set(positions);
  attr.needsUpdate = true;
}

export function createOrbitLine(pathPositions: Float32Array) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(pathPositions, 3),
  );

  const material = new THREE.LineDashedMaterial({
    color: ORBIT_LINE_COLOR,
    transparent: true,
    opacity: ORBIT_LINE_OPACITY,
    dashSize: ORBIT_DASH_SIZE,
    gapSize: ORBIT_GAP_SIZE,
    depthWrite: false,
  });

  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}
