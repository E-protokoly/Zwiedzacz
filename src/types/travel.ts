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

export type ClusterId =
  // Europa (7)
  | 'eu-central-baltic'
  | 'eu-nordic'
  | 'eu-west-benelux'
  | 'eu-alpine-italia'
  | 'eu-iberia'
  | 'eu-balkans'
  | 'eu-east'
  // Azja (8)
  | 'as-caucasus'
  | 'as-levant'
  | 'as-gulf'
  | 'as-central-stans'
  | 'as-south'
  | 'as-indochina'
  | 'as-maritime-se'
  | 'as-east'
  // Afryka (7)
  | 'af-north'
  | 'af-west-atlantic'
  | 'af-gulf-guinea'
  | 'af-central'
  | 'af-horn'
  | 'af-east-lakes'
  | 'af-south-indian'
  // Ameryka Północna i Karaiby (4)
  | 'na-north'
  | 'na-central-isthmus'
  | 'na-greater-antilles'
  | 'na-lesser-antilles'
  // Ameryka Południowa (2)
  | 'sa-guianas-north'
  | 'sa-andes-cone'
  // Oceania (2)
  | 'oc-south-pacific'
  | 'oc-micronesia';

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
  clusterId: ClusterId;
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
  id: ClusterId;
  namePl: string;
  continent: Continent;
  subregion: string;
  gatewayHub: string;
  transportModePl: string;
  summaryPl: string;
  estimatedFlightFromPlUsd: number;
  recommendedTotalDays: number;
  bestMonths: number[];
  recommendedOrder?: string[];
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
  clusterId?: ClusterId;
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
