import React, { useMemo, useState } from 'react';
import {
  Compass,
  ArrowRight,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
  Layers,
  ListOrdered,
  Plane,
} from 'lucide-react';
import {
  CountryRecord,
  TravelStyle,
  UserCountryData,
} from '../types/travel.ts';
import {
  ALL_COUNTRIES,
  CLUSTERS_BY_ID,
  RISK_LABELS_PL,
  VISA_LABELS_PL,
  USD_TO_PLN,
  formatMonthsRange,
} from '../data/index.ts';
import { CountryFlag } from './CountryFlag.tsx';

interface MasterRouteViewProps {
  userProgress: Record<string, UserCountryData>;
  travelStyle: TravelStyle;
  onSelectCountry: (code: string) => void;
  onLoadExpeditionToTrip: (
    name: string,
    countryCodes: string[],
    flightsUsd: number,
    bestMonth: number,
    openInTab: 'builder' | 'map'
  ) => void;
}

export interface MasterPhase {
  id: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  badgeText: string;
  accentClass: string;
  dotClass: string;
}

export const MASTER_PHASES: MasterPhase[] = [
  {
    id: 1,
    title: 'Faza 1 — Szybkie, Bezpieczne i Tanie Pakiety Startowe',
    subtitle:
      'Ryzyko 1/4, niskie koszty dzienne i brak trudnych wiz. Najlepsze regiony na szybkie zdobycie pierwszych 50–60 państw w wygodnych pakietach lądowych.',
    badgeText: 'Etap 1 · Najłatwiejsze i najtańsze',
    accentClass: 'border-l-4 border-l-emerald-500',
    dotClass: 'bg-emerald-500',
  },
  {
    id: 2,
    title: 'Faza 2 — Klasyczne Pakiety Kontynentalne (Średni Budżet)',
    subtitle:
      'Bezpieczne kraje (1–2/4) o umiarkowanym koszcie dziennym lub wymagające dalszego lotu międzykontynentalnego (Ameryka Łacińska, Azja Wschodnia, bezpieczna Afryka Południowo-Wschodnia).',
    badgeText: 'Etap 2 · Średni koszt i dobra logistyka',
    accentClass: 'border-l-4 border-l-sky-500',
    dotClass: 'bg-sky-500',
  },
  {
    id: 3,
    title: 'Faza 3 — Bezpieczne, ale Najdroższe Kraje i Odległe Wyspy',
    subtitle:
      'Państwa bezpieczne (1–2/4), ale o wysokim koszcie dziennym lub drogich przelotach wyspowych (Karaiby, Skandynawia, Australia, Mikronezja, Melanezja i Polinezja).',
    badgeText: 'Etap 3 · Wysoki budżet (Bezpieczne)',
    accentClass: 'border-l-4 border-l-indigo-500',
    dotClass: 'bg-indigo-500',
  },
  {
    id: 4,
    title: 'Faza 4 — Trudna Logistyka, Wiza w Ambasadzie i Podwyższone Ryzyko',
    subtitle:
      'Kraje o ryzyku 3/4 lub wymagające żmudnych procedur wizowych w ambasadzie (m.in. Afryka Zachodnia i Środkowa). Realizowane po zdobyciu doświadczenia.',
    badgeText: 'Etap 4 · Trudne wizowo i logistycznie (3/4)',
    accentClass: 'border-l-4 border-l-amber-500',
    dotClass: 'bg-amber-500',
  },
  {
    id: 5,
    title: 'Faza 5 — Finał Klubu 195: Najbardziej Niebezpieczne Strefy (Na Sam Koniec)',
    subtitle:
      'Państwa o najwyższym poziomie zagrożenia 4/4 (konflikty zbrojne, alerty MSZ „Nie podróżuj”) oraz ekstremalnych kosztach/izolacji. Zostawione na sam koniec podróży życiowej.',
    badgeText: 'Etap 5 · Najwyższe ryzyko (4/4) — Na koniec',
    accentClass: 'border-l-4 border-l-red-500',
    dotClass: 'bg-red-500',
  },
];

/**
 * Assigns each country to one of the 5 Masterplan Phases and calculates a deterministic
 * optimization score (lower score = earlier in the global route).
 */
