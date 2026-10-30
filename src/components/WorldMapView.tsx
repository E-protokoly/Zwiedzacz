import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Compass,
  Save,
  Trash2,
  ArrowRight,
  Sparkles,
  Check,
  MousePointerClick,
  Newspaper,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import {
  Continent,
  TravelStyle,
  TripStop,
  UserCountryData,
  VisitStatus,
} from '../types/travel.ts';
import {
  ALL_COUNTRIES,
  COUNTRIES_BY_CODE,
  VISA_LABELS_PL,
  USD_TO_PLN,
} from '../data/index.ts';
import { COUNTRY_COORDINATES } from '../data/countryCoordinates.ts';
import { CountryFlag } from './CountryFlag.tsx';

type MapClickMode = 'select_trip' | 'inspect_news' | 'toggle_visited';

interface WorldMapViewProps {
  tripName: string;
  stops: TripStop[];
  travelStyle: TravelStyle;
  estimatedFlightsUsd: number;
  userProgress: Record<string, UserCountryData>;
  isDarkMode?: boolean;
  onChangeTripName: (name: string) => void;
  onToggleCountryInTrip: (code: string) => void;
  onSelectCountryForNews: (code: string) => void;
  onToggleVisitedStatus: (code: string) => void;
  onSaveTrip: () => void;
  onClearTrip: () => void;
  onOpenInBuilder: () => void;
}

const REGION_VIEWS: {
  id: Continent | 'WORLD';
  label: string;
  center: [number, number];
  zoom: number;
}[] = [
  { id: 'WORLD', label: 'Cały Świat', center: [18, 15], zoom: 2 },
  { id: 'Europa', label: 'Europa', center: [50, 15], zoom: 4 },
  { id: 'Azja', label: 'Azja', center: [28, 85], zoom: 3 },
  { id: 'Afryka', label: 'Afryka', center: [2, 18], zoom: 3 },
  {
    id: 'Ameryka Północna i Karaiby',
    label: 'Ameryka Płn. i Karaiby',
    center: [21, -78],
    zoom: 4,
  },
  {
    id: 'Ameryka Południowa',
    label: 'Ameryka Płd.',
    center: [-16, -60],
    zoom: 3,
  },
  { id: 'Oceania', label: 'Oceania i Pacyfik', center: [-14, 168], zoom: 4 },
];

