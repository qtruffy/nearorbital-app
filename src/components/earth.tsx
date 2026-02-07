'use client';

import { useEarthScene } from '@/hooks/useEarthScene';
import { EARTH_RADIUS_KM, MU_EARTH_KM3S2 } from '@/utils/constants';
import { useCallback, useMemo, useRef, useState } from 'react';

const Earth = () => {
  const {
    containerRef,
    timeWarp,
    cycleTimeWarp,
    satellites,
    selectedSatellite,
    selectSatelliteByIndex,
  } = useEarthScene();

  /* ---- Search ---- */
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (query.length < 2) return [];
    const q = query.toUpperCase();
    const matches: { index: number; name: string }[] = [];
    for (let i = 0; i < satellites.length; i++) {
      if (satellites[i].name.toUpperCase().includes(q)) {
        matches.push({ index: i, name: satellites[i].name });
        if (matches.length >= 50) break;
      }
    }
    return matches;
  }, [query, satellites]);

  function handleSelectResult(index: number) {
    selectSatelliteByIndex(index);
    setQuery('');
    setSearchOpen(false);
    inputRef.current?.blur();
  }

  /* ---- Copy satellite name ---- */
  const [copied, setCopied] = useState(false);
  const copyName = useCallback(() => {
    if (!selectedSatellite) return;
    navigator.clipboard.writeText(selectedSatellite.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [selectedSatellite]);

  /* ---- Derived orbital info ---- */
  const info = useMemo(() => {
    if (!selectedSatellite) return null;
    const { mm, ecc } = selectedSatellite;
    const n = (mm * 2 * Math.PI) / 86400; // rad/s
    const a = Math.cbrt(MU_EARTH_KM3S2 / (n * n)); // km
    const periodMin = (1440 / mm).toFixed(1);
    const perigee = (a * (1 - ecc) - EARTH_RADIUS_KM).toFixed(0);
    const apogee = (a * (1 + ecc) - EARTH_RADIUS_KM).toFixed(0);
    return { a, periodMin, perigee, apogee };
  }, [selectedSatellite]);

  return (
    <div ref={containerRef} className="relative h-full w-full touch-none">
      {/* ── HUD overlay (pointer-events-none, children opt-in) ── */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* ── Top-left: Search + count ── */}
        <div className="pointer-events-auto absolute top-4 left-4 flex items-center gap-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              placeholder="Search satellite…"
              onChange={e => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                // Delay to allow click on result
                setTimeout(() => setSearchOpen(false), 200);
              }}
              className="w-52 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 placeholder-white/40 backdrop-blur-md transition-colors outline-none focus:bg-white/15"
            />
            {searchOpen && results.length > 0 && (
              <ul className="absolute top-full left-0 mt-1 max-h-64 w-72 overflow-y-auto rounded-xl bg-black/70 py-1 backdrop-blur-xl">
                {results.map(r => (
                  <li key={r.index}>
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => handleSelectResult(r.index)}
                      className="w-full px-4 py-2 text-left text-sm text-white/80 transition-colors hover:bg-white/10"
                    >
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {satellites.length > 0 && (
            <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/70 backdrop-blur-md">
              {satellites.length.toLocaleString()} satellites
            </span>
          )}
        </div>

        {/* ── Top-right: Selected satellite name ── */}
        {selectedSatellite && (
          <div className="pointer-events-auto absolute top-4 right-4">
            <button
              onClick={copyName}
              className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-md transition-colors active:bg-white/20 sm:hover:bg-white/20"
            >
              {selectedSatellite.name}
              {copied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-4 text-green-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="size-4 text-white/50"
                >
                  <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z" />
                  <path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z" />
                </svg>
              )}
            </button>
          </div>
        )}

        {/* ── Bottom-right: Satellite info panel ── */}
        {selectedSatellite && info && (
          <div className="pointer-events-auto absolute right-4 bottom-6 w-56 rounded-2xl bg-white/10 p-4 backdrop-blur-xl">
            <h3 className="mb-3 text-xs font-semibold tracking-wider text-white/50 uppercase">
              Orbital data
            </h3>
            <dl className="space-y-1.5 text-sm">
              <Row label="NORAD ID" value={String(selectedSatellite.id)} />
              <Row
                label="Inclination"
                value={`${selectedSatellite.inc.toFixed(2)}°`}
              />
              <Row
                label="Eccentricity"
                value={selectedSatellite.ecc.toFixed(5)}
              />
              <Row label="Period" value={`${info.periodMin} min`} />
              <Row label="Perigee" value={`${info.perigee} km`} />
              <Row label="Apogee" value={`${info.apogee} km`} />
              <Row
                label="RAAN"
                value={`${selectedSatellite.raan.toFixed(2)}°`}
              />
              <Row
                label="Arg Perigee"
                value={`${selectedSatellite.argp.toFixed(2)}°`}
              />
            </dl>
          </div>
        )}
      </div>

      {/* ── Bottom-center: Time warp button ── */}
      <button
        onClick={cycleTimeWarp}
        className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white/90 backdrop-blur-md transition-colors active:bg-white/20 sm:hover:bg-white/20"
      >
        {timeWarp === 1 ? '1x' : `${timeWarp}x`}
      </button>
    </div>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-white/50">{label}</dt>
      <dd className="font-mono text-white/90">{value}</dd>
    </div>
  );
}

export { Earth };
