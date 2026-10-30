import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  X,
  Compass,
  Sparkles,
  Calendar,
  Wallet,
  ShieldCheck,
  Check,
  Plus,
  ArrowRight,
  Command,
  SlidersHorizontal,
  Plane,
  Sun,
} from 'lucide-react';
import {
  CountryRecord,
  TravelCluster,
  TravelStyle,
  UserCountryData,
  VisitStatus,
} from '../types/travel.ts';
import {
  ALL_COUNTRIES,
  MONTHS_PL,
  RISK_LABELS_PL,
  VISA_LABELS_PL,
  USD_TO_PLN,
} from '../data/index.ts';
import { TRAVEL_CLUSTERS } from '../data/clusters.ts';
import { CountryFlag } from './CountryFlag.tsx';

interface CommandPaletteModalProps {
  isOpen: boolean;
  initialMode?: 'search' | 'matcher';
  userProgress: Record<string, UserCountryData>;
  travelStyle: TravelStyle;
  activeTripCodes: string[];
  onClose: () => void;
  onSelectCountry: (code: string) => void;
  onAddCountryToTrip: (code: string) => void;
  onUpdateStatus: (code: string, status: VisitStatus) => void;
  onLoadCustomPackage: (
    name: string,
    codes: string[],
    month: number,
    flightsUsd: number
  ) => void;
  onNavigateTab: (
    tab: 'catalog' | 'masterplan' | 'map' | 'clusters' | 'builder' | 'analytics'
  ) => void;
  onToggleDarkMode: () => void;
}