function evaluateCountryMasterScore(
  country: CountryRecord,
  travelStyle: TravelStyle
): {
  phaseId: 1 | 2 | 3 | 4 | 5;
  expeditionCostUsd: number;
  dailyUsd: number;
  score: number;
} {
  const cluster = CLUSTERS_BY_ID[country.clusterId];
  const clusterSize =
    ALL_COUNTRIES.filter((c) => c.clusterId === country.clusterId).length || 4;
  const flightShareUsd = Math.round(
    (cluster?.estimatedFlightFromPlUsd ?? 500) / Math.max(1, clusterSize)
  );
  const dailyUsd =
    country.dailyCostUsd[travelStyle] ?? country.dailyCostUsd.mid;
  const stayUsd = dailyUsd * country.recommendedDays;
  const expeditionCostUsd = stayUsd + flightShareUsd;

  const visaPenalty =
    country.visaForPl === 'VISA_FREE'
      ? 0
      : country.visaForPl === 'EVISA_VOA'
      ? 120
      : 480;

  // Phase classification:
  // Phase 5: Risk 4 (Highest danger) always goes at the very end
  if (country.riskLevel === 4) {
    return {
      phaseId: 5,
      expeditionCostUsd,
      dailyUsd,
      score: 50000 + expeditionCostUsd + visaPenalty,
    };
  }

  // Phase 4: Risk 3 OR (Risk 2 + Embassy Visa in hard African/Asian logistics)
  if (
    country.riskLevel === 3 ||
    (country.visaForPl === 'EMBASSY_VISA' && country.riskLevel >= 2)
  ) {
    return {
      phaseId: 4,
      expeditionCostUsd,
      dailyUsd,
      score: 40000 + country.riskLevel * 1000 + expeditionCostUsd + visaPenalty,
    };
  }

  // Phase 3: Safe (Risk 1-2), but Expensive daily cost (>= $175/day in mid) OR Expensive remote islands (Oceania / Caribbean with high total cost)
  if (
    dailyUsd >= 175 ||
    country.continent === 'Oceania' ||
    expeditionCostUsd >= 1150
  ) {
    return {
      phaseId: 3,
      expeditionCostUsd,
      dailyUsd,
      score: 30000 + expeditionCostUsd + country.riskLevel * 250 + visaPenalty,
    };
  }

  // Phase 1: Very safe (Risk 1, or Risk 2 cheap in Europe/Caucasus/SE Asia), affordable (daily <= $115 and total share <= $680), no embassy visa
  if (
    country.visaForPl !== 'EMBASSY_VISA' &&
    dailyUsd <= 115 &&
    expeditionCostUsd <= 680 &&
    (country.riskLevel === 1 ||
      country.continent === 'Europa' ||
      country.clusterId === 'as-caucasus' ||
      country.clusterId === 'as-central-stans' ||
      country.clusterId === 'as-indochina')
  ) {
    return {
      phaseId: 1,
      expeditionCostUsd,
      dailyUsd,
      score: 10000 + expeditionCostUsd + country.riskLevel * 200 + visaPenalty,
    };
  }

  // Phase 2: All remaining safe (Risk 1-2) moderate-budget continental countries
  return {
    phaseId: 2,
    expeditionCostUsd,
    dailyUsd,
    score: 20000 + expeditionCostUsd + country.riskLevel * 300 + visaPenalty,
  };
}

interface MasterExpeditionPacket {
  id: string;
  phaseId: 1 | 2 | 3 | 4 | 5;
  stepNumber: number;
  title: string;
  continent: string;
  countries: {
    country: CountryRecord;
    globalOrderNumber: number;
    dailyUsd: number;
    expeditionCostUsd: number;
  }[];
  totalDays: number;
  estimatedFlightUsd: number;
  totalPackageUsd: number;
  bestMonth: number;
  avgRisk: number;
}

