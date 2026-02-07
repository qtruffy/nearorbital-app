import { NextResponse } from 'next/server';

/* -------------------------------------------------------------------------- */
/*                               CONFIGURATION                                */
/* -------------------------------------------------------------------------- */

export const dynamic = 'force-static';
export const revalidate = 7200; // 2 heures (prod ISR)

const DEV_CACHE_TTL = 7_200_000; // 2 heures (ms)

const CELESTRAK_URLS = [
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json',
  'https://www.celestrak.com/NORAD/elements/gp.php?GROUP=active&FORMAT=json',
];

/* -------------------------------------------------------------------------- */
/*                                    TYPES                                   */
/* -------------------------------------------------------------------------- */

/** Type brut CelesTrak (on ne déclare que ce qu'on utilise) */
interface CelestrakGpRaw {
  NORAD_CAT_ID: number;
  OBJECT_NAME: string;
  EPOCH: string;

  TLE_LINE1: string;
  TLE_LINE2: string;

  INCLINATION: number;
  ECCENTRICITY: number;
  MEAN_MOTION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
}

/** Type exposé par ton API */
export interface SatelliteGp {
  id: number;
  name: string;
  epoch: string;

  tle1: string;
  tle2: string;

  inc: number;
  ecc: number;
  mm: number;
  raan: number;
  argp: number;
  ma: number;
}

/** Payload final */
interface ApiResponse {
  updatedAt: string;
  count: number;
  source: string;
  data: SatelliteGp[];
}

/* -------------------------------------------------------------------------- */
/*                              CACHE DEV (RAM)                               */
/* -------------------------------------------------------------------------- */

let devCache: {
  timestamp: number;
  payload: ApiResponse;
} | null = null;

/* -------------------------------------------------------------------------- */
/*                                 UTILITIES                                  */
/* -------------------------------------------------------------------------- */

function mapSatellite(raw: CelestrakGpRaw): SatelliteGp {
  return {
    id: raw.NORAD_CAT_ID,
    name: raw.OBJECT_NAME,
    epoch: raw.EPOCH,

    tle1: raw.TLE_LINE1,
    tle2: raw.TLE_LINE2,

    inc: raw.INCLINATION,
    ecc: raw.ECCENTRICITY,
    mm: raw.MEAN_MOTION,
    raan: raw.RA_OF_ASC_NODE,
    argp: raw.ARG_OF_PERICENTER,
    ma: raw.MEAN_ANOMALY,
  };
}

async function fetchWithTimeout<T>(
  url: string,
  timeoutMs = 10_000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/*                                   HANDLER                                  */
/* -------------------------------------------------------------------------- */

export async function GET() {
  const isDev = process.env.NODE_ENV === 'development';

  /* --------------------------- CACHE DEV (HIT) ---------------------------- */
  if (isDev && devCache) {
    const age = Date.now() - devCache.timestamp;
    if (age < DEV_CACHE_TTL) {
      return NextResponse.json(devCache.payload);
    }
  }

  /* ----------------------------- FETCH REMOTE ----------------------------- */
  for (const url of CELESTRAK_URLS) {
    try {
      const raw = await fetchWithTimeout<CelestrakGpRaw[]>(url);

      const data = raw.map(mapSatellite);

      const payload: ApiResponse = {
        updatedAt: new Date().toISOString(),
        count: data.length,
        source: 'CelesTrak (USSF / 18 SDS)',
        data,
      };

      /* -------------------------- CACHE DEV (SET) -------------------------- */
      if (isDev) {
        devCache = {
          timestamp: Date.now(),
          payload,
        };
      }

      return NextResponse.json(payload, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=0, s-maxage=7200',
        },
      });
    } catch {
      // fallback miroir
    }
  }

  /* -------------------------------- ERROR -------------------------------- */
  return NextResponse.json(
    { error: 'All CelesTrak endpoints failed' },
    { status: 503 }
  );
}
