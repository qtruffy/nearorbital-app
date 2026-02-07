import {
  AMBIENT_LIGHT_INTENSITY,
  CAMERA_FAR,
  CAMERA_FOV,
  CAMERA_NEAR,
  CAMERA_POSITION,
  CAMERA_FOLLOW_LERP,
  CAMERA_RETURN_LERP,
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
  FOLLOW_INITIAL_DISTANCE,
  FOLLOW_MAX_DISTANCE,
  FOLLOW_MIN_DISTANCE,
  FOLLOW_ROTATE_MULTIPLIER,
  FOLLOW_ROTATE_SPEED,
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

  // Prevent iOS text selection bubble & callout on multi-touch gestures
  const canvas = renderer.domElement;
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';
  (canvas.style as unknown as Record<string, string>).webkitTouchCallout = 'none';

  container.appendChild(canvas);
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

/**
 * Compute a local basis (LVLH frame) at the satellite position.
 * - X: transverse (prograde, along-track)
 * - Y: orbit normal
 * - Z: radial (outward from Earth)
 */
export function computeLocalBasis(
  satPos: THREE.Vector3,
  orbitP: THREE.Vector3,
  orbitQ: THREE.Vector3,
  basis: THREE.Matrix3,
  basisInv: THREE.Matrix3,
): void {
  const normal = _v1.crossVectors(orbitP, orbitQ).normalize();
  const radial = _v2.copy(satPos).normalize();
  const transverse = _v3.crossVectors(normal, radial).normalize();

  basis.set(
    transverse.x, normal.x, radial.x,
    transverse.y, normal.y, radial.y,
    transverse.z, normal.z, radial.z,
  );
  basisInv.copy(basis).invert();
}

// Pre-allocated temp vectors to avoid per-frame allocations
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _refDir = new THREE.Vector3();
const _tmpUp = new THREE.Vector3();
const _dRotX = new THREE.Quaternion();
const _dRotY = new THREE.Quaternion();

export function createCameraControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement
) {
  /* ── Shared state ── */
  const currentTarget = new THREE.Vector3(0, 0, 0);
  const focusTarget = new THREE.Vector3(0, 0, 0);
  let radius = camera.position.distanceTo(currentTarget);

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

  /* ── Follow mode state ── */
  let hasLocalBasis = false;
  const localBasis = new THREE.Matrix3();
  const localBasisInv = new THREE.Matrix3();
  const camFollowQuat = new THREE.Quaternion();
  let camFollowDist: number = CAMERA_POSITION[2];
  let targetFollowDist = FOLLOW_INITIAL_DISTANCE;
  // Angular velocities for smooth follow-mode rotation (same feel as free mode)
  let followVx = 0;
  let followVy = 0;
  let followVroll = 0;

  /* ── Helpers ── */
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

  /* ── Input handlers ── */
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

    // If the button was released outside the canvas (missed pointerup), clean up.
    if (e.buttons === 0) {
      activePointers.delete(e.pointerId);
      isDragging = false;
      isRolling = false;
      return;
    }

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // If pointer is outside canvas, update prev positions without moving the camera.
    // This freezes the camera while outside and avoids jumps on re-entry.
    const rect = domElement.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    if (!inside) {
      if (isDragging || isRolling) {
        prevX = e.clientX;
        prevY = e.clientY;
      }
      if (activePointers.size === 2) {
        prevPinchDist = getPointerDistance();
        prevPinchAngle = getPointerAngle();
        const mid = getPointerMidpoint();
        prevMidX = mid.x;
        prevMidY = mid.y;
      }
      return;
    }

    if (activePointers.size === 2) {
      if (hasLocalBasis) {
        // Follow mode: pinch zoom
        const dist = getPointerDistance();
        const scale = prevPinchDist / dist;
        targetFollowDist = THREE.MathUtils.clamp(
          targetFollowDist * scale,
          FOLLOW_MIN_DISTANCE,
          FOLLOW_MAX_DISTANCE
        );
        prevPinchDist = dist;

        // Roll via twist → velocity
        const angle = getPointerAngle();
        const deltaAngle = angle - prevPinchAngle;
        if (Math.abs(deltaAngle) > 1e-6) {
          followVroll += deltaAngle;
        }
        prevPinchAngle = angle;

        // Rotate via midpoint movement → velocity (scale with distance like free mode)
        const mid = getPointerMidpoint();
        const speed = FOLLOW_ROTATE_SPEED * (camFollowDist / FOLLOW_MAX_DISTANCE) * FOLLOW_ROTATE_MULTIPLIER * CONTROLS_TOUCH_MULTIPLIER;
        followVx -= (mid.x - prevMidX) * speed;
        followVy -= (mid.y - prevMidY) * speed;
        prevMidX = mid.x;
        prevMidY = mid.y;
      } else {
        // Free mode: pinch zoom
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
          axis.copy(camera.position).sub(currentTarget).normalize();
          quat.setFromAxisAngle(axis, deltaAngle);
          camera.up.applyQuaternion(quat);
          camera.lookAt(currentTarget);
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
      }
    } else if (isRolling) {
      if (hasLocalBasis) {
        // Follow mode: roll → velocity
        followVroll += (e.clientX - prevX) * CONTROLS_ROLL_SPEED;
        prevX = e.clientX;
      } else {
        const delta = (e.clientX - prevX) * CONTROLS_ROLL_SPEED;
        axis.copy(camera.position).sub(currentTarget).normalize();
        quat.setFromAxisAngle(axis, delta);
        camera.up.applyQuaternion(quat);
        camera.lookAt(currentTarget);
        prevX = e.clientX;
      }
    } else if (isDragging) {
      if (hasLocalBasis) {
        // Follow mode: rotation → velocity (scale with distance like free mode)
        const isTouch = e.pointerType === 'touch';
        const speed = FOLLOW_ROTATE_SPEED * (camFollowDist / FOLLOW_MAX_DISTANCE) * FOLLOW_ROTATE_MULTIPLIER * (isTouch ? CONTROLS_TOUCH_MULTIPLIER : 1);
        followVx -= (e.clientX - prevX) * speed;
        followVy -= (e.clientY - prevY) * speed;
        prevX = e.clientX;
        prevY = e.clientY;
      } else {
        // Free mode: velocity rotation
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
    if (hasLocalBasis) {
      targetFollowDist = THREE.MathUtils.clamp(
        targetFollowDist * (e.deltaY > 0 ? 1 + CONTROLS_ZOOM_SPEED : 1 - CONTROLS_ZOOM_SPEED),
        FOLLOW_MIN_DISTANCE,
        FOLLOW_MAX_DISTANCE
      );
    } else {
      radius = THREE.MathUtils.clamp(
        radius * (e.deltaY > 0 ? 1 + CONTROLS_ZOOM_SPEED : 1 - CONTROLS_ZOOM_SPEED),
        CONTROLS_MIN_DISTANCE,
        CONTROLS_MAX_DISTANCE
      );
    }
  }

  // Prevent iOS default gestures (text selection bubble, callout, zoom)
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length >= 2) e.preventDefault();
  }
  function onTouchMove(e: TouchEvent) {
    e.preventDefault();
  }
  function onGestureStart(e: Event) {
    e.preventDefault();
  }

  domElement.addEventListener('touchstart', onTouchStart, { passive: false });
  domElement.addEventListener('touchmove', onTouchMove, { passive: false });
  domElement.addEventListener('gesturestart', onGestureStart);
  domElement.addEventListener('pointerdown', onPointerDown);
  domElement.addEventListener('pointermove', onPointerMove);
  domElement.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('wheel', onWheel, { passive: false });
  domElement.addEventListener('contextmenu', onContextMenu);

  /* ── Update (called each frame) ── */
  function update() {
    // Smooth target interpolation
    if (hasLocalBasis) {
      // Follow mode: snap target to satellite position
      currentTarget.copy(focusTarget);
      // Smooth zoom toward target distance
      camFollowDist += (targetFollowDist - camFollowDist) * CAMERA_FOLLOW_LERP;
    } else {
      // Free mode: smooth return to Earth center
      currentTarget.lerp(focusTarget, CAMERA_RETURN_LERP);
    }

    // Update camera position
    if (hasLocalBasis) {
      // Apply follow velocities in camera body frame (multiply, not premultiply)
      // so drag always maps to screen horizontal/vertical regardless of roll
      if (Math.abs(followVx) > 1e-6 || Math.abs(followVy) > 1e-6) {
        _dRotX.setFromAxisAngle(_v1.set(1, 0, 0), followVy);
        _dRotY.setFromAxisAngle(_v1.set(0, 1, 0), followVx);
        camFollowQuat.multiply(_dRotY).multiply(_dRotX);
        followVx *= CONTROLS_DAMPING;
        followVy *= CONTROLS_DAMPING;
      }
      if (Math.abs(followVroll) > 1e-6) {
        _dRotX.setFromAxisAngle(_v1.set(0, 0, 1), followVroll);
        camFollowQuat.multiply(_dRotX);
        followVroll *= CONTROLS_DAMPING;
      }

      // Follow mode: position from quaternion in satellite local frame
      _refDir.set(0, 0, camFollowDist).applyQuaternion(camFollowQuat);
      offset.copy(_refDir).applyMatrix3(localBasis);
      camera.position.copy(currentTarget).add(offset);

      // Camera up vector from local frame
      _tmpUp.set(0, 1, 0).applyQuaternion(camFollowQuat).applyMatrix3(localBasis).normalize();
      camera.up.copy(_tmpUp);
    } else {
      // Free mode: velocity-based orbital rotation
      if (Math.abs(vx) > 1e-6 || Math.abs(vy) > 1e-6) {
        axis.set(1, 0, 0).applyQuaternion(camera.quaternion);
        quat.setFromAxisAngle(axis, vy);
        offset.copy(camera.position).sub(currentTarget).applyQuaternion(quat);
        camera.up.applyQuaternion(quat);

        axis.set(0, 1, 0).applyQuaternion(camera.quaternion);
        quat.setFromAxisAngle(axis, vx);
        offset.applyQuaternion(quat);
        camera.up.applyQuaternion(quat);

        camera.position.copy(offset.normalize().multiplyScalar(radius).add(currentTarget));

        vx *= CONTROLS_DAMPING;
        vy *= CONTROLS_DAMPING;
      } else {
        offset.copy(camera.position).sub(currentTarget);
        if (Math.abs(offset.length() - radius) > 1e-4) {
          camera.position.copy(offset.normalize().multiplyScalar(radius).add(currentTarget));
        }
      }
    }

    camera.lookAt(currentTarget);
  }

  /* ── Selection API ── */

  /**
   * Lock camera onto a satellite. Converts current world-space camera
   * position into the satellite's local frame (quaternion + distance)
   * for seamless transition.
   */
  function select(
    satPos: THREE.Vector3,
    basis: THREE.Matrix3,
    basisInv: THREE.Matrix3,
  ) {
    localBasis.copy(basis);
    localBasisInv.copy(basisInv);

    // Convert camera offset from world to satellite local frame
    const worldOffset = _v1.subVectors(camera.position, satPos);
    const worldUp = _v2.copy(camera.up);

    const localOffset = _v3.copy(worldOffset).applyMatrix3(localBasisInv);
    const localUp = _tmpUp.copy(worldUp).applyMatrix3(localBasisInv);
    camFollowDist = localOffset.length();
    targetFollowDist = FOLLOW_INITIAL_DISTANCE;

    if (camFollowDist > 0) {
      // Build quaternion preserving direction + orientation
      const zAxis = localOffset.clone().normalize();
      const yAxis = localUp
        .clone()
        .sub(zAxis.clone().multiplyScalar(localUp.dot(zAxis)))
        .normalize();
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();
      camFollowQuat.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis),
      );
    } else {
      camFollowQuat.identity();
      camFollowDist = CAMERA_POSITION[2];
    }

    currentTarget.copy(satPos);
    focusTarget.copy(satPos);
    hasLocalBasis = true;
    vx = 0;
    vy = 0;
    followVx = 0;
    followVy = 0;
    followVroll = 0;
  }

  /**
   * Unlock camera from satellite. Converts quaternion back
   * to free-mode state for smooth return to Earth view.
   */
  function deselect() {
    if (hasLocalBasis) {
      // Camera position is already correct in world space
      radius = camera.position.distanceTo(currentTarget);
      hasLocalBasis = false;
    }
    focusTarget.set(0, 0, 0);
    vx = 0;
    vy = 0;
    followVx = 0;
    followVy = 0;
    followVroll = 0;
  }

  /**
   * Update satellite tracking data each frame (position + local frame).
   */
  function updateFollow(
    satPos: THREE.Vector3,
    basis: THREE.Matrix3,
    basisInv: THREE.Matrix3,
  ) {
    focusTarget.copy(satPos);
    localBasis.copy(basis);
    localBasisInv.copy(basisInv);
  }

  function isFocused() {
    return hasLocalBasis;
  }

  function dispose() {
    domElement.removeEventListener('touchstart', onTouchStart);
    domElement.removeEventListener('touchmove', onTouchMove);
    domElement.removeEventListener('gesturestart', onGestureStart);
    domElement.removeEventListener('pointerdown', onPointerDown);
    domElement.removeEventListener('pointermove', onPointerMove);
    domElement.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('wheel', onWheel);
    domElement.removeEventListener('contextmenu', onContextMenu);
  }

  return { update, dispose, select, deselect, updateFollow, isFocused };
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

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return points;
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
