import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Check,
  Compass,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Moon,
  Sun,
  Command,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Continent,
  RiskLevel,
  SavedTripPlan,
  SortDirection,
  SortField,
  TravelStyle,
  TripStop,
  UserCountryData,
  VisaRequirementPL,
  VisitStatus,
} from './types/travel.ts';
import {
  ALL_COUNTRIES,
  COUNTRIES_BY_CODE,
  CLUSTERS_BY_ID,
  TRAVEL_CLUSTERS,
  MONTHS_PL,
  RISK_LABELS_PL,
  VISA_LABELS_PL,
  USD_TO_PLN,
  formatMonthsRange,
} from './data/index.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { CountryFlag } from './components/CountryFlag.tsx';
import { CountryInspectorModal } from './components/CountryInspectorModal.tsx';
import { ClustersView } from './components/ClustersView.tsx';
import { TripBuilderView } from './components/TripBuilderView.tsx';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { WorldMapView } from './components/WorldMapView.tsx';
import { TravelAssistantDrawer } from './components/TravelAssistantDrawer.tsx';
import { UnsavedChangesModal } from './components/UnsavedChangesModal.tsx';
import { MasterRouteView } from './components/MasterRouteView.tsx';
import { CommandPaletteModal } from './components/CommandPaletteModal.tsx';

type ActiveTab =
  | 'catalog'
  | 'masterplan'
  | 'map'
  | 'clusters'
  | 'builder'
  | 'analytics';
type CatalogViewMode = 'table' | 'cards';

const STORAGE_KEY_PROGRESS = 'atlas195_user_progress_v1';
const STORAGE_KEY_SAVED_TRIPS = 'atlas195_saved_trips_v1';
const STORAGE_KEY_ACTIVE_DRAFT = 'atlas195_active_draft_v1';
const STORAGE_KEY_DARK_MODE = 'atlas195_theme_dark_v1';

const INITIAL_PROGRESS: Record<string, UserCountryData> = {
  PL: {
    status: 'VISITED',
    visitedYear: 2024,
    notes: 'Baza startowa wypraw do 195 państw świata.',
  },
};

const DEFAULT_STOPS: TripStop[] = [
  { countryCode: 'SI', days: 3, notes: 'Lublana i jezioro Bled' },
  { countryCode: 'HR', days: 4, notes: 'Zagrzeb, Plitwice i Dubrownik' },
  { countryCode: 'BA', days: 3, notes: 'Mostar i Sarajewo' },
  { countryCode: 'ME', days: 3, notes: 'Zatoka Kotorska i Durmitor' },
  { countryCode: 'AL', days: 4, notes: 'Tirana, Berat i Riwiera Albańska' },
];

function readInitialDraft(): {
  tripName: string;
  targetMonth: number;
  travelStyle: TravelStyle;
  estimatedFlightsUsd: number;
  stops: TripStop[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_DRAFT);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const style: TravelStyle =
          parsed.travelStyle === 'budget' ||
          parsed.travelStyle === 'mid' ||
          parsed.travelStyle === 'comfort'
            ? parsed.travelStyle
            : 'mid';
        return {
          tripName:
            typeof parsed.tripName === 'string' && parsed.tripName.trim()
              ? parsed.tripName
              : 'Wielka Pętla Bałkańska',
          targetMonth:
            typeof parsed.targetMonth === 'number' &&
            parsed.targetMonth >= 1 &&
            parsed.targetMonth <= 12
              ? parsed.targetMonth
              : 6,
          travelStyle: style,
          estimatedFlightsUsd:
            typeof parsed.estimatedFlightsUsd === 'number' &&
            parsed.estimatedFlightsUsd >= 0
              ? parsed.estimatedFlightsUsd
              : 170,
          stops: Array.isArray(parsed.stops) ? parsed.stops : DEFAULT_STOPS,
        };
      }
    }
  } catch {
    // Fallback below
  }
  return {
    tripName: 'Wielka Pętla Bałkańska',
    targetMonth: 6,
    travelStyle: 'mid',
    estimatedFlightsUsd: 170,
    stops: DEFAULT_STOPS,
  };
}

