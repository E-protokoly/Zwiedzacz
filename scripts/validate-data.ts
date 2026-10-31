import { ALL_COUNTRIES, COUNTRIES_BY_CODE, CLUSTERS_BY_ID } from '../src/data/index.ts';
import { TRAVEL_CLUSTERS } from '../src/data/clusters.ts';
import { COUNTRY_COORDINATES } from '../src/data/countryCoordinates.ts';

const EXPECTED_COUNTRIES_COUNT = 195;
const EXPECTED_UN_MEMBERS_COUNT = 193;
const EXPECTED_UN_OBSERVERS = ['VA', 'PS'];
const EXPECTED_CLUSTERS_COUNT = 30;

const errors: string[] = [];
const warnings: string[] = [];

// 1. Validate total count & uniqueness of 195 countries
if (ALL_COUNTRIES.length !== EXPECTED_COUNTRIES_COUNT) {
  errors.push(
    `Expected exactly ${EXPECTED_COUNTRIES_COUNT} countries, found ${ALL_COUNTRIES.length}.`
  );
}

const seenCodes = new Set<string>();
const seenNamesPl = new Set<string>();
let unMemberCount = 0;
const observerCodes: string[] = [];

for (const country of ALL_COUNTRIES) {
  if (!/^[A-Z]{2}$/.test(country.code)) {
    errors.push(`Invalid ISO-2 code format: "${country.code}" (${country.namePl}).`);
  }
  if (seenCodes.has(country.code)) {
    errors.push(`Duplicate country code: "${country.code}".`);
  }
  seenCodes.add(country.code);

  if (seenNamesPl.has(country.namePl)) {
    errors.push(`Duplicate Polish country name: "${country.namePl}".`);
  }
  seenNamesPl.add(country.namePl);

  if (country.unStatus === 'UN_MEMBER') {
    unMemberCount++;
  } else if (country.unStatus === 'UN_OBSERVER') {
    observerCodes.push(country.code);
  } else {
    errors.push(`Invalid unStatus for ${country.code}: ${String(country.unStatus)}`);
  }
}

if (unMemberCount !== EXPECTED_UN_MEMBERS_COUNT) {
  errors.push(
    `Expected ${EXPECTED_UN_MEMBERS_COUNT} UN_MEMBER states, found ${unMemberCount}.`
  );
}

for (const obs of EXPECTED_UN_OBSERVERS) {
  if (!observerCodes.includes(obs)) {
    errors.push(`Missing expected UN_OBSERVER state: ${obs}.`);
  }
}

// 2. Validate 30 regional clusters & recommendedOrder consistency
if (TRAVEL_CLUSTERS.length !== EXPECTED_CLUSTERS_COUNT) {
  errors.push(
    `Expected ${EXPECTED_CLUSTERS_COUNT} regional clusters, found ${TRAVEL_CLUSTERS.length}.`
  );
}

const seenClusterIds = new Set<string>();
for (const cluster of TRAVEL_CLUSTERS) {
  if (seenClusterIds.has(cluster.id)) {
    errors.push(`Duplicate cluster id: "${cluster.id}".`);
  }
  seenClusterIds.add(cluster.id);

  if (!Array.isArray(cluster.bestMonths) || cluster.bestMonths.length === 0) {
    errors.push(`Cluster "${cluster.id}" has empty bestMonths.`);
  } else {
    for (const m of cluster.bestMonths) {
      if (!Number.isInteger(m) || m < 1 || m > 12) {
        errors.push(`Cluster "${cluster.id}" has invalid month "${m}" in bestMonths.`);
      }
    }
  }

  const assignedCodes = ALL_COUNTRIES.filter((c) => c.clusterId === cluster.id).map(
    (c) => c.code
  );
  if (assignedCodes.length === 0) {
    errors.push(`Cluster "${cluster.id}" has 0 countries assigned to it.`);
  }

  if (cluster.recommendedOrder) {
    const orderSet = new Set(cluster.recommendedOrder);
    if (orderSet.size !== cluster.recommendedOrder.length) {
      errors.push(`Cluster "${cluster.id}" has duplicate codes in recommendedOrder.`);
    }
    for (const code of cluster.recommendedOrder) {
      if (!assignedCodes.includes(code)) {
        errors.push(
          `Cluster "${cluster.id}" recommendedOrder contains "${code}", which is not assigned to this cluster.`
        );
      }
    }
    for (const code of assignedCodes) {
      if (!orderSet.has(code)) {
        errors.push(
          `Cluster "${cluster.id}" is missing assigned country "${code}" in recommendedOrder.`
        );
      }
    }
  }
}

