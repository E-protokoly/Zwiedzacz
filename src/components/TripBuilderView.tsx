import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Printer,
  Compass,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Plane,
  FolderOpen,
  Sparkles,
} from 'lucide-react';
import {
  SavedTripPlan,
  TravelStyle,
  TripStop,
  UserCountryData,
  VisitStatus,
} from '../types/travel.ts';
import {
  ALL_COUNTRIES,
  COUNTRIES_BY_CODE,
  MONTHS_PL,
  VISA_LABELS_PL,
  RISK_LABELS_PL,
  USD_TO_PLN,
} from '../data/index.ts';
import { CountryFlag } from './CountryFlag.tsx';

interface TripBuilderViewProps {
  tripName: string;
  targetMonth: number;
  travelStyle: TravelStyle;
  estimatedFlightsUsd: number;
  stops: TripStop[];
  isDirty: boolean;
  savedTrips: SavedTripPlan[];
  userProgress: Record<string, UserCountryData>;
  onChangeTripName: (name: string) => void;
  onChangeTargetMonth: (month: number) => void;
  onChangeTravelStyle: (style: TravelStyle) => void;
  onChangeFlightsUsd: (usd: number) => void;
  onAddStop: (countryCode: string) => void;
  onRemoveStop: (countryCode: string) => void;
  onMoveStop: (index: number, direction: 'up' | 'down') => void;
  onUpdateStopDays: (countryCode: string, days: number) => void;
  onUpdateStopCustomUsd: (countryCode: string, customUsd?: number) => void;
  onUpdateStopNotes: (countryCode: string, notes: string) => void;
  onSaveCurrentTrip: () => void;
  onLoadSavedTrip: (trip: SavedTripPlan) => void;
  onDeleteSavedTrip: (tripId: string) => void;
  onClearDraft: () => void;
  onSelectCountry: (code: string) => void;
  onMarkTripCountriesStatus: (codes: string[], status: VisitStatus) => void;
}