interface MatchedPackageRecommendation {
  id: string;
  title: string;
  subtitle: string;
  cluster: TravelCluster;
  countries: CountryRecord[];
  totalDays: number;
  groundCostUsd: number;
  flightsUsd: number;
  totalCostUsd: number;
  totalCostPln: number;
  weatherMatchRatio: number;
  visaFreeCount: number;
  maxRisk: number;
  score: number;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  initialMode = 'search',
  userProgress,
  travelStyle,
  activeTripCodes,
  onClose,
  onSelectCountry,
  onAddCountryToTrip,
  onUpdateStatus,
  onLoadCustomPackage,
  onNavigateTab,
  onToggleDarkMode,
}) => {
  const [mode, setMode] = useState<'search' | 'matcher'>(initialMode);
  const [query, setQuery] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Smart Vacation & Budget Matcher state
  const [vacationDays, setVacationDays] = useState<number>(12);
  const [vacationMonth, setVacationMonth] = useState<number>(
    new Date().getMonth() + 1
  );
  const [maxBudgetPln, setMaxBudgetPln] = useState<number>(10000);
  const [onlySafeCountries, setOnlySafeCountries] = useState<boolean>(true);
  const [onlyUnvisited, setOnlyUnvisited] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 20);
    }
  }, [isOpen, initialMode]);

  // Filtered countries & clusters for Quick Command Search
  const matchingCountries = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) {
      // Show top unvisited safe visa-free countries by default
      return ALL_COUNTRIES.filter(
        (c) =>
          (userProgress[c.code]?.status ?? 'UNVISITED') !== 'VISITED' &&
          c.riskLevel === 1
      ).slice(0, 8);
    }
    return ALL_COUNTRIES.filter(
      (c) =>
        c.namePl.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.capitalPl.toLowerCase().includes(q) ||
        c.code.toLowerCase() === q ||
        c.subregion.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query, userProgress]);

  const matchingClusters = useMemo(() => {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return TRAVEL_CLUSTERS.slice(0, 3);
    return TRAVEL_CLUSTERS.filter(
      (cl) =>
        cl.namePl.toLowerCase().includes(q) ||
        cl.subregion.toLowerCase().includes(q) ||
        cl.gatewayHub.toLowerCase().includes(q)
    ).slice(0, 4);
  }, [query]);

  // Algorithmic Vacation & Budget Matcher ("Dopasuj Wyprawę do Urlopu i Budżetu")
  const matchedRecommendations = useMemo<MatchedPackageRecommendation[]>(() => {
    const results: MatchedPackageRecommendation[] = [];

    for (const cluster of TRAVEL_CLUSTERS) {
      const clusterCountries = ALL_COUNTRIES.filter(
        (c) => c.clusterId === cluster.id
      );

      // Filter candidate countries according to user preferences
      let candidates = clusterCountries.filter((c) => {
        if (onlySafeCountries && c.riskLevel > 2) return false;
        if (!onlySafeCountries && c.riskLevel > 3) return false;
        if (
          onlyUnvisited &&
          (userProgress[c.code]?.status ?? 'UNVISITED') === 'VISITED'
        ) {
          return false;
        }
        return true;
      });

      if (candidates.length === 0) continue;

      // Sort candidates within the cluster: prioritize best weather in chosen month, visa-free, and lower daily cost
      candidates = [...candidates].sort((a, b) => {
        const aWeather = a.bestMonths.includes(vacationMonth) ? 1 : 0;
        const bWeather = b.bestMonths.includes(vacationMonth) ? 1 : 0;
        if (aWeather !== bWeather) return bWeather - aWeather;
        if (a.riskLevel !== b.riskLevel) return a.riskLevel - b.riskLevel;
        return (
          (a.dailyCostUsd[travelStyle] ?? a.dailyCostUsd.mid) -
          (b.dailyCostUsd[travelStyle] ?? b.dailyCostUsd.mid)
        );
      });

      // Greedily pack contiguous countries that fit within vacationDays
      const selected: CountryRecord[] = [];
      let accumulatedDays = 0;

      for (const c of candidates) {
        const minDaysForStop = Math.max(2, Math.min(c.recommendedDays, 5));
        if (
          selected.length === 0 ||
          accumulatedDays + minDaysForStop <= vacationDays + 1
        ) {
          selected.push(c);
          accumulatedDays += minDaysForStop;
        }
        if (accumulatedDays >= vacationDays || selected.length >= 5) break;
      }

      if (selected.length === 0) continue;

      // Distribute vacationDays proportionally or use accumulatedDays
      const effectiveDays = Math.min(
        vacationDays,
        selected.reduce((acc, c) => acc + c.recommendedDays, 0)
      );

      const avgDailyUsd =
        selected.reduce(
          (acc, c) => acc + (c.dailyCostUsd[travelStyle] ?? c.dailyCostUsd.mid),
          0
        ) / selected.length;

      const groundCostUsd = Math.round(avgDailyUsd * effectiveDays);
      const flightsUsd = cluster.estimatedFlightFromPlUsd;
      const totalCostUsd = groundCostUsd + flightsUsd;
      const totalCostPln = Math.round(totalCostUsd * USD_TO_PLN);

      if (totalCostPln > maxBudgetPln) continue;

      const weatherMatches = selected.filter((c) =>
        c.bestMonths.includes(vacationMonth)
      ).length;
      const weatherMatchRatio = Math.round(
        (weatherMatches / selected.length) * 100
      );

      const visaFreeCount = selected.filter(
        (c) => c.visaForPl === 'VISA_FREE' || c.visaForPl === 'EVISA_VOA'
      ).length;

      const maxRisk = Math.max(...selected.map((c) => c.riskLevel));

      // Score formula: reward weather match, number of countries unlocked, visa ease, and budget efficiency
      const score =
        weatherMatchRatio * 1.4 +
        selected.length * 18 +
        (visaFreeCount / selected.length) * 25 -
        maxRisk * 10 -
        totalCostPln / 1200;

      results.push({
        id: cluster.id,
        title: cluster.namePl,
        subtitle: selected.map((c) => c.namePl).join(' → '),
        cluster,
        countries: selected,
        totalDays: effectiveDays,
        groundCostUsd,
        flightsUsd,
        totalCostUsd,
        totalCostPln,
        weatherMatchRatio,
        visaFreeCount,
        maxRisk,
        score,
      });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 6);
  }, [
    vacationDays,
    vacationMonth,
    maxBudgetPln,
    onlySafeCountries,
    onlyUnvisited,
    travelStyle,
    userProgress,
  ]);

  // Keyboard navigation inside Command Palette
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (mode === 'search') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, Math.max(0, matchingCountries.length - 1))
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        } else if (e.key === 'Enter' && matchingCountries[selectedIndex]) {
          e.preventDefault();
          const target = matchingCountries[selectedIndex];
          onSelectCountry(target.code);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, mode, matchingCountries, selectedIndex, onSelectCountry, onClose]);

  if (!isOpen) return null;

  const selectedMonthLabel =
    MONTHS_PL.find((m) => m.id === vacationMonth)?.full ?? 'Czerwiec';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-16 px-4 bg-slate-950/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Mode Switcher Bar */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('search')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'search'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Command className="w-3.5 h-3.5" />
              <span>Paleta Poleceń i Szukaj (⌘K)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('matcher')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                mode === 'matcher'
                  ? 'bg-[#122144] dark:bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Generator Urlopowy (Urlop + Budżet)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="font-mono text-[11px]">ESC</span>
            <X className="w-4 h-4" />
          </button>
        </div>

        {mode === 'search' ? (
          <>
            {/* Search Input */}
            <div className="relative border-b border-slate-200/80 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query ?? ''}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Wpisz państwo, stolicę, kod ISO (np. JP, Kolumbia, Kaukaz)..."
                className="w-full pl-11 pr-4 py-3.5 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
            </div>

            {/* Results Area */}
            <div className="overflow-y-auto p-4 space-y-5">
              {/* Quick Navigation Shortcuts */}
              {!query.trim() && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-2">
                    Szybkie akcje
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('matcher')}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 text-left transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Wallet className="w-4 h-4 text-[#122144] dark:text-sky-400 shrink-0" />
                        <span className="text-xs font-medium truncate">
                          Dopasuj do urlopu i budżetu
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onNavigateTab('masterplan');
                        onClose();
                      }}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 text-left transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="text-xs font-medium truncate">
                          Optymalna Trasa 1 → 195
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onToggleDarkMode();
                        onClose();
                      }}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 text-left transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-medium truncate">
                          Przełącz motyw Jasny / Ciemny
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  </div>
                </div>
              )}

              {/* Matching Countries */}
              <div>
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {query.trim()
                      ? `Pasujące państwa (${matchingCountries.length})`
                      : 'Polecane nieodwiedzone państwa (Bezpieczne 1/4)'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ↑↓ nawigacja · Enter otwórz
                  </span>
                </div>

                {matchingCountries.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Brak państw pasujących do zapytania „{query}”.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/70 border border-slate-200/70 dark:border-slate-800 rounded-lg overflow-hidden">
                    {matchingCountries.map((country, idx) => {
                      const isSelected = idx === selectedIndex;
                      const isVisited =
                        (userProgress[country.code]?.status ?? 'UNVISITED') ===
                        'VISITED';
                      const inTrip = activeTripCodes.includes(country.code);
                      const dailyUsd =
                        country.dailyCostUsd[travelStyle] ??
                        country.dailyCostUsd.mid;

                      return (
                        <div
                          key={country.code}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          onClick={() => {
                            onSelectCountry(country.code);
                            onClose();
                          }}
                          className={`px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-slate-100/90 dark:bg-slate-800/80'
                              : 'bg-white dark:bg-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <CountryFlag code={country.code} size="md" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                  {country.namePl}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {country.code}
                                </span>
                                {isVisited && (
                                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                                    ✓ Odwiedzony
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {country.capitalPl} · {country.subregion} ·{' '}
                                {VISA_LABELS_PL[country.visaForPl].short}
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-3 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                              ${dailyUsd}/d
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                onUpdateStatus(
                                  country.code,
                                  isVisited ? 'UNVISITED' : 'VISITED'
                                )
                              }
                              className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                                isVisited
                                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {isVisited ? 'Odwiedzono' : 'Oznacz'}
                            </button>

                            <button
                              type="button"
                              onClick={() => onAddCountryToTrip(country.code)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                                inTrip
                                  ? 'bg-emerald-700 text-white'
                                  : 'bg-[#122144] dark:bg-sky-600 text-white hover:bg-slate-800 dark:hover:bg-sky-500'
                              }`}
                            >
                              {inTrip ? (
                                <>
                                  <Check className="w-3 h-3" />W trasie
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3 h-3" />
                                  Do trasy
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Matching Clusters */}
              {matchingClusters.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 px-2">
                    Regionalne klastry pakietowe
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchingClusters.map((cl) => {
                      const clusterCodes = ALL_COUNTRIES.filter(
                        (c) => c.clusterId === cl.id
                      ).map((c) => c.code);
                      return (
                        <div
                          key={cl.id}
                          className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {cl.namePl}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                              {clusterCodes.length} państw · ~
                              {cl.recommendedTotalDays} dni · lot ~${cl.estimatedFlightFromPlUsd}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onLoadCustomPackage(
                                cl.namePl,
                                clusterCodes,
                                cl.bestMonths[0] ?? 6,
                                cl.estimatedFlightFromPlUsd
                              );
                              onNavigateTab('builder');
                              onClose();
                            }}
                            className="px-2.5 py-1.5 text-xs font-medium bg-[#122144] dark:bg-sky-600 text-white rounded-md hover:bg-slate-800 dark:hover:bg-sky-500 shrink-0"
                          >
                            Wczytaj
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* MODE 2: SMART VACATION & BUDGET MATCHER ("Generator Urlopowy") */
          <div className="overflow-y-auto p-5 space-y-5">
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#122144] dark:text-sky-400" />
                    Dopasuj Pakiet Państw do Twojego Urlopu i Budżetu
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Algorytm wylicza łączny koszt z przelotem z Polski, dopasowanie pogodowe i sąsiedztwo państw:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Vacation Length */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Długość urlopu:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {vacationDays} dni
                    </strong>
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={28}
                    step={1}
                    value={vacationDays ?? 12}
                    onChange={(e) => setVacationDays(Number(e.target.value))}
                    className="w-full accent-[#122144] dark:accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-0.5">
                    <span>4 dni</span>
                    <span>14 dni</span>
                    <span>28 dni</span>
                  </div>
                </div>

                {/* Month Picker */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Miesiąc wyjazdu
                  </label>
                  <select
                    value={vacationMonth ?? 6}
                    onChange={(e) => setVacationMonth(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  >
                    {MONTHS_PL.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}. {m.full}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Max Total Budget in PLN */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Maks. budżet z lotem:{' '}
                    <strong className="font-mono tabular-nums text-slate-900 dark:text-white">
                      {maxBudgetPln.toLocaleString('pl-PL')} zł
                    </strong>
                  </label>
                  <input
                    type="range"
                    min={2500}
                    max={30000}
                    step={500}
                    value={maxBudgetPln ?? 10000}
                    onChange={(e) => setMaxBudgetPln(Number(e.target.value))}
                    className="w-full accent-[#122144] dark:accent-sky-500"
                  />
                  <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-0.5">
                    <span>2 500 zł</span>
                    <span>12 000 zł</span>
                    <span>30 000 zł</span>
                  </div>
                </div>
              </div>

              {/* Filter Toggles */}
              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200/70 dark:border-slate-700/70">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(onlySafeCountries)}
                    onChange={(e) => setOnlySafeCountries(e.target.checked)}
                    className="rounded border-slate-300 accent-[#122144] dark:accent-sky-500"
                  />
                  <span>Tylko bezpieczne kierunki (Ryzyko 1–2/4)</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(onlyUnvisited)}
                    onChange={(e) => setOnlyUnvisited(e.target.checked)}
                    className="rounded border-slate-300 accent-[#122144] dark:accent-sky-500"
                  />
                  <span>Pomiń kraje już odwiedzone</span>
                </label>
              </div>
            </div>

            {/* Ranked Recommendations */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Najlepiej dopasowane pakiety na {selectedMonthLabel} (
                  {matchedRecommendations.length})
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Koszt zawiera przelot z Polski + pobyt na miejscu
                </span>
              </div>

              {matchedRecommendations.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500">
                  Brak pakietów mieszczących się w budżecie{' '}
                  <strong className="font-mono">
                    {maxBudgetPln.toLocaleString('pl-PL')} zł
                  </strong>{' '}
                  z przelotem. Zwiększ delikatnie budżet lub zmniejsz liczbę dni.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {matchedRecommendations.map((rec, index) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[#122144] dark:text-sky-400">
                            #{index + 1}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {rec.title}
                          </h4>
                          <span
                            className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                              rec.weatherMatchRatio >= 75
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            Pogoda {selectedMonthLabel}: {rec.weatherMatchRatio}%
                          </span>
                        </div>

                        {/* Countries in this tailored sub-package */}
                        <div className="flex flex-wrap items-center gap-2">
                          {rec.countries.map((c, cIdx) => (
                            <React.Fragment key={c.code}>
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectCountry(c.code);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors"
                              >
                                <CountryFlag code={c.code} size="sm" />
                                <span>{c.namePl}</span>
                              </button>
                              {cIdx < rec.countries.length - 1 && (
                                <span className="text-slate-400 text-xs">→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />~{rec.totalDays}{' '}
                            dni ({rec.countries.length} państw)
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Plane className="w-3.5 h-3.5" />
                            Lot: ${rec.flightsUsd} + Pobyt: ${rec.groundCostUsd}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            {
                              RISK_LABELS_PL[rec.maxRisk as 1 | 2 | 3 | 4]
                                .short
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 dark:border-slate-800">
                        <div className="text-left sm:text-right font-mono tabular-nums">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            ~{rec.totalCostPln.toLocaleString('pl-PL')} PLN
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            (${rec.totalCostUsd} USD z lotem)
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onLoadCustomPackage(
                              `${rec.title} (${rec.countries.length} państw)`,
                              rec.countries.map((c) => c.code),
                              vacationMonth,
                              rec.flightsUsd
                            );
                            onNavigateTab('builder');
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#122144] dark:bg-sky-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors whitespace-nowrap"
                        >
                          <span>Wczytaj pakiet</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
