import React, { useMemo, useRef, useState } from 'react';
import {
  Download,
  Upload,
  CheckCircle2,
  Compass,
  ShieldCheck,
  FileCheck2,
} from 'lucide-react';
import {
  Continent,
  SavedTripPlan,
  TravelStyle,
  TripStop,
  UserCountryData,
} from '../types/travel.ts';
import {
  ALL_COUNTRIES,
  RISK_LABELS_PL,
  VISA_LABELS_PL,
  USD_TO_PLN,
} from '../data/index.ts';
import { CountryFlag } from './CountryFlag.tsx';

export interface ActiveDraftBackup {
  tripName: string;
  targetMonth: number;
  travelStyle: TravelStyle;
  estimatedFlightsUsd: number;
  stops: TripStop[];
}

interface AnalyticsViewProps {
  userProgress: Record<string, UserCountryData>;
  savedTrips: SavedTripPlan[];
  activeDraft?: ActiveDraftBackup;
  travelStyle: TravelStyle;
  onImportBackup: (
    progress: Record<string, UserCountryData>,
    trips: SavedTripPlan[],
    activeDraft?: ActiveDraftBackup
  ) => void;
  onSelectCountry: (code: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  userProgress,
  savedTrips,
  activeDraft,
  travelStyle,
  onImportBackup,
  onSelectCountry,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importMessage, setImportMessage] = useState<string>('');

  const continents: Continent[] = [
    'Europa',
    'Azja',
    'Afryka',
    'Ameryka Północna i Karaiby',
    'Ameryka Południowa',
    'Oceania',
  ];

  const stats = useMemo(() => {
    const visited = ALL_COUNTRIES.filter(
      (c) => (userProgress[c.code]?.status ?? 'UNVISITED') === 'VISITED'
    );
    const planned = ALL_COUNTRIES.filter(
      (c) => (userProgress[c.code]?.status ?? 'UNVISITED') === 'PLANNED'
    );
    const wishlist = ALL_COUNTRIES.filter(
      (c) => (userProgress[c.code]?.status ?? 'UNVISITED') === 'WISHLIST'
    );
    const unvisited = ALL_COUNTRIES.filter(
      (c) => (userProgress[c.code]?.status ?? 'UNVISITED') !== 'VISITED'
    );

    const remainingDays = unvisited.reduce(
      (sum, c) => sum + c.recommendedDays,
      0
    );
    const remainingGroundUsd = unvisited.reduce(
      (sum, c) =>
        sum +
        (c.dailyCostUsd[travelStyle] ?? c.dailyCostUsd.mid) * c.recommendedDays,
      0
    );

    const easiestUnvisited = [...unvisited]
      .sort((a, b) => {
        if (a.riskLevel !== b.riskLevel) return a.riskLevel - b.riskLevel;
        const aCost =
          (a.dailyCostUsd[travelStyle] ?? a.dailyCostUsd.mid) *
          a.recommendedDays;
        const bCost =
          (b.dailyCostUsd[travelStyle] ?? b.dailyCostUsd.mid) *
          b.recommendedDays;
        return aCost - bCost;
      })
      .slice(0, 10);

    return {
      visited,
      planned,
      wishlist,
      unvisited,
      remainingDays,
      remainingGroundUsd,
      easiestUnvisited,
    };
  }, [userProgress, travelStyle]);