export const TripBuilderView: React.FC<TripBuilderViewProps> = ({
  tripName,
  targetMonth,
  travelStyle,
  estimatedFlightsUsd,
  stops,
  isDirty,
  savedTrips,
  userProgress,
  onChangeTripName,
  onChangeTargetMonth,
  onChangeTravelStyle,
  onChangeFlightsUsd,
  onAddStop,
  onRemoveStop,
  onMoveStop,
  onUpdateStopDays,
  onUpdateStopCustomUsd,
  onUpdateStopNotes,
  onSaveCurrentTrip,
  onLoadSavedTrip,
  onDeleteSavedTrip,
  onClearDraft,
  onSelectCountry,
  onMarkTripCountriesStatus,
}) => {
  const [countrySearchQuery, setCountrySearchQuery] = useState<string>('');
  const [saveFeedback, setSaveFeedback] = useState<boolean>(false);

  const stopCodes = useMemo(() => stops.map((s) => s.countryCode), [stops]);

  const enrichedStops = useMemo(() => {
    return stops
      .map((stop) => {
        const country = COUNTRIES_BY_CODE[stop.countryCode];
        if (!country) return null;
        const defaultDailyUsd =
          country.dailyCostUsd[travelStyle] ?? country.dailyCostUsd.mid;
        const effectiveDailyUsd = stop.customDailyUsd ?? defaultDailyUsd;
        const subtotalUsd = effectiveDailyUsd * stop.days;
        const isGoodMonth = country.bestMonths.includes(targetMonth);
        return {
          stop,
          country,
          defaultDailyUsd,
          effectiveDailyUsd,
          subtotalUsd,
          isGoodMonth,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [stops, travelStyle, targetMonth]);

  const suggestedNearbyCountries = useMemo(() => {
    const neighborSet = new Set<string>();
    for (const code of stopCodes) {
      const country = COUNTRIES_BY_CODE[code];
      if (country) {
        for (const nCode of country.neighbors) {
          if (!stopCodes.includes(nCode)) {
            neighborSet.add(nCode);
          }
        }
      }
    }
    return Array.from(neighborSet)
      .map((code) => COUNTRIES_BY_CODE[code])
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .sort((a, b) => {
        const aVisited = (userProgress[a.code]?.status ?? 'UNVISITED') === 'VISITED' ? 1 : 0;
        const bVisited = (userProgress[b.code]?.status ?? 'UNVISITED') === 'VISITED' ? 1 : 0;
        if (aVisited !== bVisited) return aVisited - bVisited;
        return a.riskLevel - b.riskLevel;
      });
  }, [stopCodes, userProgress]);

  const quickSearchCountries = useMemo(() => {
    const q = countrySearchQuery.trim().toLowerCase();
    if (!q) return [];
    return ALL_COUNTRIES.filter(
      (c) =>
        !stopCodes.includes(c.code) &&
        (c.namePl.toLowerCase().includes(q) ||
          c.nameEn.toLowerCase().includes(q) ||
          c.capitalPl.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [countrySearchQuery, stopCodes]);

  const totalDays = useMemo(
    () => enrichedStops.reduce((sum, item) => sum + item.stop.days, 0),
    [enrichedStops]
  );

  const groundTotalUsd = useMemo(
    () => enrichedStops.reduce((sum, item) => sum + item.subtotalUsd, 0),
    [enrichedStops]
  );

  const grandTotalUsd = groundTotalUsd + (estimatedFlightsUsd || 0);
  const grandTotalPln = Math.round(grandTotalUsd * USD_TO_PLN);

  const weatherWarnings = useMemo(
    () => enrichedStops.filter((item) => !item.isGoodMonth),
    [enrichedStops]
  );

  const embassyVisaCountries = useMemo(
    () =>
      enrichedStops.filter((item) => item.country.visaForPl === 'EMBASSY_VISA'),
    [enrichedStops]
  );

  const evisaCountries = useMemo(
    () =>
      enrichedStops.filter((item) => item.country.visaForPl === 'EVISA_VOA'),
    [enrichedStops]
  );

  const handleSaveClick = () => {
    onSaveCurrentTrip();
    setSaveFeedback(true);
    setTimeout(() => setSaveFeedback(false), 2500);
  };

  const selectedMonthLabel =
    MONTHS_PL.find((m) => m.id === targetMonth)?.full ?? 'Maj';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Main Left Column: Active Package Builder (8 cols) */}
      <div className="lg:col-span-8 space-y-6">
        {/* Trip Configuration Header Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/70 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>Kreator Wypraw Pakietowych</span>
                <span>·</span>
                <span className="font-mono tabular-nums">
                  {stops.length} państw na trasie
                </span>
                {isDirty && (
                  <>
                    <span>·</span>
                    <span className="text-amber-700 dark:text-amber-400 font-medium">
                      Szkic roboczy (zapisano lokalnie)
                    </span>
                  </>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50 mt-0.5">
                Konfiguracja wielokrajowego pakietu podróży
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              <button
                type="button"
                onClick={() => window.print()}
                disabled={stops.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                Drukuj / PDF
              </button>
              <button
                type="button"
                onClick={onClearDraft}
                disabled={stops.length === 0}
                className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Wyczyść trasę
              </button>
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={stops.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                {saveFeedback ? 'Zapisano wyprawę ✓' : 'Zapisz wyprawę'}
              </button>
            </div>
          </div>

          {/* Controlled Configuration Form Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="trip-name-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                Nazwa wyprawy pakietowej
              </label>
              <input
                id="trip-name-input"
                type="text"
                value={tripName ?? ''}
                onChange={(e) => onChangeTripName(e.target.value)}
                placeholder="np. Trójkąt Gujański + Trynidad 2027"
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#122144]"
              />
            </div>

            <div>
              <label
                htmlFor="trip-month-select"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                Planowany miesiąc wyjazdu
              </label>
              <select
                id="trip-month-select"
                value={targetMonth ?? 5}
                onChange={(e) => onChangeTargetMonth(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#122144]"
              >
                {MONTHS_PL.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id}. {m.full}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="trip-flights-input"
                className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
              >
                Bilety międzykontynentalne (USD)
              </label>
              <input
                id="trip-flights-input"
                type="number"
                min={0}
                step={20}
                value={estimatedFlightsUsd ?? 0}
                onChange={(e) =>
                  onChangeFlightsUsd(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#122144] font-mono tabular-nums"
              />
            </div>
          </div>

          {/* Standard & Quick Add Country Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800 no-print">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Standard podróży:
              </span>
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    { id: 'budget', label: 'Backpacker' },
                    { id: 'mid', label: 'Komfort (3*)' },
                    { id: 'comfort', label: 'Premium (4-5*)' },
                  ] as const
                ).map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => onChangeTravelStyle(tier.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      travelStyle === tier.id
                        ? 'bg-[#122144] dark:bg-sky-600 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                value={countrySearchQuery ?? ''}
                onChange={(e) => setCountrySearchQuery(e.target.value)}
                placeholder="+ Dodaj dowolny kraj z 195 do trasy..."
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#122144]"
              />
              {quickSearchCountries.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg divide-y divide-slate-100 dark:divide-slate-700 max-h-64 overflow-y-auto">
                  {quickSearchCountries.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        onAddStop(c.code);
                        setCountrySearchQuery('');
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700/60 flex items-center justify-between gap-2"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate inline-flex items-center gap-1.5">
                        <CountryFlag code={c.code} size="xs" />
                        <span>{c.namePl}</span>{' '}
                        <span className="text-slate-400 font-normal">
                          ({c.capitalPl})
                        </span>
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        + {c.recommendedDays}d
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Route Stops List */}
        {enrichedStops.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
            <Compass className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Twoja trasa pakietowa jest jeszcze pusta
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              Wyszukaj pierwszy kraj powyżej, kliknij „Pakiet” przy dowolnym państwie w Katalogu 195 lub wczytaj gotowy pakiet z zakładki Klastry Regionalne.
            </p>
            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onAddStop('GY');
                  onAddStop('SR');
                  onAddStop('TT');
                  onChangeTripName('Trójkąt Gujański + Trynidad');
                  onChangeFlightsUsd(820);
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Przykład: Gujana + Surinam + Trynidad (3 kraje)
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddStop('KZ');
                  onAddStop('KG');
                  onAddStop('UZ');
                  onAddStop('TJ');
                  onAddStop('TM');
                  onChangeTripName('Azja Centralna — 5 Stanów');
                  onChangeFlightsUsd(520);
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Przykład: 5 „Stanów” Azji Centralnej
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl divide-y divide-slate-200/70 dark:divide-slate-800">
            <div className="px-6 py-3.5 bg-slate-50/70 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-2 rounded-t-xl">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Kolejność etapów wyprawy ({enrichedStops.length} państw · {totalDays} dni na miejscu)
              </span>
              <div className="flex items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() => onMarkTripCountriesStatus(stopCodes, 'PLANNED')}
                  className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white underline"
                >
                  Oznacz wszystkie jako „W planach”
                </button>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <button
                  type="button"
                  onClick={() => onMarkTripCountriesStatus(stopCodes, 'VISITED')}
                  className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 underline"
                >
                  Oznacz wszystkie jako „Odwiedzone”
                </button>
              </div>
            </div>

            {enrichedStops.map(
              (
                {
                  stop,
                  country,
                  defaultDailyUsd,
                  subtotalUsd,
                  isGoodMonth,
                },
                idx
              ) => {
                const status =
                  userProgress[country.code]?.status ?? 'UNVISITED';

                return (
                  <div
                    key={country.code}
                    className="p-5 flex flex-col gap-3 hover:bg-slate-50/40 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {/* Stop Index & Country Title */}
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onSelectCountry(country.code)}
                              className="text-sm font-bold text-slate-900 dark:text-slate-50 hover:underline flex items-center gap-2"
                            >
                              <CountryFlag code={country.code} size="sm" />
                              <span>{country.namePl}</span>
                            </button>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              Stolica: {country.capitalPl}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              {VISA_LABELS_PL[country.visaForPl].short}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span
                              className={`text-xs ${
                                country.riskLevel <= 2
                                  ? 'text-slate-600 dark:text-slate-300'
                                  : 'text-amber-700 dark:text-amber-400 font-medium'
                              }`}
                            >
                              {RISK_LABELS_PL[country.riskLevel].short}
                            </span>
                            {status === 'VISITED' && (
                              <>
                                <span className="text-xs text-slate-400">·</span>
                                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                                  Już odwiedzony
                                </span>
                              </>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {isGoodMonth ? (
                              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                {selectedMonthLabel}: optymalny sezon pogodowy
                              </span>
                            ) : (
                              <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                {selectedMonthLabel}: poza głównym oknem pogodowym
                              </span>
                            )}
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {country.visaNotePl}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controls: Days, Daily Cost, Subtotal, Reorder */}
                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <div>
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                            Liczba dni
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={90}
                            value={stop.days ?? 1}
                            onChange={(e) =>
                              onUpdateStopDays(
                                country.code,
                                Math.max(1, Number(e.target.value) || 1)
                              )
                            }
                            className="w-16 px-2 py-1 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#122144]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                            Stawka USD/dzień
                          </label>
                          <input
                            type="number"
                            min={10}
                            max={2000}
                            value={stop.customDailyUsd ?? defaultDailyUsd}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              onUpdateStopCustomUsd(
                                country.code,
                                val > 0 ? val : undefined
                              );
                            }}
                            className="w-20 px-2 py-1 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#122144]"
                          />
                        </div>

                        <div className="text-right min-w-[85px]">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Suma etapu
                          </div>
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                            ${subtotalUsd}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 no-print">
                          <button
                            type="button"
                            onClick={() => onMoveStop(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 rounded"
                            title="Przesuń wyżej"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onMoveStop(idx, 'down')}
                            disabled={idx === enrichedStops.length - 1}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 rounded"
                            title="Przesuń niżej"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveStop(country.code)}
                            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                            title="Usuń z trasy"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Optional per-stop logistic note */}
                    <div className="pl-9">
                      <input
                        type="text"
                        value={stop.notes ?? ''}
                        onChange={(e) =>
                          onUpdateStopNotes(country.code, e.target.value)
                        }
                        placeholder={`Notatka dla etapu ${country.namePl} (np. przekroczenie granicy lądowej, lot, nocleg)...`}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-[#122144]"
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* SMART SUGGESTIONS */}
        {suggestedNearbyCountries.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-4 no-print">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#122144] dark:text-sky-400" />
                  Rekomendacje pakietowe — które kraje są tuż obok Twojej trasy?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Poniższe państwa graniczą lądowo lub mają bezpośrednie krótkie połączenie z krajami z Twojej obecnej trasy. Możesz dołożyć je jednym kliknięciem:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestedNearbyCountries.slice(0, 8).map((neighbor) => {
                const status =
                  userProgress[neighbor.code]?.status ?? 'UNVISITED';
                const dailyUsd =
                  neighbor.dailyCostUsd[travelStyle] ??
                  neighbor.dailyCostUsd.mid;
                const connectsVia = stops
                  .map((s) => COUNTRIES_BY_CODE[s.countryCode])
                  .filter(
                    (c): c is NonNullable<typeof c> =>
                      Boolean(c) && c.neighbors.includes(neighbor.code)
                  )
                  .map((c) => c.namePl)
                  .join(', ');

                return (
                  <div
                    key={neighbor.code}
                    className="p-3 border border-slate-200/80 dark:border-slate-800 rounded-lg flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onSelectCountry(neighbor.code)}
                        className="text-xs font-bold text-slate-900 dark:text-slate-100 hover:underline flex items-center gap-1.5 truncate"
                      >
                        <CountryFlag code={neighbor.code} size="xs" />
                        <span>{neighbor.namePl}</span>
                        {status === 'VISITED' && (
                          <span className="font-normal text-emerald-700 dark:text-emerald-400">
                            (Odwiedzony)
                          </span>
                        )}
                      </button>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        Blisko: {connectsVia}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                        ~{neighbor.recommendedDays}d · ${dailyUsd}/d ·{' '}
                        <span className="font-sans">
                          {VISA_LABELS_PL[neighbor.visaForPl].short}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onAddStop(neighbor.code)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Dołóż
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Financial, Visa & Weather Summary + Saved Trips (4 cols) */}
      <div className="lg:col-span-4 space-y-6">
        {/* Financial & Logistic Summary Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Podsumowanie pakietu
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 mt-0.5">
              {tripName || 'Nowa wyprawa pakietowa'}
            </h3>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Liczba państw w pakiecie:
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {enrichedStops.length} krajów
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Łączny czas trwania:
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                {totalDays} dni
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                Koszty pobytu na miejscu:
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                ${groundTotalUsd.toLocaleString('en-US')} USD
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Plane className="w-3.5 h-3.5 text-slate-400" />
                Szacowane przeloty główne:
              </span>
              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                ${(estimatedFlightsUsd || 0).toLocaleString('en-US')} USD
              </span>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-baseline justify-between">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-50">
                Całkowity budżet:
              </span>
              <div className="text-right">
                <div className="text-lg font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                  ${grandTotalUsd.toLocaleString('en-US')} USD
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  ok. {grandTotalPln.toLocaleString('pl-PL')} PLN
                </div>
              </div>
            </div>
          </div>

          {/* Weather & Visa Validation */}
          {enrichedStops.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200/70 dark:border-slate-800 text-xs">
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Walidacja sezonu ({selectedMonthLabel}) i wiz PL
              </div>

              {weatherWarnings.length === 0 ? (
                <div className="text-emerald-700 dark:text-emerald-400 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Wszystkie kraje w pakiecie mają w miesiącu{' '}
                    <strong>{selectedMonthLabel}</strong> dobre warunki pogodowe.
                  </span>
                </div>
              ) : (
                <div className="text-amber-800 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    Uwaga pogodowa ({selectedMonthLabel}): poza optymalnym sezonem dla{' '}
                    <strong>
                      {weatherWarnings.map((w) => w.country.namePl).join(', ')}
                    </strong>
                    .
                  </span>
                </div>
              )}

              <div className="space-y-1 text-slate-600 dark:text-slate-400">
                <div>
                  • Wiza w ambasadzie przed wyjazdem:{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {embassyVisaCountries.length}
                  </strong>
                  {embassyVisaCountries.length > 0 &&
                    ` (${embassyVisaCountries
                      .map((c) => c.country.namePl)
                      .join(', ')})`}
                </div>
                <div>
                  • e-Wiza online lub wiza na lotnisku (VOA):{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {evisaCountries.length}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Saved Trips List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-4 no-print">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
              <FolderOpen className="w-4 h-4 text-slate-500" />
              Zapisane wyprawy ({savedTrips.length})
            </h3>
          </div>

          {savedTrips.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Nie masz jeszcze zapisanych wypraw. Skonfiguruj trasę powyżej i kliknij „Zapisz wyprawę”, aby zachować ją na liście.
            </p>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-lg">
              {savedTrips.map((trip) => {
                const days = trip.stops.reduce((s, item) => s + item.days, 0);
                const mName =
                  MONTHS_PL.find((m) => m.id === trip.targetMonth)?.short ?? '';

                return (
                  <div
                    key={trip.id}
                    className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onLoadSavedTrip(trip)}
                      className="text-left min-w-0 flex-1 group"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:underline truncate">
                        {trip.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                        {trip.stops.length} państw · {days} dni · {mName}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSavedTrip(trip.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                      title="Usuń zapisaną wyprawę"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