export const MasterRouteView: React.FC<MasterRouteViewProps> = ({
  userProgress,
  travelStyle,
  onSelectCountry,
  onLoadExpeditionToTrip,
}) => {
  const [onlyUnvisited, setOnlyUnvisited] = useState<boolean>(true);
  const [displayMode, setDisplayMode] = useState<'expeditions' | 'ranking'>(
    'expeditions'
  );
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<
    1 | 2 | 3 | 4 | 5 | 'ALL'
  >('ALL');

  // Evaluate and sort all countries
  const masterPlanData = useMemo(() => {
    const baseCountries = ALL_COUNTRIES.filter((c) => {
      if (!onlyUnvisited) return true;
      return (userProgress[c.code]?.status ?? 'UNVISITED') !== 'VISITED';
    });

    const evaluated = baseCountries.map((country) => {
      const metrics = evaluateCountryMasterScore(country, travelStyle);
      return {
        country,
        ...metrics,
      };
    });

    // Group countries by (phaseId + clusterId) so we travel in contiguous regional packages!
    const packetMap = new Map<
      string,
      {
        phaseId: 1 | 2 | 3 | 4 | 5;
        clusterId: string;
        items: typeof evaluated;
        avgScore: number;
      }
    >();

    for (const item of evaluated) {
      const key = `${item.phaseId}__${item.country.clusterId}`;
      const existing = packetMap.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        packetMap.set(key, {
          phaseId: item.phaseId,
          clusterId: item.country.clusterId,
          items: [item],
          avgScore: 0,
        });
      }
    }

    // Sort items inside each packet by score, and compute packet avgScore
    const packetsArray = Array.from(packetMap.values()).map((pkt) => {
      pkt.items.sort((a, b) => a.score - b.score);
      const sumScore = pkt.items.reduce((acc, x) => acc + x.score, 0);
      pkt.avgScore = sumScore / pkt.items.length;
      return pkt;
    });

    // Sort packets globally: first by phaseId (1 -> 5), then by avgScore ascending
    packetsArray.sort((a, b) => {
      if (a.phaseId !== b.phaseId) return a.phaseId - b.phaseId;
      return a.avgScore - b.avgScore;
    });

    // Assign global order numbers (1 .. N) and build MasterExpeditionPacket objects
    let globalCounter = 1;
    let expeditionCounter = 1;

    const expeditions: MasterExpeditionPacket[] = packetsArray.map((pkt) => {
      const cluster = CLUSTERS_BY_ID[pkt.clusterId];
      const numberedCountries = pkt.items.map((item) => ({
        country: item.country,
        globalOrderNumber: globalCounter++,
        dailyUsd: item.dailyUsd,
        expeditionCostUsd: item.expeditionCostUsd,
      }));

      const totalDays = numberedCountries.reduce(
        (sum, x) => sum + x.country.recommendedDays,
        0
      );
      const groundUsd = numberedCountries.reduce(
        (sum, x) => sum + x.dailyUsd * x.country.recommendedDays,
        0
      );
      const estimatedFlightUsd = cluster?.estimatedFlightFromPlUsd ?? 500;
      const totalPackageUsd = groundUsd + estimatedFlightUsd;
      const avgRisk =
        numberedCountries.reduce((sum, x) => sum + x.country.riskLevel, 0) /
        numberedCountries.length;

      const phaseSuffix =
        pkt.phaseId === 5
          ? ' (Strefy wysokiego ryzyka)'
          : pkt.phaseId === 4
          ? ' (Etap zaawansowany)'
          : '';

      return {
        id: `${pkt.phaseId}-${pkt.clusterId}`,
        phaseId: pkt.phaseId,
        stepNumber: expeditionCounter++,
        title: `${cluster?.namePl ?? pkt.clusterId}${phaseSuffix}`,
        continent:
          cluster?.continent ?? numberedCountries[0]?.country.continent ?? '',
        countries: numberedCountries,
        totalDays,
        estimatedFlightUsd,
        totalPackageUsd,
        bestMonth: cluster?.bestMonths[0] ?? 5,
        avgRisk,
      };
    });

    const flatOrderedCountries = expeditions.flatMap((exp) =>
      exp.countries.map((c) => ({
        ...c,
        phaseId: exp.phaseId,
        expeditionStep: exp.stepNumber,
        expeditionTitle: exp.title,
      }))
    );

    return {
      expeditions,
      flatOrderedCountries,
    };
  }, [onlyUnvisited, travelStyle, userProgress]);

  const filteredExpeditions = useMemo(() => {
    if (selectedPhaseFilter === 'ALL') return masterPlanData.expeditions;
    return masterPlanData.expeditions.filter(
      (e) => e.phaseId === selectedPhaseFilter
    );
  }, [masterPlanData.expeditions, selectedPhaseFilter]);

  const filteredFlatCountries = useMemo(() => {
    if (selectedPhaseFilter === 'ALL')
      return masterPlanData.flatOrderedCountries;
    return masterPlanData.flatOrderedCountries.filter(
      (c) => c.phaseId === selectedPhaseFilter
    );
  }, [masterPlanData.flatOrderedCountries, selectedPhaseFilter]);

  const firstExpedition = masterPlanData.expeditions[0];

  return (
    <div className="space-y-6">
      {/* Top Hero / Strategy Explanation Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#122144] dark:text-sky-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Algorytm Optymalnej Trasy Przez Cały Świat (5 Faz)</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">
            Od najtańszych i najbezpieczniejszych pakietów — aż po najdroższe wyspy i strefy ryzyka 4/4 na samym końcu
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Zamiast skakać losowo po mapie, algorytm układa wszystkie państwa w logiczne wyprawy sąsiedzkie. Zaczynasz od bezpiecznych, bezwizowych i tanich regionów blisko Polski (Faza 1), następnie przechodzisz przez średni budżet (Faza 2) i drogie wyspy Pacyfiku/Karaibów (Faza 3), a kraje trudne wizowo (Faza 4) oraz niebezpieczne strefy konfliktów (Faza 5) zostawiasz na sam koniec.
          </p>
        </div>

        {firstExpedition && (
          <div className="shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2">
            <button
              type="button"
              onClick={() =>
                onLoadExpeditionToTrip(
                  `Wyprawa #1: ${firstExpedition.title}`,
                  firstExpedition.countries.map((c) => c.country.code),
                  firstExpedition.estimatedFlightUsd,
                  firstExpedition.bestMonth,
                  'map'
                )
              }
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>
                Pokaż Wyprawę #1 na Mapie ({firstExpedition.countries.length} państw)
              </span>
            </button>
            <button
              type="button"
              onClick={() =>
                onLoadExpeditionToTrip(
                  `Wyprawa #1: ${firstExpedition.title}`,
                  firstExpedition.countries.map((c) => c.country.code),
                  firstExpedition.estimatedFlightUsd,
                  firstExpedition.bestMonth,
                  'builder'
                )
              }
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <span>Otwórz Wyprawę #1 w Kreatorze</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 5 Phase Summary Cards (Interactive Filter) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {MASTER_PHASES.map((phase) => {
          const countInPhase = masterPlanData.flatOrderedCountries.filter(
            (c) => c.phaseId === phase.id
          ).length;
          const active = selectedPhaseFilter === phase.id;

          return (
            <button
              key={phase.id}
              type="button"
              onClick={() =>
                setSelectedPhaseFilter(active ? 'ALL' : phase.id)
              }
              className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                active
                  ? 'bg-slate-900 dark:bg-sky-950/60 text-white border-slate-900 dark:border-sky-500 shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider opacity-80">
                    <span className={`w-2 h-2 rounded-full ${phase.dotClass}`} />
                    Faza {phase.id}
                  </span>
                  <span className="font-mono text-xs font-bold tabular-nums">
                    {countInPhase} państw
                  </span>
                </div>
                <div
                  className={`text-xs font-bold leading-snug ${
                    active
                      ? 'text-white'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {phase.badgeText.replace(`Etap ${phase.id} · `, '')}
                </div>
              </div>

              <div
                className={`text-[11px] leading-normal line-clamp-2 ${
                  active
                    ? 'text-slate-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {phase.subtitle}
              </div>
            </button>
          );
        })}
      </div>

      {/* Unified Command Bar for Masterplan */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setDisplayMode('expeditions')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                displayMode === 'expeditions'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Kolejne Wyprawy Pakietowe ({filteredExpeditions.length})
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('ranking')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                displayMode === 'ranking'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              Pełna Kolejność Państw 1 → {masterPlanData.flatOrderedCountries.length}
            </button>
          </div>

          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setOnlyUnvisited(true)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                onlyUnvisited
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Tylko nieodwiedzone przeze mnie
            </button>
            <button
              type="button"
              onClick={() => setOnlyUnvisited(false)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                !onlyUnvisited
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Wszystkie 195 państw
            </button>
          </div>
        </div>

        {selectedPhaseFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => setSelectedPhaseFilter('ALL')}
            className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
          >
            Pokaż wszystkie 5 faz ({masterPlanData.flatOrderedCountries.length} państw)
          </button>
        )}
      </div>

      {/* Main Content: Either Ordered Expeditions by Phase OR Flat 1->195 Table */}
      {displayMode === 'expeditions' ? (
        <div className="space-y-8">
          {MASTER_PHASES.filter(
            (p) =>
              selectedPhaseFilter === 'ALL' || p.id === selectedPhaseFilter
          ).map((phase) => {
            const phaseExpeditions = filteredExpeditions.filter(
              (e) => e.phaseId === phase.id
            );
            if (phaseExpeditions.length === 0) return null;

            const phaseCountriesCount = phaseExpeditions.reduce(
              (acc, e) => acc + e.countries.length,
              0
            );
            const phaseTotalUsd = phaseExpeditions.reduce(
              (acc, e) => acc + e.totalPackageUsd,
              0
            );

            return (
              <div key={phase.id} className="space-y-4">
                {/* Phase Header Banner */}
                <div
                  className={`bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 ${phase.accentClass}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {phase.badgeText}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-50 mt-0.5">
                        {phase.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {phase.subtitle}
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {phaseExpeditions.length} wypraw · {phaseCountriesCount} państw
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Łączny koszt fazy: ~${phaseTotalUsd.toLocaleString('en-US')} USD
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expeditions Grid in this Phase */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {phaseExpeditions.map((exp) => {
                    const totalPln = Math.round(exp.totalPackageUsd * USD_TO_PLN);
                    const firstGlobal =
                      exp.countries[0]?.globalOrderNumber ?? 1;
                    const lastGlobal =
                      exp.countries[exp.countries.length - 1]
                        ?.globalOrderNumber ?? firstGlobal;

                    return (
                      <div
                        key={exp.id}
                        className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-3">
                          {/* Top Row: Step Number & Cost */}
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                  Wyprawa #{exp.stepNumber}
                                </span>
                                <span>·</span>
                                <span>
                                  Kolejność świata: #{firstGlobal}–#{lastGlobal}
                                </span>
                                <span>·</span>
                                <span>{exp.continent}</span>
                              </div>
                              <h4 className="text-base font-bold text-slate-900 dark:text-slate-50 mt-0.5">
                                {exp.title}
                              </h4>
                            </div>

                            <div className="text-right font-mono tabular-nums shrink-0">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-50">
                                ${exp.totalPackageUsd.toLocaleString('en-US')}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                ~{totalPln.toLocaleString('pl-PL')} zł · {exp.totalDays} dni
                              </div>
                            </div>
                          </div>

                          {/* Countries in this Expedition */}
                          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-lg">
                            {exp.countries.map(
                              ({ country, globalOrderNumber, dailyUsd }) => (
                                <button
                                  key={country.code}
                                  type="button"
                                  onClick={() => onSelectCountry(country.code)}
                                  className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 w-7 shrink-0">
                                      #{globalOrderNumber}
                                    </span>
                                    <CountryFlag code={country.code} size="sm" />
                                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:underline truncate">
                                      {country.namePl}
                                    </span>
                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate hidden sm:inline">
                                      ({country.capitalPl})
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                                    <span>~{country.recommendedDays}d</span>
                                    <span>${dailyUsd}/d</span>
                                    <span
                                      className={`font-sans ${
                                        country.riskLevel === 4
                                          ? 'text-red-600 dark:text-red-400 font-semibold'
                                          : country.riskLevel === 3
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      {country.riskLevel}/4
                                    </span>
                                  </div>
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Expedition Footer Actions */}
                        <div className="pt-3 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-mono tabular-nums">
                            <Plane className="w-3.5 h-3.5 text-slate-400" />
                            Lot z PL: ~${exp.estimatedFlightUsd}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onLoadExpeditionToTrip(
                                  `Wyprawa #${exp.stepNumber}: ${exp.title}`,
                                  exp.countries.map((c) => c.country.code),
                                  exp.estimatedFlightUsd,
                                  exp.bestMonth,
                                  'map'
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                              Pokaż na Mapie
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onLoadExpeditionToTrip(
                                  `Wyprawa #${exp.stepNumber}: ${exp.title}`,
                                  exp.countries.map((c) => c.country.code),
                                  exp.estimatedFlightUsd,
                                  exp.bestMonth,
                                  'builder'
                                )
                              }
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors"
                            >
                              <span>Wczytaj etap ({exp.countries.length})</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* FLAT 1 -> 195 ORDERED TABLE VIEW */
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-5">Kolejność #</th>
                  <th className="py-3.5 px-4">Państwo</th>
                  <th className="py-3.5 px-4">Faza i Wyprawa Pakietowa</th>
                  <th className="py-3.5 px-4 text-right">Koszt / dzień</th>
                  <th className="py-3.5 px-4 text-right">Koszt etapu</th>
                  <th className="py-3.5 px-4">Ryzyko</th>
                  <th className="py-3.5 px-5">Wiza PL i sezon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/80 text-xs">
                {filteredFlatCountries.map(
                  ({
                    country,
                    globalOrderNumber,
                    dailyUsd,
                    expeditionCostUsd,
                    phaseId,
                    expeditionStep,
                    expeditionTitle,
                  }) => (
                    <tr
                      key={country.code}
                      onClick={() => onSelectCountry(country.code)}
                      className="cursor-pointer hover:bg-slate-50/90 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-5 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        #{globalOrderNumber}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <CountryFlag code={country.code} size="md" />
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {country.namePl}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {country.capitalPl} · ~{country.recommendedDays} dni
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          Faza {phaseId} · Wyprawa #{expeditionStep}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                          {expeditionTitle}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          ${dailyUsd}/d
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          ~${expeditionCostUsd}
                        </div>
                        <div className="text-[11px] text-slate-400">z dolotem</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
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
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <div className="text-xs text-slate-800 dark:text-slate-200">
                          {VISA_LABELS_PL[country.visaForPl].short}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {formatMonthsRange(country.bestMonths)}
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
