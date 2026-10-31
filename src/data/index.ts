import type { CountryRecord, TravelCluster, VisaRequirementPL, RiskLevel, VisitStatus } from '../types/travel.ts';
import { COUNTRIES_EUROPE_AND_AMERICAS } from './countriesEuropeAndAmericas.ts';
import { COUNTRIES_ASIA_AND_OCEANIA } from './countriesAsiaAndOceania.ts';
import { COUNTRIES_AFRICA } from './countriesAfrica.ts';
import { TRAVEL_CLUSTERS } from './clusters.ts';

export { TRAVEL_CLUSTERS };

export const ALL_COUNTRIES: CountryRecord[] = [
  ...COUNTRIES_EUROPE_AND_AMERICAS,
  ...COUNTRIES_ASIA_AND_OCEANIA,
  ...COUNTRIES_AFRICA,
];

export const COUNTRIES_BY_CODE: Record<string, CountryRecord> = Object.fromEntries(
  ALL_COUNTRIES.map((country) => [country.code, country])
);

export const CLUSTERS_BY_ID: Record<string, TravelCluster> = Object.fromEntries(
  TRAVEL_CLUSTERS.map((cluster) => [cluster.id, cluster])
);

export const MONTHS_PL: { id: number; short: string; full: string }[] = [
  { id: 1, short: 'Sty', full: 'Styczeń' },
  { id: 2, short: 'Lut', full: 'Luty' },
  { id: 3, short: 'Mar', full: 'Marzec' },
  { id: 4, short: 'Kwi', full: 'Kwiecień' },
  { id: 5, short: 'Maj', full: 'Maj' },
  { id: 6, short: 'Cze', full: 'Czerwiec' },
  { id: 7, short: 'Lip', full: 'Lipiec' },
  { id: 8, short: 'Sie', full: 'Sierpień' },
  { id: 9, short: 'Wrz', full: 'Wrzesień' },
  { id: 10, short: 'Paź', full: 'Październik' },
  { id: 11, short: 'Lis', full: 'Listopad' },
  { id: 12, short: 'Gru', full: 'Grudzień' },
];

export const RISK_LABELS_PL: Record<RiskLevel, { label: string; short: string; description: string }> = {
  1: {
    label: 'Poziom 1 — Bardzo bezpiecznie',
    short: 'Niskie (1/4)',
    description: 'Zwykła ostrożność, wysoka stabilność i bardzo dobra infrastruktura.',
  },
  2: {
    label: 'Poziom 2 — Standardowa ostrożność',
    short: 'Umiarkowane (2/4)',
    description: 'Bezpieczne na głównych szlakach; zachowaj czujność w dużych miastach.',
  },
  3: {
    label: 'Poziom 3 — Podwyższone ryzyko',
    short: 'Podwyższone (3/4)',
    description: 'Wymaga dobrego przygotowania logistycznego i unikania regionów przygranicznych.',
  },
  4: {
    label: 'Poziom 4 — Wysokie ryzyko / Ostrzeżenie',
    short: 'Wysokie (4/4)',
    description: 'Aktywne ostrzeżenia MSZ, niestabilność lub wymóg lokalnej eskorty.',
  },
};

export const VISA_LABELS_PL: Record<VisaRequirementPL, { label: string; short: string; order: number }> = {
  VISA_FREE: {
    label: 'Bezwizowo / Dowód lub Paszport',
    short: 'Bezwizowo',
    order: 1,
  },
  EVISA_VOA: {
    label: 'e-Wiza online lub Wiza na lotnisku (VOA)',
    short: 'e-Visa / VOA',
    order: 2,
  },
  EMBASSY_VISA: {
    label: 'Wiza w ambasadzie / Zaproszenie',
    short: 'Ambasada',
    order: 3,
  },
};

export const STATUS_LABELS_PL: Record<VisitStatus, { label: string; short: string }> = {
  VISITED: { label: 'Odwiedzony', short: 'Odwiedzony' },
  PLANNED: { label: 'W planach', short: 'W planach' },
  WISHLIST: { label: 'Lista marzeń', short: 'Marzenie' },
  UNVISITED: { label: 'Nieodwiedzony', short: 'Nieodwiedzony' },
};

export const USD_TO_PLN = 3.95;

export function formatMonthsRange(months: number[]): string {
  if (!months || months.length === 0) return 'Cały rok';
  if (months.length >= 10) return 'Cały rok';
  return months
    .map((m) => MONTHS_PL.find((item) => item.id === m)?.short ?? '')
    .filter(Boolean)
    .join(', ');
}
