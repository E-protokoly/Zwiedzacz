export type Continent =
  | 'Europa'
  | 'Azja'
  | 'Afryka'
  | 'Ameryka Północna i Karaiby'
  | 'Ameryka Południowa'
  | 'Oceania';

export type UNStatus = 'UN_MEMBER' | 'UN_OBSERVER';

export type RiskLevel = 1 | 2 | 3 | 4;

export type VisaRequirementPL = 'VISA_FREE' | 'EVISA_VOA' | 'EMBASSY_VISA';

export type VisitStatus = 'UNVISITED' | 'VISITED' | 'PLANNED' | 'WISHLIST';

export type TravelStyle = 'budget' | 'mid' | 'comfort';

export interface DailyCostTier {
  budget: number;  // USD / day (backpacker, hostele, street food, transport lokalny)
  mid: number;     // USD / day (hotele 3*, restauracje lokalne, pociągi/loty)
  comfort: number; // USD / day (hotele 4-5*, prywatne transfery, pełen komfort)
}

export interface CountryRecord {
  code: string;
  namePl: string;
  nameEn: string;
  capitalPl: string;
  flag: string;
  unStatus: UNStatus;
  continent: Continent;
  subregion: string;
  clusterId: string;
  riskLevel: RiskLevel;
  dailyCostUsd: DailyCostTier;
  visaForPl: VisaRequirementPL;
  visaNotePl: string;
  bestMonths: number[]; // 1..12
  neighbors: string[];  // ISO-2 codes of countries best visited together ("przy okazji")
  highlightsPl: string;
  recommendedDays: number;
}

export interface TravelCluster {
  id: string;
  namePl: string;
  continent: Continent;
  subregion: string;
  gatewayHub: string;
  transportModePl: string;
  summaryPl: string;
  estimatedFlightFromPlUsd: number;
  recommendedTotalDays: number;
  bestMonths: number[];
}

export interface UserCountryData {
  status: VisitStatus;
  visitedYear?: number;
  rating?: number;
  notes: string;
}

export interface TripStop {
  countryCode: string;
  days: number;
  customDailyUsd?: number;
  notes: string;
}

export interface SavedTripPlan {
  id: string;
  name: string;
  clusterId?: string;
  targetMonth: number; // 1..12
  travelStyle: TravelStyle;
  estimatedFlightsUsd: number;
  stops: TripStop[];
  updatedAt: string;
}

export type SortField =
  | 'namePl'
  | 'dailyCost'
  | 'riskLevel'
  | 'visaForPl'
  | 'neighborsCount'
  | 'recommendedDays';

export type SortDirection = 'asc' | 'desc';
