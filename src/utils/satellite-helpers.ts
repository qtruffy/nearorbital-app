import {
  EARTH_RADIUS,
  EARTH_RADIUS_KM,
  MU_EARTH_KM3S2,
  ORBIT_SEGMENTS,
} from '@/utils/constants';

export interface SatelliteOrbitalData {
  epoch: string;
  inc: number; // degrees
  ecc: number;
  mm: number; // revolutions per day
  raan: number; // degrees
  argp: number; // degrees
  ma: number; // degrees
}

const DEG2RAD = Math.PI / 180;
const TWO_PI = 2 * Math.PI;
const SCALE = EARTH_RADIUS / EARTH_RADIUS_KM;

/**
 * Pre-computed constant orbital parameters (computed once per satellite).
 * Stored as a flat Float64Array for cache-friendly iteration.
 *
 * Per satellite (11 floats):
 *   [0] epochSec   [1] n (rad/s)   [2] ma0 (rad)
 *   [3] ecc        [4] a           [5] sqrtOneMinusE2
 *   [6] r11        [7] r12         [8] r21
 *   [9] r22        [10] r31        [11] r32
 */
const STRIDE = 12;

export interface OrbitCache {
  buf: Float64Array;
  count: number;
}

/** Pre-compute all constant orbital parameters. Call once after fetch. */
export function prepareOrbits(satellites: SatelliteOrbitalData[]): OrbitCache {
  const count = satellites.length;
  const buf = new Float64Array(count * STRIDE);

  for (let i = 0; i < count; i++) {
    const sat = satellites[i];
    const off = i * STRIDE;

    // Epoch in seconds
    buf[off] = new Date(sat.epoch).getTime() / 1000;

    // Mean motion (rad/s)
    const n = (sat.mm * TWO_PI) / 86400;
    buf[off + 1] = n;

    // Mean anomaly at epoch (rad)
    buf[off + 2] = sat.ma * DEG2RAD;

    // Eccentricity
    buf[off + 3] = sat.ecc;

    // Semi-major axis (km)
    buf[off + 4] = Math.cbrt(MU_EARTH_KM3S2 / (n * n));

    // sqrt(1 - e²)
    buf[off + 5] = Math.sqrt(1 - sat.ecc * sat.ecc);

    // Rotation matrix (perifocal → ECI), pre-computed from inc/raan/argp
    const cosRaan = Math.cos(sat.raan * DEG2RAD);
    const sinRaan = Math.sin(sat.raan * DEG2RAD);
    const cosArgp = Math.cos(sat.argp * DEG2RAD);
    const sinArgp = Math.sin(sat.argp * DEG2RAD);
    const cosInc = Math.cos(sat.inc * DEG2RAD);
    const sinInc = Math.sin(sat.inc * DEG2RAD);

    buf[off + 6] = cosRaan * cosArgp - sinRaan * sinArgp * cosInc;
    buf[off + 7] = -(cosRaan * sinArgp + sinRaan * cosArgp * cosInc);
    buf[off + 8] = sinRaan * cosArgp + cosRaan * sinArgp * cosInc;
    buf[off + 9] = -(sinRaan * sinArgp - cosRaan * cosArgp * cosInc);
    buf[off + 10] = sinArgp * sinInc;
    buf[off + 11] = cosArgp * sinInc;
  }

  return { buf, count };
}

/**
 * Fast per-frame propagation using pre-computed cache.
 * Only Kepler solve + position transform — no trig for orbital elements.
 */
export function propagateFromCache(
  cache: OrbitCache,
  date: Date,
  out: Float32Array,
): void {
  const tSec = date.getTime() / 1000;
  const { buf, count } = cache;

  for (let i = 0; i < count; i++) {
    const off = i * STRIDE;

    const dt = tSec - buf[off]; // seconds since epoch
    const n = buf[off + 1];
    const ecc = buf[off + 3];
    const a = buf[off + 4];
    const sqrtE = buf[off + 5];

    // Mean anomaly at current time
    let M = (buf[off + 2] + n * dt) % TWO_PI;
    if (M < 0) M += TWO_PI;

    // Solve Kepler (Newton-Raphson)
    let E = M;
    for (let j = 0; j < 6; j++) {
      E -= (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
    }

    // True anomaly
    const cosE = Math.cos(E);
    const sinE = Math.sin(E);
    const denom = 1 - ecc * cosE;
    const sinV = (sqrtE * sinE) / denom;
    const cosV = (cosE - ecc) / denom;

    // Distance and position in orbital plane
    const r = a * denom;
    const xOrb = r * cosV;
    const yOrb = r * sinV;

    // Apply pre-computed rotation matrix → ECI → scene
    const idx = i * 3;
    out[idx] = (buf[off + 6] * xOrb + buf[off + 7] * yOrb) * SCALE;
    out[idx + 1] = (buf[off + 10] * xOrb + buf[off + 11] * yOrb) * SCALE;
    out[idx + 2] = (buf[off + 8] * xOrb + buf[off + 9] * yOrb) * SCALE;
  }
}

/**
 * Returns the orbit plane basis vectors (P and Q) in scene coordinates
 * for a satellite. These define the orbital plane orientation.
 */
export function getOrbitPlaneVectors(
  cache: OrbitCache,
  satIndex: number,
): { px: number; py: number; pz: number; qx: number; qy: number; qz: number } {
  const off = satIndex * STRIDE;
  const { buf } = cache;
  return {
    px: buf[off + 6],  py: buf[off + 10], pz: buf[off + 8],
    qx: buf[off + 7],  qy: buf[off + 11], qz: buf[off + 9],
  };
}

/**
 * Compute the full orbit path (one revolution) for a single satellite.
 * Returns a Float32Array of (ORBIT_SEGMENTS + 1) * 3 values (closed loop).
 */
export function computeOrbitPath(
  cache: OrbitCache,
  satIndex: number,
): Float32Array {
  const segments = ORBIT_SEGMENTS;
  const out = new Float32Array((segments + 1) * 3);
  const off = satIndex * STRIDE;
  const { buf } = cache;

  const ecc = buf[off + 3];
  const a = buf[off + 4];
  const sqrtE = buf[off + 5];

  for (let i = 0; i <= segments; i++) {
    const M = (i / segments) * TWO_PI;

    // Solve Kepler
    let E = M;
    for (let j = 0; j < 6; j++) {
      E -= (E - ecc * Math.sin(E) - M) / (1 - ecc * Math.cos(E));
    }

    const cosE = Math.cos(E);
    const sinE = Math.sin(E);
    const denom = 1 - ecc * cosE;
    const cosV = (cosE - ecc) / denom;
    const sinV = (sqrtE * sinE) / denom;

    const r = a * denom;
    const xOrb = r * cosV;
    const yOrb = r * sinV;

    const idx = i * 3;
    out[idx] = (buf[off + 6] * xOrb + buf[off + 7] * yOrb) * SCALE;
    out[idx + 1] = (buf[off + 10] * xOrb + buf[off + 11] * yOrb) * SCALE;
    out[idx + 2] = (buf[off + 8] * xOrb + buf[off + 9] * yOrb) * SCALE;
  }

  return out;
}
