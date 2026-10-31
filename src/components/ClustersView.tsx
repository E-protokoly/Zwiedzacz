import React, { useState, useMemo } from 'react';
import {
  Plane,
  Compass,
  Calendar,
  ArrowRight,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Continent,
  TravelStyle,
  UserCountryData,
} from '../types/travel.ts';
import {
  ALL_COUNTRIES,
  VISA_LABELS_PL,
  USD_TO_PLN,
  formatMonthsRange,
} from '../data/index.ts';
import { TRAVEL_CLUSTERS } from '../data/clusters.ts';
import { CountryFlag } from './CountryFlag.tsx';

interface ClustersViewProps {
  userProgress: Record<string, UserCountryData>;
  travelStyle: TravelStyle;
  onSelectCountry: (code: string) => void;
  onLoadClusterToTripBuilder: (
    clusterId: string,
    countryCodes: string[],
    clusterName: string,
    flightCostUsd: number,
    bestMonth: number
  ) => void;
}

export const ClustersView: React.FC<ClustersViewProps> = ({
  userProgress,
  travelStyle,
  onSelectCountry,
  onLoadClusterToTripBuilder,
}) => {
  const [selectedContinent, setSelectedContinent] = useState<Continent | 'ALL'>('ALL');
  const [completionFilter, setCompletionFilter] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETED'>('ALL');
  const [sortBy, setSortBy] = useState<'default' | 'costAsc' | 'countriesDesc' | 'progressDesc'>('default');

  const continents: (Continent | 'ALL')[] = [
    'ALL',
    'Europa',
    'Azja',
    'Afryka',
    'Ameryka Północna i Karaiby',
    'Ameryka Południowa',
    'Oceania',
  ];

  const enrichedClusters = useMemo(() => {
    return TRAVEL_CLUSTERS.map((cluster) => {
      const countries = ALL_COUNTRIES.filter((c) => c.clusterId === cluster.id);
      const visitedCount = countries.filter(
        (c) => (userProgress[c.code]?.status ?? 'UNVISITED') === 'VISITED'
      ).length;
      const unvisitedCountries = countries.filter(
        (c) => (userProgress[c.code]?.status ?? 'UNVISITED') !== 'VISITED'
      );

      const groundCostAllUsd = countries.reduce(
        (acc, c) =>
          acc + (c.dailyCostUsd[travelStyle] ?? c.dailyCostUsd.mid) * c.recommendedDays,
        0
      );
      const totalAllDays = countries.reduce((acc, c) => acc + c.recommendedDays, 0);

      const groundCostUnvisitedUsd = unvisitedCountries.reduce(
        (acc, c) =>
          acc + (c.dailyCostUsd[travelStyle] ?? c.dailyCostUsd.mid) * c.recommendedDays,
        0
      );

      const totalTripEstimateUsd =
        cluster.estimatedFlightFromPlUsd +
        (unvisitedCountries.length > 0 ? groundCostUnvisitedUsd : groundCostAllUsd);

      const progressPct =
        countries.length > 0 ? Math.round((visitedCount / countries.length) * 100) : 0;

      return {
        cluster,
        countries,
        unvisitedCountries,
        visitedCount,
        progressPct,
        totalAllDays,
        groundCostAllUsd,
        totalTripEstimateUsd,
      };
    });
  }, [userProgress, travelStyle]);

  const filteredClusters = useMemo(() => {
    let list = enrichedClusters.filter((item) => {
      if (selectedContinent !== 'ALL' && item.cluster.continent !== selectedContinent) {
        return false;
      }
      if (completionFilter === 'INCOMPLETE' && item.visitedCount === item.countries.length) {
        return false;
      }
      if (completionFilter === 'COMPLETED' && item.visitedCount < item.countries.length) {
        return false;
      }
      return true;
    });

    if (sortBy === 'costAsc') {
      list = [...list].sort((a, b) => a.totalTripEstimateUsd - b.totalTripEstimateUsd);
    } else if (sortBy === 'countriesDesc') {
      list = [...list].sort((a, b) => b.countries.length - a.countries.length);
    } else if (sortBy === 'progressDesc') {
      list = [...list].sort((a, b) => b.progressPct - a.progressPct);
    }

    return list;
  }, [enrichedClusters, selectedContinent, completionFilter, sortBy]);

  return (
    <div className="space-y-6">
      {/* Filter & Sort Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {continents.map((cont) => {
            const active = selectedContinent === cont;
            return (
              <button
                key={cont}
                type="button"
                onClick={() => setSelectedContinent(cont)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#122144] dark:bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                {cont === 'ALL'
                  ? `Wszystkie regiony (${TRAVEL_CLUSTERS.length})`
                  : cont}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setCompletionFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                completionFilter === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Wszystkie
            </button>
            <button
              type="button"
              onClick={() => setCompletionFilter('INCOMPLETE')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                completionFilter === 'INCOMPLETE'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Do odwiedzenia
            </button>
            <button
              type="button"
              onClick={() => setCompletionFilter('COMPLETED')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                completionFilter === 'COMPLETED'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Ukończone (100%)
            </button>
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#122144]"
              aria-label="Sortuj klastry"
            >
              <option value="default">Kolejność geograficzna</option>
              <option value="costAsc">Koszt wyprawy: od najtańszego</option>
              <option value="countriesDesc">Liczba państw w pakiecie: malejąco</option>
              <option value="progressDesc">Twój postęp w pakiecie: malejąco</option>
            </select>
          </div>
        </div>
      </div>

      {/* Clusters Grid */}
      {filteredClusters.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
          <Compass className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Brak pakietów spełniających wybrane kryteria
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Zmień filtr kontynentu lub statusu ukończenia, aby wyświetlić pozostałe klastry regionalne.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedContinent('ALL');
              setCompletionFilter('ALL');
            }}
            className="px-4 py-2 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 rounded-lg hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors"
          >
            Pokaż wszystkie {TRAVEL_CLUSTERS.length} klastrów
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {filteredClusters.map(
            ({
              cluster,
              countries,
              unvisitedCountries,
              visitedCount,
              progressPct,
              totalAllDays,
              totalTripEstimateUsd,
            }) => {
              const totalPln = Math.round(totalTripEstimateUsd * USD_TO_PLN);
              const defaultMonth = cluster.bestMonths[0] ?? 5;

              return (
                <div
                  key={cluster.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-between gap-6"
                >
                  <div className="space-y-4">
                    {/* Header Metadata */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{cluster.continent}</span>
                          <span>·</span>
                          <span>{cluster.subregion}</span>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            {countries.length} państw w pakiecie
                          </span>
                        </div>
                        <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50">
                          {cluster.namePl}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Postęp pakietu
                        </div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-50 font-mono tabular-nums">
                          {visitedCount} / {countries.length}{' '}
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                            ({progressPct}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#122144] dark:bg-sky-500 transition-all duration-200"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    {/* Summary & Logistics */}
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {cluster.summaryPl}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-start gap-2">
                        <Plane className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            Brama lotnicza: {cluster.gatewayHub}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            {cluster.transportModePl}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            Optymalny sezon: {formatMonthsRange(cluster.bestMonths)}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                            Szacowany koszt (z lotem z PL): ${totalTripEstimateUsd} (~
                            {totalPln.toLocaleString('pl-PL')} PLN)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Countries List in Cluster */}
                    <div className="pt-2">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                        Państwa wchodzące w skład pakietu (kliknij kraj, aby sprawdzić zdjęcia, wiadomości i sąsiadów):
                      </div>
                      <div className="divide-y divide-slate-200/60 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-lg">
                        {countries.map((country) => {
                          const status =
                            userProgress[country.code]?.status ?? 'UNVISITED';
                          const dailyUsd =
                            country.dailyCostUsd[travelStyle] ??
                            country.dailyCostUsd.mid;

                          return (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => onSelectCountry(country.code)}
                              className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <CountryFlag code={country.code} size="sm" />
                                <span
                                  className={`text-xs font-semibold group-hover:underline truncate ${
                                    status === 'VISITED'
                                      ? 'text-emerald-800 dark:text-emerald-400 line-through decoration-emerald-500/60'
                                      : 'text-slate-900 dark:text-slate-100'
                                  }`}
                                >
                                  {country.namePl}
                                </span>
                                {status === 'VISITED' && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                )}
                              </div>

                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 shrink-0 font-mono tabular-nums">
                                <span>{country.recommendedDays}d</span>
                                <span>·</span>
                                <span>${dailyUsd}/d</span>
                                <span>·</span>
                                <span className="font-sans">
                                  {VISA_LABELS_PL[country.visaForPl].short}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="pt-4 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      Łączny czas pakietu: ~{totalAllDays} dni
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {unvisitedCountries.length > 0 &&
                        unvisitedCountries.length < countries.length && (
                          <button
                            type="button"
                            onClick={() =>
                              onLoadClusterToTripBuilder(
                                cluster.id,
                                countries.map((c) => c.code),
                                cluster.namePl,
                                cluster.estimatedFlightFromPlUsd,
                                defaultMonth
                              )
                            }
                            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            Cały klaster ({countries.length})
                          </button>
                        )}

                      <button
                        type="button"
                        onClick={() =>
                          onLoadClusterToTripBuilder(
                            cluster.id,
                            (unvisitedCountries.length > 0
                              ? unvisitedCountries
                              : countries
                            ).map((c) => c.code),
                            cluster.namePl,
                            cluster.estimatedFlightFromPlUsd,
                            defaultMonth
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>
                          {unvisitedCountries.length > 0 &&
                          unvisitedCountries.length < countries.length
                            ? `Zaplanuj nieodwiedzone (${unvisitedCountries.length})`
                            : `Otwórz pakiet w Kreatorze (${countries.length})`}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </div>
  );
};