export default function App() {
  // Navigation & View Mode
  const [activeTab, setActiveTab] = useState<ActiveTab>('catalog');
  const [viewMode, setViewMode] = useState<CatalogViewMode>('table');
  const [inspectedCountryCode, setInspectedCountryCode] = useState<string | null>(
    null
  );
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [commandPaletteState, setCommandPaletteState] = useState<{
    isOpen: boolean;
    mode: 'search' | 'matcher';
  }>({ isOpen: false, mode: 'search' });

  // Global ⌘K / Ctrl+K shortcut listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteState((prev) => ({
          isOpen: !prev.isOpen,
          mode: 'search',
        }));
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Dark Mode State (Instant localStorage boot <10ms)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DARK_MODE);
      if (saved !== null) return saved === 'true';
    } catch {
      // Ignore
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    try {
      localStorage.setItem(STORAGE_KEY_DARK_MODE, String(isDarkMode));
    } catch {
      // Ignore
    }
  }, [isDarkMode]);

  // User Progress State (Instant localStorage boot <10ms)
  const [userProgress, setUserProgress] = useState<
    Record<string, UserCountryData>
  >(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {
      console.error('Failed to read user progress from localStorage:', e);
    }
    return INITIAL_PROGRESS;
  });

  // Saved Trips State
  const [savedTrips, setSavedTrips] = useState<SavedTripPlan[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SAVED_TRIPS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Failed to read saved trips from localStorage:', e);
    }
    return [];
  });

  // Active Trip Draft State (Zero Data Loss — synchronous initialization)
  const [initialDraft] = useState(readInitialDraft);
  const [tripName, setTripName] = useState<string>(() => initialDraft.tripName);
  const [targetMonth, setTargetMonth] = useState<number>(
    () => initialDraft.targetMonth
  );
  const [travelStyle, setTravelStyle] = useState<TravelStyle>(
    () => initialDraft.travelStyle
  );
  const [estimatedFlightsUsd, setEstimatedFlightsUsd] = useState<number>(
    () => initialDraft.estimatedFlightsUsd
  );
  const [tripStops, setTripStops] = useState<TripStop[]>(
    () => initialDraft.stops
  );
  const [isDraftDirty, setIsDraftDirty] = useState<boolean>(false);

  // Pending package load guarded by UnsavedChangesModal
  const [pendingPackageAction, setPendingPackageAction] = useState<
    (() => void) | null
  >(null);

  // Catalog Filters & Sorting State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [continentFilter, setContinentFilter] = useState<Continent | 'ALL'>(
    'ALL'
  );
  const [statusFilter, setStatusFilter] = useState<VisitStatus | 'ALL'>('ALL');
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'ALL'>('ALL');
  const [visaFilter, setVisaFilter] = useState<VisaRequirementPL | 'ALL'>(
    'ALL'
  );
  const [monthFilter, setMonthFilter] = useState<number | 'ALL'>('ALL');
  const [clusterFilter, setClusterFilter] = useState<string | 'ALL'>('ALL');

  const [sortField, setSortField] = useState<SortField>('namePl');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Persist userProgress immediately
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(userProgress));
    } catch (e) {
      console.error('Failed to persist userProgress:', e);
    }
  }, [userProgress]);

  // Persist savedTrips immediately
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_TRIPS, JSON.stringify(savedTrips));
    } catch (e) {
      console.error('Failed to persist savedTrips:', e);
    }
  }, [savedTrips]);

  // Persist active draft immediately (Zero Data Loss)
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_ACTIVE_DRAFT,
        JSON.stringify({
          tripName,
          targetMonth,
          travelStyle,
          estimatedFlightsUsd,
          stops: tripStops,
        })
      );
    } catch (e) {
      console.error('Failed to persist active draft:', e);
    }
  }, [tripName, targetMonth, travelStyle, estimatedFlightsUsd, tripStops]);

  // Handlers for Country Progress
  const handleUpdateCountryStatus = (code: string, status: VisitStatus) => {
    setUserProgress((prev) => {
      const existing = prev[code] ?? { status: 'UNVISITED', notes: '' };
      return {
        ...prev,
        [code]: {
          ...existing,
          status,
          visitedYear:
            status === 'VISITED'
              ? existing.visitedYear ?? new Date().getFullYear()
              : existing.visitedYear,
        },
      };
    });
  };

  const handleUpdateCountryNotes = (code: string, notes: string) => {
    setUserProgress((prev) => {
      const existing = prev[code] ?? { status: 'UNVISITED', notes: '' };
      return {
        ...prev,
        [code]: {
          ...existing,
          notes,
        },
      };
    });
  };

  const handleAppendCountryNoteFromAssistant = (code: string, note: string) => {
    setUserProgress((prev) => {
      const existing = prev[code] ?? { status: 'UNVISITED', notes: '' };
      const combined = existing.notes
        ? `${existing.notes}\n${note}`
        : note;
      return {
        ...prev,
        [code]: {
          ...existing,
          notes: combined,
        },
      };
    });
  };

  const handleUpdateVisitedYear = (code: string, visitedYear?: number) => {
    setUserProgress((prev) => {
      const existing = prev[code] ?? { status: 'VISITED', notes: '' };
      return {
        ...prev,
        [code]: {
          ...existing,
          visitedYear,
        },
      };
    });
  };

  const handleMarkBatchStatus = (codes: string[], status: VisitStatus) => {
    setUserProgress((prev) => {
      const next = { ...prev };
      for (const code of codes) {
        const existing = next[code] ?? { status: 'UNVISITED', notes: '' };
        next[code] = {
          ...existing,
          status,
          visitedYear:
            status === 'VISITED'
              ? existing.visitedYear ?? new Date().getFullYear()
              : existing.visitedYear,
        };
      }
      return next;
    });
  };

  // Handlers for Trip Builder & Map
  const handleAddCountryToTrip = (code: string) => {
    const country = COUNTRIES_BY_CODE[code];
    if (!country) return;
    setTripStops((prev) => {
      if (prev.some((s) => s.countryCode === code)) {
        return prev.filter((s) => s.countryCode !== code);
      }
      return [
        ...prev,
        {
          countryCode: code,
          days: country.recommendedDays,
          notes: '',
        },
      ];
    });
    setIsDraftDirty(true);
  };

  const handleRemoveStop = (code: string) => {
    setTripStops((prev) => prev.filter((s) => s.countryCode !== code));
    setIsDraftDirty(true);
  };

  const handleMoveStop = (index: number, direction: 'up' | 'down') => {
    setTripStops((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
    setIsDraftDirty(true);
  };

  const handleUpdateStopDays = (code: string, days: number) => {
    setTripStops((prev) =>
      prev.map((s) => (s.countryCode === code ? { ...s, days } : s))
    );
    setIsDraftDirty(true);
  };

  const handleUpdateStopCustomUsd = (code: string, customDailyUsd?: number) => {
    setTripStops((prev) =>
      prev.map((s) =>
        s.countryCode === code ? { ...s, customDailyUsd } : s
      )
    );
    setIsDraftDirty(true);
  };

  const handleUpdateStopNotes = (code: string, notes: string) => {
    setTripStops((prev) =>
      prev.map((s) => (s.countryCode === code ? { ...s, notes } : s))
    );
    setIsDraftDirty(true);
  };

  const handleSaveCurrentTrip = () => {
    if (tripStops.length === 0) return;
    const newTrip: SavedTripPlan = {
      id: `trip-${Date.now()}`,
      name: tripName.trim() || `Wyprawa (${tripStops.length} państw)`,
      targetMonth,
      travelStyle,
      estimatedFlightsUsd,
      stops: tripStops,
      updatedAt: new Date().toISOString(),
    };
    setSavedTrips((prev) => [newTrip, ...prev]);
    setIsDraftDirty(false);
  };

  const guardUnsavedDraft = (action: () => void) => {
    if (isDraftDirty && tripStops.length > 0) {
      setPendingPackageAction(() => action);
    } else {
      action();
    }
  };

  const handleGuardedPackageLoad = guardUnsavedDraft;

  const handleSaveTripFromAssistant = (
    name: string,
    month: number,
    style: TravelStyle,
    flightsUsd: number,
    stops: TripStop[]
  ) => {
    const newTrip: SavedTripPlan = {
      id: `trip-ai-${Date.now()}`,
      name,
      targetMonth: month,
      travelStyle: style,
      estimatedFlightsUsd: flightsUsd,
      stops,
      updatedAt: new Date().toISOString(),
    };
    setSavedTrips((prev) => [newTrip, ...prev]);

    guardUnsavedDraft(() => {
      setTripName(name);
      setTargetMonth(month);
      setTravelStyle(style);
      setEstimatedFlightsUsd(flightsUsd);
      setTripStops(stops);
      setIsDraftDirty(false);
    });
  };

  const executePackageLoad = (
    name: string,
    codes: string[],
    flightsUsd: number,
    month: number,
    openInTab: 'builder' | 'map' = 'builder'
  ) => {
    const newStops: TripStop[] = codes
      .map((code) => {
        const c = COUNTRIES_BY_CODE[code];
        if (!c) return null;
        return {
          countryCode: c.code,
          days: c.recommendedDays,
          notes: '',
        };
      })
      .filter((s): s is TripStop => Boolean(s));

    setTripName(name);
    setTripStops(newStops);
    setEstimatedFlightsUsd(flightsUsd);
    setTargetMonth(month);
    setIsDraftDirty(false);
    setInspectedCountryCode(null);
    setActiveTab(openInTab);
  };

  const handleBuildNeighborPackage = (
    baseCode: string,
    neighborCodes: string[]
  ) => {
    const baseCountry = COUNTRIES_BY_CODE[baseCode];
    if (!baseCountry) return;
    const cluster = CLUSTERS_BY_ID[baseCountry.clusterId];
    const allCodes = [baseCode, ...neighborCodes];
    const defaultMonth = baseCountry.bestMonths[0] ?? 5;
    const flightCost = cluster?.estimatedFlightFromPlUsd ?? 450;

    handleGuardedPackageLoad(() => {
      executePackageLoad(
        `Pakiet: ${baseCountry.namePl} + sąsiedzi (${allCodes.length})`,
        allCodes,
        flightCost,
        defaultMonth
      );
    });
  };

  const handleLoadClusterToTripBuilder = (
    _clusterId: string,
    countryCodes: string[],
    clusterName: string,
    flightCostUsd: number,
    bestMonth: number
  ) => {
    handleGuardedPackageLoad(() => {
      executePackageLoad(clusterName, countryCodes, flightCostUsd, bestMonth);
    });
  };

  // Filtered and Sorted Countries
  const filteredAndSortedCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = ALL_COUNTRIES.filter((country) => {
      if (q) {
        const matchesQuery =
          country.namePl.toLowerCase().includes(q) ||
          country.nameEn.toLowerCase().includes(q) ||
          country.capitalPl.toLowerCase().includes(q) ||
          country.code.toLowerCase().includes(q) ||
          country.subregion.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      if (continentFilter !== 'ALL' && country.continent !== continentFilter) {
        return false;
      }

      const userStatus = userProgress[country.code]?.status ?? 'UNVISITED';
      if (statusFilter !== 'ALL' && userStatus !== statusFilter) {
        return false;
      }

      if (riskFilter !== 'ALL' && country.riskLevel !== riskFilter) {
        return false;
      }

      if (visaFilter !== 'ALL' && country.visaForPl !== visaFilter) {
        return false;
      }

      if (monthFilter !== 'ALL' && !country.bestMonths.includes(monthFilter)) {
        return false;
      }

      if (clusterFilter !== 'ALL' && country.clusterId !== clusterFilter) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'namePl') {
        cmp = a.namePl.localeCompare(b.namePl, 'pl');
      } else if (sortField === 'dailyCost') {
        const costA = a.dailyCostUsd[travelStyle] ?? a.dailyCostUsd.mid;
        const costB = b.dailyCostUsd[travelStyle] ?? b.dailyCostUsd.mid;
        cmp = costA - costB;
      } else if (sortField === 'riskLevel') {
        cmp = a.riskLevel - b.riskLevel;
      } else if (sortField === 'visaForPl') {
        cmp =
          VISA_LABELS_PL[a.visaForPl].order - VISA_LABELS_PL[b.visaForPl].order;
      } else if (sortField === 'neighborsCount') {
        cmp = a.neighbors.length - b.neighbors.length;
      } else if (sortField === 'recommendedDays') {
        cmp = a.recommendedDays - b.recommendedDays;
      }

      if (cmp === 0) {
        cmp = a.namePl.localeCompare(b.namePl, 'pl');
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [
    searchQuery,
    continentFilter,
    statusFilter,
    riskFilter,
    visaFilter,
    monthFilter,
    clusterFilter,
    sortField,
    sortDirection,
    travelStyle,
    userProgress,
  ]);

  const visitedTotalCount = useMemo(
    () =>
      ALL_COUNTRIES.filter(
        (c) => (userProgress[c.code]?.status ?? 'UNVISITED') === 'VISITED'
      ).length,
    [userProgress]
  );

  const activeTripCodes = useMemo(
    () => tripStops.map((s) => s.countryCode),
    [tripStops]
  );

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'neighborsCount' ? 'desc' : 'asc');
    }
  };

  const resetAllFilters = () => {
    setSearchQuery('');
    setContinentFilter('ALL');
    setStatusFilter('ALL');
    setRiskFilter('ALL');
    setVisaFilter('ALL');
    setMonthFilter('ALL');
    setClusterFilter('ALL');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    continentFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    riskFilter !== 'ALL' ||
    visaFilter !== 'ALL' ||
    monthFilter !== 'ALL' ||
    clusterFilter !== 'ALL';

  const inspectedCountry = inspectedCountryCode
    ? COUNTRIES_BY_CODE[inspectedCountryCode] ?? null
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between gap-8 no-print">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#catalog"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('catalog');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 font-display whitespace-nowrap shrink-0"
        >
          Atlas 195
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('catalog')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'catalog'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8 decoration-2 decoration-[#122144] dark:decoration-sky-400'
                : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Katalog 195
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('masterplan')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'masterplan'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8 decoration-2 decoration-[#122144] dark:decoration-sky-400'
                : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Optymalna Trasa 195
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'map'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8 decoration-2 decoration-[#122144] dark:decoration-sky-400'
                : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Mapa Świata ({tripStops.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clusters')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'clusters'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8 decoration-2 decoration-[#122144] dark:decoration-sky-400'
                : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Klastry Pakietowe ({TRAVEL_CLUSTERS.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'builder'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8 decoration-2 decoration-[#122144] dark:decoration-sky-400'
                : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Kreator Wypraw
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'analytics'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8 decoration-2 decoration-[#122144] dark:decoration-sky-400'
                : 'hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Postęp i Dane
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsAssistantOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 rounded-lg hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Asystentka Podróży</span>
          </button>
        </div>
      </header>

      {/* PAGE HEADER TOOLBAR (Breadcrumbs + Progress Counter + Theme Toggle + View Switcher) */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800 px-6 py-4 no-print">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>Atlas 195</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {activeTab === 'catalog' && 'Katalog 195 Państw Świata'}
                {activeTab === 'masterplan' &&
                  'Optymalna Trasa Przez Cały Świat (5 Faz)'}
                {activeTab === 'map' && 'Interaktywna Mapa Świata'}
                {activeTab === 'clusters' &&
                  `${TRAVEL_CLUSTERS.length} Regionalnych Klastrów Pakietowych`}
                {activeTab === 'builder' && 'Kreator Wypraw Pakietowych'}
                {activeTab === 'analytics' && 'Postęp Klubu 195 i Kopia Zapasowa'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                {activeTab === 'catalog' && 'Wszystkie 195 Państw Świata'}
                {activeTab === 'masterplan' &&
                  'Optymalny Plan Podróży Dookoła Świata (1 → 195)'}
                {activeTab === 'map' && 'Mapa Świata — Zaznaczaj Kraje do Wycieczki'}
                {activeTab === 'clusters' && 'Klastry Pakietowe („Zwiedź przy okazji”)'}
                {activeTab === 'builder' && 'Kreator Tras i Kalkulator Budżetu'}
                {activeTab === 'analytics' && 'Twój Postęp w Drodze do 195 Państw'}
              </h1>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                · Odwiedzono:{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {visitedTotalCount} / 195
                </strong>{' '}
                ({Math.round((visitedTotalCount / 195) * 100)}%)
              </span>
            </div>
          </div>

          {/* Right Workspace Controls: Generator Urlopowy, ⌘K Search, Dark Mode Switcher, Cost Standard & Table/Card Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setCommandPaletteState({ isOpen: true, mode: 'matcher' })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
              title="Dopasuj pakiet państw do długości urlopu, miesiąca i budżetu"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Dopasuj do urlopu i budżetu</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setCommandPaletteState({ isOpen: true, mode: 'search' })
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              title="Szybkie wyszukiwanie i paleta poleceń (Ctrl+K / ⌘K)"
            >
              <Command className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="font-mono text-[11px]">⌘K</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDarkMode((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              title="Przełącz tryb jasny / ciemny"
            >
              {isDarkMode ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tryb jasny</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-slate-600" />
                  <span>Tryb ciemny</span>
                </>
              )}
            </button>

            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(
                [
                  { id: 'budget', label: 'Backpacker' },
                  { id: 'mid', label: 'Komfort' },
                  { id: 'comfort', label: 'Premium' },
                ] as const
              ).map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setTravelStyle(style.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    travelStyle === style.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>

            {activeTab === 'catalog' && (
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  Tabela
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  Kafelki
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT VIEWPORT */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {activeTab === 'catalog' && (
          <ErrorBoundary isolateSection={true} sectionName="Katalog 195 Państw">
            <div className="space-y-4">
              {/* UNIFIED SINGLE-BAR COMMAND TOOLBAR (Linear/Stripe Grade) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                  <div className="relative flex-1 min-w-[220px] max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery ?? ''}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Szukaj państwa lub stolicy..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#122144]"
                    />
                  </div>

                  <select
                    value={continentFilter}
                    onChange={(e) =>
                      setContinentFilter(e.target.value as Continent | 'ALL')
                    }
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                    aria-label="Kontynent"
                  >
                    <option value="ALL">Kontynent: Wszystkie (195)</option>
                    <option value="Europa">Europa (44)</option>
                    <option value="Azja">Azja (48)</option>
                    <option value="Afryka">Afryka (54)</option>
                    <option value="Ameryka Północna i Karaiby">
                      Ameryka Płn. i Karaiby (23)
                    </option>
                    <option value="Ameryka Południowa">
                      Ameryka Płd. (12)
                    </option>
                    <option value="Oceania">Oceania (14)</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as VisitStatus | 'ALL')
                    }
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                    aria-label="Status"
                  >
                    <option value="ALL">Status: Wszystkie</option>
                    <option value="UNVISITED">Nieodwiedzone</option>
                    <option value="VISITED">Odwiedzone</option>
                    <option value="PLANNED">W planach</option>
                    <option value="WISHLIST">Lista marzeń</option>
                  </select>

                  <select
                    value={riskFilter === 'ALL' ? 'ALL' : String(riskFilter)}
                    onChange={(e) =>
                      setRiskFilter(
                        e.target.value === 'ALL'
                          ? 'ALL'
                          : (Number(e.target.value) as RiskLevel)
                      )
                    }
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                    aria-label="Poziom ryzyka"
                  >
                    <option value="ALL">Ryzyko: Wszystkie</option>
                    <option value="1">1/4 — Niskie</option>
                    <option value="2">2/4 — Umiarkowane</option>
                    <option value="3">3/4 — Podwyższone</option>
                    <option value="4">4/4 — Wysokie</option>
                  </select>

                  <select
                    value={visaFilter}
                    onChange={(e) =>
                      setVisaFilter(
                        e.target.value as VisaRequirementPL | 'ALL'
                      )
                    }
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                    aria-label="Wiza"
                  >
                    <option value="ALL">Wiza PL: Wszystkie</option>
                    <option value="VISA_FREE">Bezwizowo</option>
                    <option value="EVISA_VOA">e-Visa / VOA</option>
                    <option value="EMBASSY_VISA">Wiza w ambasadzie</option>
                  </select>

                  <select
                    value={monthFilter === 'ALL' ? 'ALL' : String(monthFilter)}
                    onChange={(e) =>
                      setMonthFilter(
                        e.target.value === 'ALL'
                          ? 'ALL'
                          : Number(e.target.value)
                      )
                    }
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none"
                    aria-label="Miesiąc"
                  >
                    <option value="ALL">Miesiąc: Dowolny</option>
                    {MONTHS_PL.map((m) => (
                      <option key={m.id} value={m.id}>
                        Pogoda: {m.full}
                      </option>
                    ))}
                  </select>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Resetuj
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('masterplan')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-sans text-xs font-medium text-[#122144] dark:text-sky-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Optymalna trasa 1 → 195</span>
                  </button>
                  <span>
                    Pokazano <strong>{filteredAndSortedCountries.length}</strong> z 195
                  </span>
                </div>
              </div>

              {/* Empty Filter State */}
              {filteredAndSortedCountries.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
                  <Compass className="w-8 h-8 text-slate-400 mx-auto" />
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Nie znaleziono państw pasujących do wybranych filtrów
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Spróbuj zmienić kryteria wyszukiwania, poziom ryzyka lub wybrany miesiąc wyjazdu.
                  </p>
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-4 py-2 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 rounded-lg hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors"
                  >
                    Wyczyść wszystkie filtry
                  </button>
                </div>
              ) : viewMode === 'table' ? (
                /* BIG TECH ENTERPRISE TABLE (Clean, Breathable, Single-Line Row Discipline) */
                <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <th className="py-3.5 px-5">
                            <button
                              type="button"
                              onClick={() => toggleSort('namePl')}
                              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                            >
                              <span>Państwo</span>
                              {sortField === 'namePl' ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </button>
                          </th>
                          <th className="py-3.5 px-4">Region i klaster</th>
                          <th className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => toggleSort('dailyCost')}
                              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white ml-auto"
                            >
                              <span>Budżet / dzień</span>
                              {sortField === 'dailyCost' ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </button>
                          </th>
                          <th className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => toggleSort('riskLevel')}
                              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                            >
                              <span>Bezpieczeństwo</span>
                              {sortField === 'riskLevel' ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </button>
                          </th>
                          <th className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => toggleSort('visaForPl')}
                              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                            >
                              <span>Wiza PL i sezon</span>
                              {sortField === 'visaForPl' ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </button>
                          </th>
                          <th className="py-3.5 px-4">
                            <button
                              type="button"
                              onClick={() => toggleSort('neighborsCount')}
                              className="inline-flex items-center gap-1.5 hover:text-slate-900 dark:hover:text-white"
                            >
                              <span>Sąsiedzi w pakiecie</span>
                              {sortField === 'neighborsCount' ? (
                                sortDirection === 'asc' ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </button>
                          </th>
                          <th className="py-3.5 px-5 text-right">Akcje</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/80 text-xs">
                        {filteredAndSortedCountries.map((country) => {
                          const userStatus =
                            userProgress[country.code]?.status ?? 'UNVISITED';
                          const dailyUsd =
                            country.dailyCostUsd[travelStyle] ??
                            country.dailyCostUsd.mid;
                          const dailyPln = Math.round(dailyUsd * USD_TO_PLN);
                          const isInTrip = activeTripCodes.includes(country.code);
                          const cluster = CLUSTERS_BY_ID[country.clusterId];
                          const previewNeighbors = country.neighbors
                            .slice(0, 2)
                            .map((c) => COUNTRIES_BY_CODE[c])
                            .filter(
                              (n): n is NonNullable<typeof n> => Boolean(n)
                            );
                          const extraNeighbors = Math.max(
                            0,
                            country.neighbors.length - previewNeighbors.length
                          );

                          return (
                            <tr
                              key={country.code}
                              onClick={() => setInspectedCountryCode(country.code)}
                              className={`group cursor-pointer hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors ${
                                userStatus === 'VISITED'
                                  ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                                  : ''
                              }`}
                            >
                              {/* 1. Country Flag + Name + Capital (Clean, no repeated link spam) */}
                              <td className="py-3.5 px-5 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <CountryFlag code={country.code} size="md" />
                                  <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-[#122144] dark:group-hover:text-sky-400 transition-colors">
                                      {country.namePl}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      {country.capitalPl} · ~{country.recommendedDays} dni
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Continent & Cluster (Clean, no "Pakiet:" prefix spam) */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                                  {country.continent}
                                </div>
                                {cluster && (
                                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                                    {cluster.namePl}
                                  </div>
                                )}
                              </td>

                              {/* 3. Daily Cost (Tabular Mono) */}
                              <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  ${dailyUsd}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500">
                                  ~{dailyPln} zł
                                </div>
                              </td>

                              {/* 4. Security Risk (Restrained Semantic Color: only highlight risk 3 & 4) */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      country.riskLevel === 1
                                        ? 'bg-emerald-500'
                                        : country.riskLevel === 2
                                        ? 'bg-slate-400'
                                        : country.riskLevel === 3
                                        ? 'bg-amber-500'
                                        : 'bg-red-500'
                                    }`}
                                  />
                                  <span
                                    className={`text-xs font-medium ${
                                      country.riskLevel <= 2
                                        ? 'text-slate-700 dark:text-slate-300'
                                        : country.riskLevel === 3
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : 'text-red-600 dark:text-red-400 font-semibold'
                                    }`}
                                  >
                                    {RISK_LABELS_PL[country.riskLevel].short}
                                  </span>
                                </div>
                              </td>

                              {/* 5. Visa & Season (Clean 2-line hierarchy without "Sezon:" label noise) */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div
                                  className={`text-xs font-medium ${
                                    country.visaForPl === 'EMBASSY_VISA'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {VISA_LABELS_PL[country.visaForPl].short}
                                </div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
                                  {formatMonthsRange(country.bestMonths)}
                                </div>
                              </td>

                              {/* 6. Neighbors (Single-Line Discipline: max 2 flags + names + counter) */}
                              <td
                                className="py-3.5 px-4 whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {previewNeighbors.length === 0 ? (
                                  <span className="text-slate-400 dark:text-slate-600 text-xs">
                                    Wyspa
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    {previewNeighbors.map((n) => (
                                      <button
                                        key={n.code}
                                        type="button"
                                        onClick={() =>
                                          setInspectedCountryCode(n.code)
                                        }
                                        className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:underline"
                                        title={`Zwiedź przy okazji: ${n.namePl}`}
                                      >
                                        <CountryFlag code={n.code} size="xs" />
                                        <span>{n.namePl}</span>
                                      </button>
                                    ))}
                                    {extraNeighbors > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setInspectedCountryCode(country.code)
                                        }
                                        className="text-[11px] font-mono text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                      >
                                        +{extraNeighbors}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* 7. Actions */}
                              <td
                                className="py-3.5 px-5 text-right whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="inline-flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleUpdateCountryStatus(
                                        country.code,
                                        userStatus === 'VISITED'
                                          ? 'UNVISITED'
                                          : 'VISITED'
                                      )
                                    }
                                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                                      userStatus === 'VISITED'
                                        ? 'bg-emerald-600/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-semibold'
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                                    }`}
                                    title="Oznacz jako odwiedzony"
                                  >
                                    {userStatus === 'VISITED'
                                      ? 'Odwiedzony ✓'
                                      : 'Oznacz'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddCountryToTrip(country.code)
                                    }
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                                      isInTrip
                                        ? 'bg-[#122144] dark:bg-sky-600 text-white'
                                        : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                    title="Dodaj lub usuń z aktywnej wycieczki"
                                  >
                                    {isInTrip ? (
                                      <>
                                        <Check className="w-3 h-3" />W trasie
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3 h-3" />
                                        Pakiet
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* BENTO CARDS VIEW (Single-elevation, Real Flags, Clean Hierarchy) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredAndSortedCountries.map((country) => {
                    const userStatus =
                      userProgress[country.code]?.status ?? 'UNVISITED';
                    const dailyUsd =
                      country.dailyCostUsd[travelStyle] ??
                      country.dailyCostUsd.mid;
                    const isInTrip = activeTripCodes.includes(country.code);
                    const neighborList = country.neighbors
                      .slice(0, 3)
                      .map((code) => COUNTRIES_BY_CODE[code])
                      .filter((c): c is NonNullable<typeof c> => Boolean(c));

                    return (
                      <div
                        key={country.code}
                        onClick={() => setInspectedCountryCode(country.code)}
                        className="group cursor-pointer bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                            <span className="truncate">
                              {country.continent} · {country.subregion}
                            </span>
                            <span className="font-mono text-slate-400 shrink-0">
                              {country.code}
                            </span>
                          </div>

                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <CountryFlag code={country.code} size="lg" />
                              <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 group-hover:text-[#122144] dark:group-hover:text-sky-400 transition-colors">
                                  {country.namePl}
                                </h3>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {country.capitalPl} · ~{country.recommendedDays} dni
                                </div>
                              </div>
                            </div>

                            <div className="text-right font-mono tabular-nums shrink-0">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
                                ${dailyUsd}/d
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {RISK_LABELS_PL[country.riskLevel].short}
                              </div>
                            </div>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {country.highlightsPl}
                          </p>

                          {neighborList.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
                              <span>Blisko:</span>
                              {neighborList.map((n) => (
                                <span
                                  key={n.code}
                                  className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300"
                                >
                                  <CountryFlag code={n.code} size="xs" />
                                  <span>{n.namePl}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div
                          className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {VISA_LABELS_PL[country.visaForPl].short} ·{' '}
                            {formatMonthsRange(country.bestMonths)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCountryStatus(
                                  country.code,
                                  userStatus === 'VISITED'
                                    ? 'UNVISITED'
                                    : 'VISITED'
                                )
                              }
                              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                                userStatus === 'VISITED'
                                  ? 'bg-emerald-600/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-semibold'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {userStatus === 'VISITED'
                                ? 'Odwiedzony ✓'
                                : 'Oznacz'}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleAddCountryToTrip(country.code)
                              }
                              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                                isInTrip
                                  ? 'bg-[#122144] dark:bg-sky-600 text-white'
                                  : 'border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {isInTrip ? 'W trasie ✓' : '+ Pakiet'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'masterplan' && (
          <ErrorBoundary
            isolateSection={true}
            sectionName="Optymalna Trasa 195 Państw"
          >
            <MasterRouteView
              userProgress={userProgress}
              travelStyle={travelStyle}
              onSelectCountry={(code) => setInspectedCountryCode(code)}
              onLoadExpeditionToTrip={(
                name,
                codes,
                flightsUsd,
                bestMonth,
                openInTab
              ) => {
                handleGuardedPackageLoad(() => {
                  executePackageLoad(
                    name,
                    codes,
                    flightsUsd,
                    bestMonth,
                    openInTab
                  );
                });
              }}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'map' && (
          <ErrorBoundary
            isolateSection={true}
            sectionName="Interaktywna Mapa Świata"
          >
            <WorldMapView
              tripName={tripName}
              stops={tripStops}
              travelStyle={travelStyle}
              estimatedFlightsUsd={estimatedFlightsUsd}
              userProgress={userProgress}
              isDarkMode={isDarkMode}
              onChangeTripName={(val) => {
                setTripName(val);
                setIsDraftDirty(true);
              }}
              onToggleCountryInTrip={handleAddCountryToTrip}
              onSelectCountryForNews={(code) => setInspectedCountryCode(code)}
              onToggleVisitedStatus={(code) => {
                const current =
                  userProgress[code]?.status ?? 'UNVISITED';
                handleUpdateCountryStatus(
                  code,
                  current === 'VISITED' ? 'UNVISITED' : 'VISITED'
                );
              }}
              onSaveTrip={handleSaveCurrentTrip}
              onClearTrip={() => {
                guardUnsavedDraft(() => {
                  setTripStops([]);
                  setTripName('Wycieczka z mapy');
                  setIsDraftDirty(false);
                });
              }}
              onOpenInBuilder={() => setActiveTab('builder')}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'clusters' && (
          <ErrorBoundary
            isolateSection={true}
            sectionName={`Klastry Pakietowe (${TRAVEL_CLUSTERS.length} Regionów)`}
          >
            <ClustersView
              userProgress={userProgress}
              travelStyle={travelStyle}
              onSelectCountry={(code) => setInspectedCountryCode(code)}
              onLoadClusterToTripBuilder={handleLoadClusterToTripBuilder}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'builder' && (
          <ErrorBoundary
            isolateSection={true}
            sectionName="Kreator Wypraw Pakietowych"
          >
            <TripBuilderView
              tripName={tripName}
              targetMonth={targetMonth}
              travelStyle={travelStyle}
              estimatedFlightsUsd={estimatedFlightsUsd}
              stops={tripStops}
              isDirty={isDraftDirty}
              savedTrips={savedTrips}
              userProgress={userProgress}
              onChangeTripName={(val) => {
                setTripName(val);
                setIsDraftDirty(true);
              }}
              onChangeTargetMonth={(val) => {
                setTargetMonth(val);
                setIsDraftDirty(true);
              }}
              onChangeTravelStyle={setTravelStyle}
              onChangeFlightsUsd={(val) => {
                setEstimatedFlightsUsd(val);
                setIsDraftDirty(true);
              }}
              onAddStop={handleAddCountryToTrip}
              onRemoveStop={handleRemoveStop}
              onMoveStop={handleMoveStop}
              onUpdateStopDays={handleUpdateStopDays}
              onUpdateStopCustomUsd={handleUpdateStopCustomUsd}
              onUpdateStopNotes={handleUpdateStopNotes}
              onSaveCurrentTrip={handleSaveCurrentTrip}
              onLoadSavedTrip={(trip) => {
                handleGuardedPackageLoad(() => {
                  setTripName(trip.name);
                  setTargetMonth(trip.targetMonth);
                  setTravelStyle(trip.travelStyle);
                  setEstimatedFlightsUsd(trip.estimatedFlightsUsd);
                  setTripStops(trip.stops);
                  setIsDraftDirty(false);
                });
              }}
              onDeleteSavedTrip={(id) =>
                setSavedTrips((prev) => prev.filter((t) => t.id !== id))
              }
              onClearDraft={() => {
                guardUnsavedDraft(() => {
                  setTripStops([]);
                  setTripName('Nowa wyprawa pakietowa');
                  setIsDraftDirty(false);
                });
              }}
              onSelectCountry={(code) => setInspectedCountryCode(code)}
              onMarkTripCountriesStatus={handleMarkBatchStatus}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'analytics' && (
          <ErrorBoundary
            isolateSection={true}
            sectionName="Postęp i Kopia Zapasowa"
          >
            <AnalyticsView
              userProgress={userProgress}
              savedTrips={savedTrips}
              activeDraft={{
                tripName,
                targetMonth,
                travelStyle,
                estimatedFlightsUsd,
                stops: tripStops,
              }}
              travelStyle={travelStyle}
              onImportBackup={(newProgress, newTrips, importedDraft) => {
                setUserProgress(newProgress);
                setSavedTrips(newTrips);
                if (importedDraft) {
                  if (importedDraft.tripName) {
                    setTripName(importedDraft.tripName);
                  }
                  if (importedDraft.targetMonth) {
                    setTargetMonth(importedDraft.targetMonth);
                  }
                  if (importedDraft.travelStyle) {
                    setTravelStyle(importedDraft.travelStyle);
                  }
                  if (typeof importedDraft.estimatedFlightsUsd === 'number') {
                    setEstimatedFlightsUsd(importedDraft.estimatedFlightsUsd);
                  }
                  if (Array.isArray(importedDraft.stops)) {
                    setTripStops(importedDraft.stops);
                  }
                  setIsDraftDirty(false);
                }
              }}
              onSelectCountry={(code) => setInspectedCountryCode(code)}
            />
          </ErrorBoundary>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200/70 dark:border-slate-800 px-6 py-4 mt-12 no-print">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            Atlas 195 — Planer podróży do wszystkich 193 państw członkowskich
            ONZ oraz Watykanu i Palestyny.
          </span>
          <span className="font-mono tabular-nums">
            Zapis lokalny aktywny · {visitedTotalCount} / 195 odwiedzonych
          </span>
        </div>
      </footer>

      {/* Country, Photos & Live News Inspector Modal (Portal) */}
      <CountryInspectorModal
        country={inspectedCountry}
        userProgress={userProgress}
        travelStyle={travelStyle}
        activeTripCodes={activeTripCodes}
        onClose={() => setInspectedCountryCode(null)}
        onSelectCountry={(code) => setInspectedCountryCode(code)}
        onUpdateStatus={handleUpdateCountryStatus}
        onUpdateNotes={handleUpdateCountryNotes}
        onUpdateVisitedYear={handleUpdateVisitedYear}
        onAddCountryToTrip={handleAddCountryToTrip}
        onBuildNeighborPackage={handleBuildNeighborPackage}
      />

      {/* Personal Travel Assistant Drawer (Portal) */}
      <TravelAssistantDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        userProgress={userProgress}
        activeStops={tripStops}
        activeTripName={tripName}
        savedTrips={savedTrips}
        onSaveTripFromAssistant={handleSaveTripFromAssistant}
        onMarkCountriesFromAssistant={handleMarkBatchStatus}
        onSaveCountryNoteFromAssistant={handleAppendCountryNoteFromAssistant}
        onNavigateToTab={(tab) => setActiveTab(tab)}
      />

      {/* Unsaved Changes Guard Modal (Portal) */}
      <UnsavedChangesModal
        isOpen={Boolean(pendingPackageAction)}
        onCancel={() => setPendingPackageAction(null)}
        onConfirmDiscard={() => {
          if (pendingPackageAction) pendingPackageAction();
          setPendingPackageAction(null);
        }}
        onSaveAndProceed={() => {
          handleSaveCurrentTrip();
          if (pendingPackageAction) pendingPackageAction();
          setPendingPackageAction(null);
        }}
      />

      {/* Global Command Palette ⌘K & Smart Vacation/Budget Matcher (Portal) */}
      <CommandPaletteModal
        isOpen={commandPaletteState.isOpen}
        initialMode={commandPaletteState.mode}
        userProgress={userProgress}
        travelStyle={travelStyle}
        activeTripCodes={activeTripCodes}
        onClose={() =>
          setCommandPaletteState((prev) => ({ ...prev, isOpen: false }))
        }
        onSelectCountry={(code) => setInspectedCountryCode(code)}
        onAddCountryToTrip={handleAddCountryToTrip}
        onUpdateStatus={handleUpdateCountryStatus}
        onLoadCustomPackage={(name, codes, month, flightsUsd) => {
          handleGuardedPackageLoad(() =>
            executePackageLoad(name, codes, flightsUsd, month, 'builder')
          );
        }}
        onNavigateTab={(tab) => setActiveTab(tab)}
        onToggleDarkMode={() => setIsDarkMode((prev) => !prev)}
      />
    </div>
  );
}