export const WorldMapView: React.FC<WorldMapViewProps> = ({
  tripName,
  stops,
  travelStyle,
  estimatedFlightsUsd,
  userProgress,
  isDarkMode = false,
  onChangeTripName,
  onToggleCountryInTrip,
  onSelectCountryForNews,
  onToggleVisitedStatus,
  onSaveTrip,
  onClearTrip,
  onOpenInBuilder,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [clickMode, setClickMode] = useState<MapClickMode>('select_trip');
  const [activeRegion, setActiveRegion] = useState<Continent | 'WORLD'>('WORLD');
  const [savedBanner, setSavedBanner] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<VisitStatus | 'ALL'>('ALL');

  const clickModeRef = useRef<MapClickMode>(clickMode);
  clickModeRef.current = clickMode;

  const callbacksRef = useRef({
    onToggleCountryInTrip,
    onSelectCountryForNews,
    onToggleVisitedStatus,
  });
  callbacksRef.current = {
    onToggleCountryInTrip,
    onSelectCountryForNews,
    onToggleVisitedStatus,
  };

  const stopCodes = useMemo(() => stops.map((s) => s.countryCode), [stops]);

  const neighborCodesOfTrip = useMemo(() => {
    const set = new Set<string>();
    for (const code of stopCodes) {
      const country = COUNTRIES_BY_CODE[code];
      if (country) {
        for (const n of country.neighbors) {
          if (!stopCodes.includes(n)) {
            set.add(n);
          }
        }
      }
    }
    return set;
  }, [stopCodes]);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [18, 15],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      worldCopyJump: true,
      zoomControl: true,
    });

    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    const tileLayer = L.tileLayer(tileUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    tileLayerRef.current = tileLayer;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch CartoDB tile layer dynamically when Dark Mode toggles
  useEffect(() => {
    if (!tileLayerRef.current) return;
    const tileUrl = isDarkMode
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    tileLayerRef.current.setUrl(tileUrl);
  }, [isDarkMode]);

  // Re-render markers & route lines when stops, userProgress, filterStatus, or isDarkMode change
  useEffect(() => {
    const layerGroup = layerGroupRef.current;
    if (!layerGroup) return;

    layerGroup.clearLayers();

    // 1. Draw dashed suggestion lines from selected trip stops to their immediate neighbors
    for (const code of stopCodes) {
      const fromCoord = COUNTRY_COORDINATES[code];
      const country = COUNTRIES_BY_CODE[code];
      if (!fromCoord || !country) continue;

      for (const nCode of country.neighbors) {
        const toCoord = COUNTRY_COORDINATES[nCode];
        if (!toCoord || stopCodes.includes(nCode)) continue;
        if (Math.abs(fromCoord[1] - toCoord[1]) > 140) continue;

        L.polyline([fromCoord, toCoord], {
          color: isDarkMode ? '#94A3B8' : '#64748B',
          weight: 1.2,
          dashArray: '4, 6',
          opacity: 0.6,
        }).addTo(layerGroup);
      }
    }

    // 2. Draw solid route polyline connecting the selected stops in order
    const routeCoords: [number, number][] = [];
    for (const code of stopCodes) {
      const coord = COUNTRY_COORDINATES[code];
      if (coord) routeCoords.push(coord);
    }

    for (let i = 0; i < routeCoords.length - 1; i++) {
      const p1 = routeCoords[i];
      const p2 = routeCoords[i + 1];
      if (Math.abs(p1[1] - p2[1]) <= 160) {
        L.polyline([p1, p2], {
          color: isDarkMode ? '#38BDF8' : '#122144',
          weight: 3,
          opacity: 0.92,
        }).addTo(layerGroup);
      }
    }

    // 3. Plot all 195 country markers
    for (const country of ALL_COUNTRIES) {
      const coord = COUNTRY_COORDINATES[country.code];
      if (!coord) continue;

      const userStatus = userProgress[country.code]?.status ?? 'UNVISITED';
      const stopIndex = stopCodes.indexOf(country.code);
      const isInTrip = stopIndex !== -1;
      const isNeighborSuggestion = neighborCodesOfTrip.has(country.code);

      if (
        filterStatus !== 'ALL' &&
        userStatus !== filterStatus &&
        !isInTrip
      ) {
        continue;
      }

      const dailyUsd =
        country.dailyCostUsd[travelStyle] ?? country.dailyCostUsd.mid;

      let markerHtml = '';
      let iconSize: [number, number] = [24, 24];

      const flagImgHtml = `<img src="https://flagcdn.com/w40/${country.code.toLowerCase()}.png" alt="${country.code}" style="width:14px;height:10px;object-fit:cover;border-radius:1px;display:block;" />`;

      if (isInTrip) {
        iconSize = [30, 30];
        markerHtml = `
          <div style="
            width: 30px;
            height: 30px;
            border-radius: 9999px;
            background: ${isDarkMode ? '#0284C7' : '#122144'};
            color: #FFFFFF;
            border: 2px solid #FFFFFF;
            box-shadow: 0 2px 6px rgba(15,23,42,0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'JetBrains Mono', monospace;
            font-size: 11px;
            font-weight: 700;
          " title="${country.namePl}">
            ${stopIndex + 1}
          </div>
        `;
      } else if (isNeighborSuggestion) {
        iconSize = [24, 24];
        markerHtml = `
          <div style="
            width: 24px;
            height: 24px;
            border-radius: 9999px;
            background: #FEF3C7;
            color: #92400E;
            border: 2px solid #D97706;
            box-shadow: 0 1px 4px rgba(15,23,42,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${flagImgHtml}
          </div>
        `;
      } else if (userStatus === 'VISITED') {
        iconSize = [22, 22];
        markerHtml = `
          <div style="
            width: 22px;
            height: 22px;
            border-radius: 9999px;
            background: #16A34A;
            color: #FFFFFF;
            border: 1.5px solid #FFFFFF;
            box-shadow: 0 1px 3px rgba(15,23,42,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${flagImgHtml}
          </div>
        `;
      } else if (userStatus === 'PLANNED' || userStatus === 'WISHLIST') {
        iconSize = [22, 22];
        markerHtml = `
          <div style="
            width: 22px;
            height: 22px;
            border-radius: 9999px;
            background: #2563EB;
            color: #FFFFFF;
            border: 1.5px solid #FFFFFF;
            box-shadow: 0 1px 3px rgba(15,23,42,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${flagImgHtml}
          </div>
        `;
      } else {
        iconSize = [20, 20];
        markerHtml = `
          <div style="
            width: 20px;
            height: 20px;
            border-radius: 9999px;
            background: ${isDarkMode ? '#1E293B' : '#FFFFFF'};
            color: ${isDarkMode ? '#F8FAFC' : '#0F172A'};
            border: 1.5px solid #64748B;
            box-shadow: 0 1px 2px rgba(15,23,42,0.18);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${flagImgHtml}
          </div>
        `;
      }

      const icon = L.divIcon({
        className: 'custom-atlas-marker',
        html: markerHtml,
        iconSize,
        iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
      });

      const marker = L.marker(coord, { icon });

      const statusLabel =
        userStatus === 'VISITED'
          ? 'Odwiedzony'
          : userStatus === 'PLANNED'
          ? 'W planach'
          : userStatus === 'WISHLIST'
          ? 'Lista marzeń'
          : 'Nieodwiedzony';

      marker.bindTooltip(
        `<div style="font-family: 'DM Sans', sans-serif; font-size: 12px; line-height: 1.35;">
          <strong>${country.namePl}</strong> (${country.capitalPl})<br/>
          <span style="color:#475569;">Koszt: $${dailyUsd}/dzień · Ryzyko ${country.riskLevel}/4 · ${VISA_LABELS_PL[country.visaForPl].short}</span><br/>
          <span style="color:#122144; font-weight:600;">
            ${
              isInTrip
                ? `Etap #${stopIndex + 1} w Twojej wycieczce (kliknij, aby usunąć)`
                : isNeighborSuggestion
                ? 'Bliski sąsiad Twojej trasy — kliknij, aby dołożyć do pakietu!'
                : `Status: ${statusLabel} — kliknij, aby zaznaczyć`
            }
          </span>
        </div>`,
        {
          direction: 'top',
          offset: [0, -10],
          opacity: 0.97,
        }
      );

      marker.on('click', () => {
        const mode = clickModeRef.current;
        if (mode === 'select_trip') {
          callbacksRef.current.onToggleCountryInTrip(country.code);
        } else if (mode === 'inspect_news') {
          callbacksRef.current.onSelectCountryForNews(country.code);
        } else {
          callbacksRef.current.onToggleVisitedStatus(country.code);
        }
      });

      marker.addTo(layerGroup);
    }
  }, [
    stopCodes,
    neighborCodesOfTrip,
    userProgress,
    travelStyle,
    filterStatus,
    isDarkMode,
  ]);

  const handleRegionZoom = (
    regionId: Continent | 'WORLD',
    center: [number, number],
    zoom: number
  ) => {
    setActiveRegion(regionId);
    mapInstanceRef.current?.setView(center, zoom, { animate: true });
  };

  const enrichedStops = useMemo(() => {
    return stops
      .map((s) => {
        const c = COUNTRIES_BY_CODE[s.countryCode];
        if (!c) return null;
        const daily =
          s.customDailyUsd ??
          c.dailyCostUsd[travelStyle] ??
          c.dailyCostUsd.mid;
        return {
          stop: s,
          country: c,
          daily,
          subtotal: daily * s.days,
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [stops, travelStyle]);

  const suggestedNeighborsList = useMemo(() => {
    return Array.from(neighborCodesOfTrip)
      .map((code) => COUNTRIES_BY_CODE[code])
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .slice(0, 10);
  }, [neighborCodesOfTrip]);

  const totalDays = enrichedStops.reduce((sum, x) => sum + x.stop.days, 0);
  const groundUsd = enrichedStops.reduce((sum, x) => sum + x.subtotal, 0);
  const totalUsd = groundUsd + (estimatedFlightsUsd || 0);
  const totalPln = Math.round(totalUsd * USD_TO_PLN);

  const handleSave = () => {
    onSaveTrip();
    setSavedBanner(true);
    setTimeout(() => setSavedBanner(false), 2500);
  };

  return (
    <div className="space-y-5">
      {/* Top Map Controls & Mode Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Click Action Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Co robi kliknięcie na mapie:
          </span>
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setClickMode('select_trip')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                clickMode === 'select_trip'
                  ? 'bg-[#122144] dark:bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              Zaznaczaj kraje do wycieczki
            </button>
            <button
              type="button"
              onClick={() => setClickMode('inspect_news')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                clickMode === 'inspect_news'
                  ? 'bg-[#122144] dark:bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Otwórz zdjęcia i wiadomości
            </button>
            <button
              type="button"
              onClick={() => setClickMode('toggle_visited')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                clickMode === 'toggle_visited'
                  ? 'bg-[#122144] dark:bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Oznaczaj odwiedzone
            </button>
          </div>
        </div>

        {/* Region Quick Zooms & Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {REGION_VIEWS.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => handleRegionZoom(r.id, r.center, r.zoom)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeRegion === r.id
                  ? 'bg-slate-900 dark:bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              {r.label}
            </button>
          ))}

          <select
            value={filterStatus}
            onChange={(e) =>
              setFilterStatus(e.target.value as VisitStatus | 'ALL')
            }
            className="ml-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#122144]"
            aria-label="Filtruj znaczniki na mapie"
          >
            <option value="ALL">Pokaż: Wszystkie 195</option>
            <option value="UNVISITED">Tylko nieodwiedzone</option>
            <option value="VISITED">Tylko odwiedzone</option>
            <option value="PLANNED">W planach</option>
          </select>
        </div>
      </div>

      {/* Main Split: Interactive Map (8 cols) + Live Trip Builder Dock (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Map Container */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
          <div
            ref={mapContainerRef}
            className="w-full h-[560px] z-0 bg-slate-100 dark:bg-slate-950"
          />

          {/* Map Legend Bar */}
          <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-[#122144] dark:bg-sky-600 text-white font-mono text-[10px] font-bold inline-flex items-center justify-center">
                  1
                </span>
                <span>Wybrane do wycieczki ({stops.length})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-100 border-2 border-amber-600 inline-block" />
                <span>Sąsiedzi trasy („Zwiedź przy okazji”)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-600 inline-block" />
                <span>Odwiedzone</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 border border-slate-500 inline-block" />
                <span>Nieodwiedzone</span>
              </span>
            </div>
            <span className="text-slate-500 dark:text-slate-400">
              Wskazówka: przerywane linie łączą Twoją trasę z krajami sąsiednimi.
            </span>
          </div>
        </div>

        {/* Right Side Panel: Live Selected Trip from Map */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Wycieczka zaznaczona na mapie
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 mt-0.5">
                Twoja trasa ({stops.length} państw · {totalDays} dni)
              </h3>
            </div>
            {stops.length > 0 && (
              <button
                type="button"
                onClick={onClearTrip}
                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md transition-colors"
                title="Wyczyść zaznaczone kraje"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Trip Name Input */}
          <div>
            <label
              htmlFor="map-trip-name"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
            >
              Nazwa wycieczki
            </label>
            <input
              id="map-trip-name"
              type="text"
              value={tripName ?? ''}
              onChange={(e) => onChangeTripName(e.target.value)}
              placeholder="np. Mój pakiet azjatycki"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#122144]"
            />
          </div>

          {/* Selected Countries List */}
          {enrichedStops.length === 0 ? (
            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 rounded-lg text-center space-y-2">
              <Compass className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                Kliknij dowolne państwo na mapie, aby dodać je jako pierwszy przystanek wycieczki.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mapa automatycznie podświetli na żółto sąsiednie kraje, które możesz odwiedzić przy okazji!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-lg max-h-60 overflow-y-auto">
                {enrichedStops.map(({ stop, country, subtotal }, idx) => (
                  <div
                    key={country.code}
                    className="px-3 py-2 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-[#122144] dark:bg-sky-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectCountryForNews(country.code)}
                        className="font-semibold text-slate-900 dark:text-slate-100 hover:underline truncate inline-flex items-center gap-1.5"
                        title="Kliknij, aby zobaczyć zdjęcia, wiadomości i szczegóły"
                      >
                        <CountryFlag code={country.code} size="xs" />
                        <span>{country.namePl}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      <span>{stop.days}d</span>
                      <span>·</span>
                      <span>${subtotal}</span>
                      <button
                        type="button"
                        onClick={() => onToggleCountryInTrip(country.code)}
                        className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 ml-1"
                        title="Usuń z wycieczki"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Nearby Suggestions on Map */}
              {suggestedNeighborsList.length > 0 && (
                <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-lg space-y-2">
                  <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    Blisko Twojej trasy (kliknij, aby dołożyć do wycieczki):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedNeighborsList.map((n) => (
                      <button
                        key={n.code}
                        type="button"
                        onClick={() => onToggleCountryInTrip(n.code)}
                        className="px-2 py-1 text-[11px] font-medium bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-slate-800 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded transition-colors inline-flex items-center gap-1"
                      >
                        <span>+</span>
                        <CountryFlag code={n.code} size="xs" />
                        <span>{n.namePl}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-baseline justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Szacowany koszt (z przelotem):
                </span>
                <div className="text-right font-mono tabular-nums">
                  <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    ${totalUsd.toLocaleString('en-US')} USD
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    ~{totalPln.toLocaleString('pl-PL')} PLN
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  {savedBanner ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Zapisano wycieczkę!
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Zapisz wycieczkę
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onOpenInBuilder}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <span>Szczegóły w Kreatorze</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