  const handleExportJson = () => {
    const payload = {
      version: '1.1',
      exportedAt: new Date().toISOString(),
      userProgress,
      savedTrips,
      activeDraft,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atlas-195-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result ?? '{}'));
        if (parsed && typeof parsed.userProgress === 'object') {
          onImportBackup(
            parsed.userProgress,
            Array.isArray(parsed.savedTrips) ? parsed.savedTrips : [],
            parsed.activeDraft && typeof parsed.activeDraft === 'object'
              ? parsed.activeDraft
              : undefined
          );
          setImportMessage('Pomyślnie wczytano kopię zapasową postępów i tras.');
        } else {
          setImportMessage('Nieprawidłowy format pliku kopii zapasowej JSON.');
        }
      } catch {
        setImportMessage('Błąd odczytu pliku JSON.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Odwiedzone państwa (Klub 195)
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
            {stats.visited.length} / 195{' '}
            <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
              ({Math.round((stats.visited.length / 195) * 100)}%)
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            W planach: {stats.planned.length} · Marzenia: {stats.wishlist.length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Pozostało do pełnego 195
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
            {stats.unvisited.length} państw
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Szacowany czas na miejscu: ~{stats.remainingDays} dni
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Szacowany budżet pozostałych państw (pobyt)
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
            ${stats.remainingGroundUsd.toLocaleString('en-US')}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            ~
            {Math.round(stats.remainingGroundUsd * USD_TO_PLN).toLocaleString(
              'pl-PL'
            )}{' '}
            PLN (styl: {travelStyle})
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Kopia zapasowa danych (Zero Data Loss)
            </div>
            <div className="mt-1 text-xs text-slate-700 dark:text-slate-300">
              Eksportuj lub przywróć swój dziennik 195 państw i zapisane trasy z pliku JSON.
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Eksportuj JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Wczytaj JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
          {importMessage && (
            <div className="mt-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
              {importMessage}
            </div>
          )}
        </div>
      </div>

      {/* Continental Progress & Visa/Risk Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <Compass className="w-4 h-4 text-[#122144] dark:text-sky-400" />
            Postęp według kontynentów (195 państw)
          </h3>

          <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
            {continents.map((cont) => {
              const allInCont = ALL_COUNTRIES.filter(
                (c) => c.continent === cont
              );
              const visitedInCont = allInCont.filter(
                (c) => (userProgress[c.code]?.status ?? 'UNVISITED') === 'VISITED'
              );
              const pct =
                allInCont.length > 0
                  ? Math.round((visitedInCont.length / allInCont.length) * 100)
                  : 0;

              return (
                <div key={cont} className="py-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {cont}
                    </span>
                    <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      <strong>{visitedInCont.length}</strong> / {allInCont.length}{' '}
                      państw ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#122144] dark:bg-sky-500 transition-all duration-200"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          {/* Visa Breakdown for Polish Passport */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#122144] dark:text-sky-400" />
              Dostępność wizowa świata dla polskiego paszportu
            </h3>
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
              {(['VISA_FREE', 'EVISA_VOA', 'EMBASSY_VISA'] as const).map(
                (vKey) => {
                  const total = ALL_COUNTRIES.filter(
                    (c) => c.visaForPl === vKey
                  ).length;
                  const visited = ALL_COUNTRIES.filter(
                    (c) =>
                      c.visaForPl === vKey &&
                      (userProgress[c.code]?.status ?? 'UNVISITED') === 'VISITED'
                  ).length;

                  return (
                    <div
                      key={vKey}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <span className="text-slate-700 dark:text-slate-300">
                        {VISA_LABELS_PL[vKey].label}
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                        {visited} / {total} odwiedzonych
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </div>

          {/* Security Risk Breakdown */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#122144] dark:text-sky-400" />
              Struktura 195 państw według poziomu ryzyka
            </h3>
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
              {([1, 2, 3, 4] as const).map((rLevel) => {
                const total = ALL_COUNTRIES.filter(
                  (c) => c.riskLevel === rLevel
                ).length;
                const visited = ALL_COUNTRIES.filter(
                  (c) =>
                    c.riskLevel === rLevel &&
                    (userProgress[c.code]?.status ?? 'UNVISITED') === 'VISITED'
                ).length;

                return (
                  <div
                    key={rLevel}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-700 dark:text-slate-300">
                      {RISK_LABELS_PL[rLevel].label}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 shrink-0">
                      {visited} / {total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Top 10 Easiest & Cheapest Unvisited Countries */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Najłatwiejsze i najtańsze nieodwiedzone jeszcze przez Ciebie państwa (Szybkie wygrane)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kraje o najniższym poziomie ryzyka (1/4) i najniższym łącznym koszcie pobytu spośród tych, których jeszcze nie masz na koncie:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {stats.easiestUnvisited.map((country) => {
            const dailyUsd =
              country.dailyCostUsd[travelStyle] ?? country.dailyCostUsd.mid;
            return (
              <button
                key={country.code}
                type="button"
                onClick={() => onSelectCountry(country.code)}
                className="p-3.5 border border-slate-200/80 dark:border-slate-800 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <CountryFlag code={country.code} size="md" />
                  <span className="text-[11px] font-mono text-slate-400">
                    {country.code}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {country.namePl}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  ${dailyUsd}/d · ~{country.recommendedDays} dni
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Sąsiedzi w pakiecie: {country.neighbors.length}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