// 3. Validate each country's clusterId, bestMonths (1..12), costs, coordinates, and neighbors
let asymmetricNeighborLinks = 0;

for (const country of ALL_COUNTRIES) {
  // Cluster existence
  if (!CLUSTERS_BY_ID[country.clusterId]) {
    errors.push(
      `Country ${country.code} (${country.namePl}) references non-existent clusterId "${country.clusterId}".`
    );
  }

  // Best months (1..12)
  if (!Array.isArray(country.bestMonths) || country.bestMonths.length === 0) {
    errors.push(`Country ${country.code} (${country.namePl}) has empty bestMonths.`);
  } else {
    const seenMonths = new Set<number>();
    for (const m of country.bestMonths) {
      if (!Number.isInteger(m) || m < 1 || m > 12) {
        errors.push(
          `Country ${country.code} (${country.namePl}) has invalid month ${m} in bestMonths.`
        );
      }
      if (seenMonths.has(m)) {
        errors.push(
          `Country ${country.code} (${country.namePl}) has duplicate month ${m} in bestMonths.`
        );
      }
      seenMonths.add(m);
    }
  }

  // Daily cost tiers
  const { budget, mid, comfort } = country.dailyCostUsd;
  if (
    typeof budget !== 'number' ||
    typeof mid !== 'number' ||
    typeof comfort !== 'number' ||
    budget <= 0 ||
    mid < budget ||
    comfort < mid
  ) {
    errors.push(
      `Country ${country.code} (${country.namePl}) has invalid dailyCostUsd progression: budget=${budget}, mid=${mid}, comfort=${comfort}.`
    );
  }

  // Recommended days
  if (!Number.isInteger(country.recommendedDays) || country.recommendedDays < 1) {
    errors.push(
      `Country ${country.code} (${country.namePl}) has invalid recommendedDays: ${country.recommendedDays}.`
    );
  }

  // Coordinates validation
  const coords = COUNTRY_COORDINATES[country.code];
  if (!coords) {
    errors.push(
      `Country ${country.code} (${country.namePl}) is missing from COUNTRY_COORDINATES.`
    );
  } else {
    const [lat, lng] = coords;
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      Number.isNaN(lat) ||
      Number.isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      errors.push(
        `Country ${country.code} (${country.namePl}) has out-of-range coordinates: [${lat}, ${lng}].`
      );
    }
  }

  // Neighbors ISO validity & symmetry check
  const seenNeighbors = new Set<string>();
  for (const neighborCode of country.neighbors) {
    if (neighborCode === country.code) {
      errors.push(`Country ${country.code} lists itself in neighbors.`);
    }
    if (seenNeighbors.has(neighborCode)) {
      errors.push(
        `Country ${country.code} has duplicate neighbor "${neighborCode}".`
      );
    }
    seenNeighbors.add(neighborCode);

    const target = COUNTRIES_BY_CODE[neighborCode];
    if (!target) {
      errors.push(
        `Country ${country.code} (${country.namePl}) references non-existent neighbor ISO code "${neighborCode}".`
      );
    } else if (!target.neighbors.includes(country.code)) {
      asymmetricNeighborLinks++;
      warnings.push(
        `Asymmetric neighbor link: ${country.code} (${country.namePl}) -> ${neighborCode} (${target.namePl}), but ${neighborCode} does not list ${country.code}.`
      );
    }
  }
}

// Check for orphan coordinates in COUNTRY_COORDINATES
for (const code of Object.keys(COUNTRY_COORDINATES)) {
  if (!COUNTRIES_BY_CODE[code]) {
    errors.push(
      `COUNTRY_COORDINATES contains unknown country code "${code}" not present in ALL_COUNTRIES.`
    );
  }
}

if (errors.length > 0) {
  console.error(`\n❌ Data validation failed with ${errors.length} error(s):`);
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  process.exit(1);
}

console.log(
  `✅ Atlas 195 Data Validation Passed:` +
    `\n   • ${ALL_COUNTRIES.length} unique countries (${unMemberCount} UN members + ${observerCodes.join(', ')} observers)` +
    `\n   • ${TRAVEL_CLUSTERS.length} regional clusters verified` +
    `\n   • ${Object.keys(COUNTRY_COORDINATES).length} geographic coordinate pairs verified` +
    `\n   • All neighbor ISO-2 codes, cost tiers, and seasonality calendars (1..12) valid` +
    (asymmetricNeighborLinks > 0
      ? `\n   • Note: ${asymmetricNeighborLinks} directional hub/neighbor links detected`
      : `\n   • 100% symmetric neighbor graph`)
);
