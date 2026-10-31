import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Check,
  Compass,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  FileText,
  ArrowRight,
  Plane,
  Sparkles,
  Newspaper,
  RefreshCw,
  ExternalLink,
  Camera,
  Landmark,
} from 'lucide-react';
import {
  CountryRecord,
  UserCountryData,
  VisitStatus,
  TravelStyle,
} from '../types/travel.ts';
import {
  COUNTRIES_BY_CODE,
  CLUSTERS_BY_ID,
  MONTHS_PL,
  RISK_LABELS_PL,
  VISA_LABELS_PL,
  USD_TO_PLN,
  formatMonthsRange,
} from '../data/index.ts';
import { CountryFlag } from './CountryFlag.tsx';

interface CountryNewsItem {
  countryCode: string;
  summaryMarkdown: string;
  sources: { title: string; uri: string }[];
  fetchedAt: string;
}

interface CountryPlacePhoto {
  namePl: string;
  categoryPl: string;
  descriptionPl: string;
  imageUrl: string | null;
  pageUrl: string | null;
}

const NEWS_CACHE_KEY = 'atlas195_country_news_cache_v3';
const PHOTOS_CACHE_KEY = 'atlas195_country_photos_cache_v3';

function isValidClientLandmarkPhotoUrl(
  url: string | null | undefined,
  pageTitle = ''
): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  const lowerTitle = pageTitle.toLowerCase();
  if (/\.svg(\.png|\.jpg|\.jpeg)?(\?|$)/i.test(lower)) return false;
  if (
    lower.includes('flag_of_') ||
    lower.includes('flaga_') ||
    lower.includes('coat_of_arms') ||
    lower.includes('herb_') ||
    lower.includes('locator_map') ||
    lower.includes('location_map') ||
    lower.includes('orthographic') ||
    lower.includes('emblem_of') ||
    lower.includes('seal_of') ||
    lower.includes('welterbe') ||
    lower.includes('unesco_logo') ||
    lower.includes('commons-logo') ||
    lower.includes('question_book') ||
    lower.includes('map_of_') ||
    lower.includes('mapa_') ||
    lower.includes('icon') ||
    lower.includes('symbol')
  ) {
    return false;
  }
  if (
    lowerTitle.startsWith('list of') ||
    lowerTitle.startsWith('lists of') ||
    lowerTitle.startsWith('outline of') ||
    lowerTitle.startsWith('index of') ||
    lowerTitle.startsWith('flag of') ||
    lowerTitle.startsWith('economy of') ||
    lowerTitle.startsWith('demographics of') ||
    lowerTitle.startsWith('politics of')
  ) {
    return false;
  }
  return true;
}

async function fetchClientWikiSummary(
  lang: 'pl' | 'en',
  title: string
): Promise<{
  title: string;
  description: string;
  imageUrl: string | null;
  pageUrl: string | null;
} | null> {
  if (!title || !title.trim()) return null;
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title.trim()
    )}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.type === 'disambiguation') return null;

    const thumbUrl = data?.thumbnail?.source;
    const origUrl = data?.originalimage?.source;
    const imageUrl = isValidClientLandmarkPhotoUrl(thumbUrl, data?.title)
      ? String(thumbUrl)
      : isValidClientLandmarkPhotoUrl(origUrl, data?.title)
      ? String(origUrl)
      : null;

    if (!imageUrl) return null;

    return {
      title: String(data?.title || title),
      description: String(data?.extract || ''),
      imageUrl,
      pageUrl: data?.content_urls?.desktop?.page || null,
    };
  } catch {
    return null;
  }
}

async function searchClientWikiGenerator(
  lang: 'pl' | 'en',
  query: string
): Promise<
  Array<{
    title: string;
    description: string;
    imageUrl: string;
    pageUrl: string | null;
  }>
> {
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?origin=*&action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=6&prop=pageimages|extracts|info&exintro=1&explaintext=1&exchars=190&inprop=url&pithumbsize=500&format=json`;
    const res = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pages: Array<{
      title: string;
      extract?: string;
      thumbnail?: { source?: string };
      fullurl?: string;
    }> = data?.query?.pages ? Object.values(data.query.pages) : [];

    const out: Array<{
      title: string;
      description: string;
      imageUrl: string;
      pageUrl: string | null;
    }> = [];

    for (const p of pages) {
      const img = p?.thumbnail?.source;
      if (img && isValidClientLandmarkPhotoUrl(img, p.title)) {
        out.push({
          title: p.title,
          description: p.extract || '',
          imageUrl: img,
          pageUrl: p.fullurl || null,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchClientWikiMediaList(
  lang: 'pl' | 'en',
  title: string,
  countryNamePl: string
): Promise<CountryPlacePhoto[]> {
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(
      title.trim()
    )}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const photos: CountryPlacePhoto[] = [];

    for (const item of items) {
      if (photos.length >= 4) break;
      if (item?.type !== 'image') continue;
      const itemTitle = String(item?.title || '').replace(/^File:|^Plik:/i, '');
      const srcRaw =
        item?.srcset?.[1]?.src ||
        item?.srcset?.[0]?.src ||
        item?.original?.source ||
        '';
      const fullSrc = srcRaw.startsWith('//') ? `https:${srcRaw}` : srcRaw;
      if (!isValidClientLandmarkPhotoUrl(fullSrc, itemTitle)) continue;

      const caption = String(item?.caption?.text || '').trim();
      const cleanName = itemTitle.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
      photos.push({
        namePl: cleanName.slice(0, 60) || countryNamePl,
        categoryPl: `Fotografia z kraju · ${countryNamePl}`,
        descriptionPl:
          caption ||
          `Krajobraz i architektura w państwie ${countryNamePl}.`,
        imageUrl: fullSrc,
        pageUrl: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(
          title.trim()
        )}`,
      });
    }
    return photos;
  } catch {
    return [];
  }
}

function buildClientFallbackPhotos(
  targetCountry: CountryRecord
): CountryPlacePhoto[] {
  const beforeDash =
    (targetCountry.highlightsPl || '').split(/\s+[—–]\s+/)[0] || '';
  const tokens = beforeDash
    .split(/[,·;]/)
    .map((s) => s.replace(/\(.*?\)/g, '').trim())
    .filter(
      (s) =>
        s.length >= 2 &&
        s.toLowerCase() !== targetCountry.capitalPl.toLowerCase()
    );

  const labels = [
    `${targetCountry.capitalPl} — Stolica`,
    ...tokens.slice(0, 3),
  ];
  while (labels.length < 4) {
    labels.push(
      `Region turystyczny #${labels.length + 1} (${targetCountry.namePl})`
    );
  }

  return labels.slice(0, 4).map((label, idx) => ({
    namePl: label,
    categoryPl:
      idx === 0
        ? `Stolica · ${targetCountry.namePl}`
        : `Atrakcja i region · ${targetCountry.namePl}`,
    descriptionPl: targetCountry.highlightsPl,
    imageUrl: null,
    pageUrl: `https://pl.wikipedia.org/wiki/${encodeURIComponent(
      targetCountry.namePl
    )}`,
  }));
}

async function resolveClientPlaceCandidate(
  labelPl: string,
  categoryPl: string,
  namePl: string,
  nameEn: string
): Promise<CountryPlacePhoto | null> {
  const summary =
    (await fetchClientWikiSummary('pl', labelPl)) ||
    (await fetchClientWikiSummary('en', labelPl));

  if (summary && summary.imageUrl) {
    return {
      namePl: labelPl,
      categoryPl,
      descriptionPl:
        summary.description.slice(0, 180) +
        (summary.description.length > 180 ? '...' : ''),
      imageUrl: summary.imageUrl,
      pageUrl: summary.pageUrl,
    };
  }

  const hitsPl = await searchClientWikiGenerator('pl', `${labelPl} ${namePl}`);
  if (hitsPl.length > 0) {
    return {
      namePl: labelPl,
      categoryPl,
      descriptionPl:
        hitsPl[0].description ||
        `Jedna z głównych atrakcji w kraju ${namePl}.`,
      imageUrl: hitsPl[0].imageUrl,
      pageUrl: hitsPl[0].pageUrl,
    };
  }

  const hitsEn = await searchClientWikiGenerator('en', `${labelPl} ${nameEn}`);
  if (hitsEn.length > 0) {
    return {
      namePl: labelPl,
      categoryPl,
      descriptionPl:
        hitsEn[0].description ||
        `Jedno z najbardziej znanych miejsc w kraju ${namePl}.`,
      imageUrl: hitsEn[0].imageUrl,
      pageUrl: hitsEn[0].pageUrl,
    };
  }

  return null;
}

async function fetchClientWikipediaPhotosForCountry(
  targetCountry: CountryRecord
): Promise<CountryPlacePhoto[]> {
  const { namePl, nameEn, capitalPl, highlightsPl } = targetCountry;
  const beforeDash = (highlightsPl || '').split(/\s+[—–]\s+/)[0] || '';
  const rawTokens = beforeDash
    .split(/[,·;]/)
    .map((s) => s.replace(/\(.*?\)/g, '').trim())
    .filter(
      (s) =>
        s.length >= 2 &&
        s.length <= 50 &&
        s.toLowerCase() !== capitalPl.toLowerCase()
    );

  const candidateTasks: Array<Promise<CountryPlacePhoto | null>> = [
    resolveClientPlaceCandidate(
      capitalPl,
      `Stolica · ${namePl}`,
      namePl,
      nameEn
    ).then((res) =>
      res ? { ...res, namePl: `${capitalPl} — Stolica` } : null
    ),
    ...rawTokens.slice(0, 4).map((token) =>
      resolveClientPlaceCandidate(
        token,
        `Atrakcja i region · ${namePl}`,
        namePl,
        nameEn
      )
    ),
  ];

  const [resolvedCandidates, fallbackPl, fallbackEn, mediaListEn] =
    await Promise.all([
      Promise.all(candidateTasks),
      searchClientWikiGenerator('pl', `${namePl} zabytek park narodowy miasto`),
      searchClientWikiGenerator('en', `${nameEn} UNESCO World Heritage landmark`),
      fetchClientWikiMediaList('en', nameEn, namePl),
    ]);

  const results: CountryPlacePhoto[] = [];
  const usedUrls = new Set<string>();

  for (const item of resolvedCandidates) {
    if (results.length >= 4) break;
    if (item && item.imageUrl && !usedUrls.has(item.imageUrl)) {
      usedUrls.add(item.imageUrl);
      results.push(item);
    }
  }

  for (const hit of [...fallbackPl, ...fallbackEn]) {
    if (results.length >= 4) break;
    if (hit.imageUrl && !usedUrls.has(hit.imageUrl)) {
      usedUrls.add(hit.imageUrl);
      results.push({
        namePl: hit.title,
        categoryPl: `Miejsce i dziedzictwo · ${namePl}`,
        descriptionPl:
          hit.description ||
          `Ważny punkt na mapie podróżniczej kraju ${namePl}.`,
        imageUrl: hit.imageUrl,
        pageUrl: hit.pageUrl,
      });
    }
  }

  for (const mediaItem of mediaListEn) {
    if (results.length >= 4) break;
    if (mediaItem.imageUrl && !usedUrls.has(mediaItem.imageUrl)) {
      usedUrls.add(mediaItem.imageUrl);
      results.push(mediaItem);
    }
  }

  if (results.length < 4) {
    const fallbackCards = buildClientFallbackPhotos(targetCountry);
    for (const card of fallbackCards) {
      if (results.length >= 4) break;
      results.push(card);
    }
  }

  return results.slice(0, 4);
}

function buildClientFallbackNews(
  targetCountry: CountryRecord
): CountryNewsItem {
  const cluster = CLUSTERS_BY_ID[targetCountry.clusterId];
  const riskInfo = `${RISK_LABELS_PL[targetCountry.riskLevel].label} — ${
    RISK_LABELS_PL[targetCountry.riskLevel].description
  }`;
  const visaInfo = `${VISA_LABELS_PL[targetCountry.visaForPl].label} (${
    targetCountry.visaNotePl
  })`;
  const seasonInfo = formatMonthsRange(targetCountry.bestMonths);

  const summaryMarkdown = `### 1. Raport i sytuacja podróżnicza — ${targetCountry.namePl} (${targetCountry.capitalPl})
- **Główne atrakcje i kierunek:** ${targetCountry.highlightsPl}
- **Rekomendowany czas pobytu i budżet:** ok. **${targetCountry.recommendedDays} dni**; dzienny koszt na miejscu wynosi średnio **$${targetCountry.dailyCostUsd.budget}** (Backpacker), **$${targetCountry.dailyCostUsd.mid}** (Komfort) lub **$${targetCountry.dailyCostUsd.comfort}** (Premium).

### 2. Bezpieczeństwo i logistyka regionalna
- **Poziom bezpieczeństwa:** ${riskInfo}
- **Pakiet regionalny:** ${
    cluster
      ? `Kraj należy do klastra **${cluster.namePl}** (główny hub dolotowy: ${cluster.gatewayHub}; rekomendowany transport w pakiecie: ${cluster.transportModePl}).`
      : `Głównym punktem wjazdowym pozostaje stolica kraju — **${targetCountry.capitalPl}**.`
  }

### 3. Praktyczny puls dla turysty z Polski
- **Wymogi wjazdowe (paszport PL):** ${visaInfo}
- **Optymalne okno pogodowe:** ${seasonInfo}`;

  return {
    countryCode: targetCountry.code,
    summaryMarkdown,
    sources: [
      {
        title: `Google News PL: ${targetCountry.namePl} — najnowsze wiadomości`,
        uri: `https://news.google.com/search?q=${encodeURIComponent(
          `${targetCountry.namePl} podróż turystyka bezpieczeństwo`
        )}&hl=pl&gl=PL&ceid=PL:pl`,
      },
      {
        title: 'Komunikaty MSZ RP dla podróżujących (gov.pl)',
        uri: 'https://www.gov.pl/web/dyplomacja/informacje-dla-podrozujacych',
      },
      {
        title: `Przewodnik Wikivoyage — ${targetCountry.nameEn}`,
        uri: `https://en.wikivoyage.org/wiki/${encodeURIComponent(
          targetCountry.nameEn
        )}`,
      },
    ],
    fetchedAt: new Date().toISOString(),
  };
}

interface CountryInspectorModalProps {
  country: CountryRecord | null;
  userProgress: Record<string, UserCountryData>;
  travelStyle: TravelStyle;
  activeTripCodes: string[];
  onClose: () => void;
  onSelectCountry: (code: string) => void;
  onUpdateStatus: (code: string, status: VisitStatus) => void;
  onUpdateNotes: (code: string, notes: string) => void;
  onUpdateVisitedYear: (code: string, year?: number) => void;
  onAddCountryToTrip: (code: string) => void;
  onBuildNeighborPackage: (baseCode: string, neighborCodes: string[]) => void;
}

export const CountryInspectorModal: React.FC<CountryInspectorModalProps> = ({
  country,
  userProgress,
  travelStyle,
  activeTripCodes,
  onClose,
  onSelectCountry,
  onUpdateStatus,
  onUpdateNotes,
  onUpdateVisitedYear,
  onAddCountryToTrip,
  onBuildNeighborPackage,
}) => {
  const [newsData, setNewsData] = useState<CountryNewsItem | null>(null);
  const [isLoadingNews, setIsLoadingNews] = useState<boolean>(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  const [placesPhotos, setPlacesPhotos] = useState<CountryPlacePhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState<boolean>(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});
  const [lightboxPlace, setLightboxPlace] = useState<CountryPlacePhoto | null>(null);

  const fetchCountryPhotos = useCallback(
    async (targetCountry: CountryRecord, forceRefresh = false) => {
      if (forceRefresh) {
        setFailedImageUrls({});
      } else {
        try {
          const rawCache = sessionStorage.getItem(PHOTOS_CACHE_KEY);
          if (rawCache) {
            const parsedCache = JSON.parse(rawCache);
            const cached = parsedCache?.[targetCountry.code];
            if (Array.isArray(cached) && cached.length > 0) {
              setPlacesPhotos(cached);
              return;
            }
          }
        } catch {
          // Ignore cache error
        }
      }

      setIsLoadingPhotos(true);
      try {
        let resolvedPlaces: CountryPlacePhoto[] | null = null;

        try {
          const response = await fetch('/api/country-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              countryCode: targetCountry.code,
              namePl: targetCountry.namePl,
              nameEn: targetCountry.nameEn,
              capitalPl: targetCountry.capitalPl,
              highlightsPl: targetCountry.highlightsPl,
              forceRefresh,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data?.places) && data.places.length > 0) {
              resolvedPlaces = data.places;
            }
          }
        } catch {
          // Static hosting (GitHub Pages) or offline — fall back to direct browser Wikipedia API
        }

        if (!resolvedPlaces || resolvedPlaces.length === 0) {
          resolvedPlaces = await fetchClientWikipediaPhotosForCountry(
            targetCountry
          );
        }

        setPlacesPhotos(resolvedPlaces);
        try {
          const rawCache = sessionStorage.getItem(PHOTOS_CACHE_KEY);
          const parsedCache = rawCache ? JSON.parse(rawCache) : {};
          parsedCache[targetCountry.code] = resolvedPlaces;
          sessionStorage.setItem(
            PHOTOS_CACHE_KEY,
            JSON.stringify(parsedCache)
          );
        } catch {
          // Ignore quota
        }
      } catch {
        setPlacesPhotos(buildClientFallbackPhotos(targetCountry));
      } finally {
        setIsLoadingPhotos(false);
      }
    },
    []
  );

  const fetchCountryNews = useCallback(
    async (targetCountry: CountryRecord, forceRefresh = false) => {
      setNewsError(null);

      if (!forceRefresh) {
        try {
          const rawCache = sessionStorage.getItem(NEWS_CACHE_KEY);
          if (rawCache) {
            const parsedCache = JSON.parse(rawCache);
            const cached = parsedCache?.[targetCountry.code];
            if (cached && cached.summaryMarkdown) {
              setNewsData(cached);
              return;
            }
          }
        } catch {
          // Ignore cache error
        }
      }

      setIsLoadingNews(true);
      try {
        let item: CountryNewsItem | null = null;

        try {
          const response = await fetch('/api/country-news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              countryCode: targetCountry.code,
              namePl: targetCountry.namePl,
              nameEn: targetCountry.nameEn,
              capitalPl: targetCountry.capitalPl,
              forceRefresh,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data && typeof data.summaryMarkdown === 'string' && data.summaryMarkdown.trim()) {
              item = {
                countryCode: targetCountry.code,
                summaryMarkdown: data.summaryMarkdown,
                sources: Array.isArray(data.sources) ? data.sources : [],
                fetchedAt: data.fetchedAt ?? new Date().toISOString(),
              };
            }
          }
        } catch {
          // Static hosting (GitHub Pages) — fall back to structured travel & safety briefing
        }

        if (!item) {
          item = buildClientFallbackNews(targetCountry);
        }

        setNewsData(item);

        try {
          const rawCache = sessionStorage.getItem(NEWS_CACHE_KEY);
          const parsedCache = rawCache ? JSON.parse(rawCache) : {};
          parsedCache[targetCountry.code] = item;
          sessionStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(parsedCache));
        } catch {
          // Ignore storage quota
        }
      } catch {
        setNewsData(buildClientFallbackNews(targetCountry));
      } finally {
        setIsLoadingNews(false);
      }
    },
    []
  );

  useEffect(() => {
    if (country) {
      setNewsData(null);
      setPlacesPhotos([]);
      setFailedImageUrls({});
      setLightboxPlace(null);
      fetchCountryPhotos(country, false);
      fetchCountryNews(country, false);
    }
  }, [country, fetchCountryPhotos, fetchCountryNews]);

  if (!country) return null;

  const userData = userProgress[country.code] ?? {
    status: 'UNVISITED',
    notes: '',
  };

  const cluster = CLUSTERS_BY_ID[country.clusterId];
  const neighborCountries = country.neighbors
    .map((code) => COUNTRIES_BY_CODE[code])
    .filter((c): c is CountryRecord => Boolean(c));

  const unvisitedNeighbors = neighborCountries.filter(
    (n) => (userProgress[n.code]?.status ?? 'UNVISITED') !== 'VISITED'
  );

  const isInActiveTrip = activeTripCodes.includes(country.code);
  const currentCostUsd =
    country.dailyCostUsd[travelStyle] ?? country.dailyCostUsd.mid;
  const currentCostPln = Math.round(currentCostUsd * USD_TO_PLN);

  const statusOptions: { value: VisitStatus; label: string }[] = [
    { value: 'UNVISITED', label: 'Nieodwiedzony' },
    { value: 'WISHLIST', label: 'Lista marzeń' },
    { value: 'PLANNED', label: 'W planach' },
    { value: 'VISITED', label: 'Odwiedzony' },
  ];

  const renderInlineBold = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return (
          <strong
            key={idx}
            className="font-semibold text-slate-900 dark:text-slate-100"
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  const renderFormattedNews = (markdown: string) => {
    const lines = markdown.split('\n').filter((l) => l.trim().length > 0);
    return (
      <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
            return (
              <h4
                key={i}
                className="text-xs font-bold text-slate-900 dark:text-slate-100 pt-2 first:pt-0"
              >
                {renderInlineBold(trimmed.replace(/^#{2,3}\s*/, ''))}
              </h4>
            );
          }
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            return (
              <div key={i} className="flex items-start gap-2 pl-1">
                <span className="text-slate-400 select-none">•</span>
                <span>{renderInlineBold(trimmed.slice(2))}</span>
              </div>
            );
          }
          return <p key={i}>{renderInlineBold(trimmed)}</p>;
        })}
      </div>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full overflow-y-auto border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Top Header */}
          <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <CountryFlag code={country.code} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>{country.continent}</span>
                  <span>·</span>
                  <span>{country.subregion}</span>
                  <span>·</span>
                  <span className="font-mono">{country.code}</span>
                  {country.unStatus === 'UN_OBSERVER' && (
                    <>
                      <span>·</span>
                      <span className="text-amber-700 dark:text-amber-400 font-medium">
                        Obserwator ONZ
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                  {country.namePl}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors shrink-0"
              aria-label="Zamknij szczegóły kraju"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-7">
            {/* Status & Quick Trip Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/70 dark:border-slate-800">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Twój status odwiedzenia
                </label>
                <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {statusOptions.map((opt) => {
                    const active = userData.status === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onUpdateStatus(country.code, opt.value)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#122144] dark:bg-sky-600 text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onAddCountryToTrip(country.code)}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    isInActiveTrip
                      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                      : 'bg-[#122144] dark:bg-sky-600 text-white hover:bg-slate-800 dark:hover:bg-sky-500'
                  }`}
                >
                  {isInActiveTrip ? (
                    <>
                      <Check className="w-3.5 h-3.5" />W aktywnej wycieczce
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Dodaj do wycieczki ({country.recommendedDays} dni)
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Key Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-slate-200/70 dark:border-slate-800">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Stolica i czas zwiedzania
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {country.capitalPl}{' '}
                  <span className="text-slate-400 font-normal">·</span>{' '}
                  <span className="font-mono tabular-nums">
                    ~{country.recommendedDays} dni
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {country.nameEn}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Poziom bezpieczeństwa
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
                  {country.riskLevel <= 2 ? (
                    <ShieldCheck
                      className={`w-4 h-4 shrink-0 ${
                        country.riskLevel === 1
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    />
                  ) : (
                    <ShieldAlert
                      className={`w-4 h-4 shrink-0 ${
                        country.riskLevel === 3
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    />
                  )}
                  <span
                    className={
                      country.riskLevel === 1
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : country.riskLevel === 2
                        ? 'text-slate-800 dark:text-slate-200'
                        : country.riskLevel === 3
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-red-700 dark:text-red-400'
                    }
                  >
                    {RISK_LABELS_PL[country.riskLevel].short}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {RISK_LABELS_PL[country.riskLevel].description}
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Szacowany koszt dzienny
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                  ${currentCostUsd} USD{' '}
                  <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                    (~{currentCostPln} PLN)
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  Backpacker: ${country.dailyCostUsd.budget} · Komfort: $
                  {country.dailyCostUsd.mid} · Premium: $
                  {country.dailyCostUsd.comfort}
                </div>
              </div>
            </div>

            {/* TOP LANDMARK PHOTOS GALLERY ("Zdjęcia najciekawszych miejsc w danym kraju") */}
            <div className="space-y-3 pb-6 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-[#122144] dark:text-sky-400" />
                    Najciekawsze miejsca i zabytki — {country.namePl}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kliknij wybrane zdjęcie, aby powiększyć opis i fotografię:
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => fetchCountryPhotos(country, true)}
                  disabled={isLoadingPhotos}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isLoadingPhotos ? 'animate-spin' : ''
                    }`}
                  />
                  {isLoadingPhotos ? 'Wczytuję...' : 'Odśwież miejsca'}
                </button>
              </div>

              {isLoadingPhotos ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="h-44 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {placesPhotos.map((place, idx) => {
                    const hasValidImg =
                      Boolean(place.imageUrl) &&
                      !failedImageUrls[place.imageUrl || ''];

                    return (
                      <div
                        key={idx}
                        onClick={() => setLightboxPlace(place)}
                        className="group cursor-pointer rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-col justify-between hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
                      >
                        <div className="relative h-36 w-full overflow-hidden bg-slate-900">
                          {hasValidImg && place.imageUrl ? (
                            <img
                              src={place.imageUrl}
                              alt={`${place.namePl} — ${country.namePl}`}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setFailedImageUrls((prev) => ({
                                  ...prev,
                                  [place.imageUrl!]: true,
                                }))
                              }
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            /* Zero-Broken-Image Policy Resilient Fallback */
                            <div className="w-full h-full bg-gradient-to-br from-[#122144] via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4 text-center">
                              <Landmark className="w-7 h-7 text-slate-300 mb-1.5 opacity-80" />
                              <span className="text-xs font-semibold text-white line-clamp-1">
                                {place.namePl}
                              </span>
                            </div>
                          )}

                          {/* Measured Scrim Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-end p-3">
                            <div className="text-[10px] text-slate-300 truncate">
                              {place.categoryPl}
                            </div>
                            <div className="text-xs font-bold text-white truncate">
                              {place.namePl}
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {place.descriptionPl}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Lightbox Preview for Selected Place */}
              {lightboxPlace && (
                <div className="p-4 bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lightboxPlace.categoryPl} · {country.namePl}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {lightboxPlace.namePl}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLightboxPlace(null)}
                      className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {lightboxPlace.imageUrl &&
                    !failedImageUrls[lightboxPlace.imageUrl] && (
                      <img
                        src={lightboxPlace.imageUrl}
                        alt={lightboxPlace.namePl}
                        referrerPolicy="no-referrer"
                        className="w-full max-h-72 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                    )}

                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    {lightboxPlace.descriptionPl}
                  </p>

                  {lightboxPlace.pageUrl && (
                    <a
                      href={lightboxPlace.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#122144] dark:text-sky-400 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Zobacz pełny artykuł i galerię w Wikipedii
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* LIVE WORLD NEWS SECTION ("Najnowsze wiadomości ze świata o kraju") */}
            <div className="space-y-3 pb-6 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-[#122144] dark:text-sky-400" />
                  Najnowsze wiadomości ze świata — {country.namePl}
                </h3>
                <button
                  type="button"
                  onClick={() => fetchCountryNews(country, true)}
                  disabled={isLoadingNews}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isLoadingNews ? 'animate-spin' : ''
                    }`}
                  />
                  {isLoadingNews ? 'Aktualizuję...' : 'Odśwież wiadomości'}
                </button>
              </div>

              {isLoadingNews ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-lg space-y-3 animate-pulse">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-11/12" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-4/5" />
                  </div>
                </div>
              ) : newsError ? (
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-2">
                  <p>{newsError}</p>
                  <button
                    type="button"
                    onClick={() => fetchCountryNews(country, true)}
                    className="px-3 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded text-xs font-medium hover:bg-amber-100"
                  >
                    Spróbuj ponownie
                  </button>
                </div>
              ) : newsData ? (
                <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-lg space-y-3">
                  {renderFormattedNews(newsData.summaryMarkdown)}

                  {newsData.sources.length > 0 && (
                    <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Źródła wiadomości (Google News RSS):
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {newsData.sources.map((src, idx) => (
                          <a
                            key={idx}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#122144] dark:text-sky-400 hover:underline max-w-[260px] truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Visa & Logistics Highlights */}
            <div className="space-y-4 pb-6 border-b border-slate-200/70 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Wymogi wizowe dla polskiego paszportu
                </h3>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                  {VISA_LABELS_PL[country.visaForPl].label}
                </p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  {country.visaNotePl}
                </p>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Kluczowe atrakcje i wskazówka logistyczna
                </h3>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {country.highlightsPl}
                </p>
              </div>
            </div>

            {/* Seasonality Calendar (12 Months) */}
            <div className="space-y-2.5 pb-6 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Kalendarz pogodowy — najlepsze miesiące na wyjazd
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Podświetlono optymalne okno sezonowe
                </span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                {MONTHS_PL.map((m) => {
                  const isBest = country.bestMonths.includes(m.id);
                  return (
                    <div
                      key={m.id}
                      className={`py-2 px-1 text-center rounded border text-xs font-medium ${
                        isBest
                          ? 'bg-[#122144] dark:bg-sky-600 text-white border-[#122144] dark:border-sky-500'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200/70 dark:border-slate-800'
                      }`}
                      title={`${m.full}: ${
                        isBest ? 'Optymalna pogoda' : 'Poza głównym sezonem'
                      }`}
                    >
                      {m.short}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CORE FEATURE: Pakietowe zwiedzanie ("Zwiedź przy okazji") */}
            <div className="space-y-4 pb-6 border-b border-slate-200/70 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-[#122144] dark:text-sky-400" />
                    Zwiedź przy okazji — kraje sąsiednie i bliskie logistycznie
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    Będąc w kraju <strong>{country.namePl}</strong>, możesz w
                    jednej podróży połączyć poniższe państwa lądem, promem lub
                    krótkim skokiem lotniczym:
                  </p>
                </div>

                {neighborCountries.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onBuildNeighborPackage(
                        country.code,
                        (unvisitedNeighbors.length > 0
                          ? unvisitedNeighbors
                          : neighborCountries
                        ).map((n) => n.code)
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Utwórz pakiet z sąsiadami (
                    {1 + (unvisitedNeighbors.length || neighborCountries.length)}
                    )
                  </button>
                )}
              </div>

              {cluster && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Należy do regionalnego klastra pakietowego:
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {cluster.namePl}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <Plane className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Hub: {cluster.gatewayHub}</span>
                      <span>·</span>
                      <span>{cluster.transportModePl}</span>
                    </div>
                  </div>
                </div>
              )}

              {neighborCountries.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Brak bezpośrednich sąsiadów w bazie.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
                  {neighborCountries.map((neighbor) => {
                    const nStatus =
                      userProgress[neighbor.code]?.status ?? 'UNVISITED';
                    const nInTrip = activeTripCodes.includes(neighbor.code);
                    const nCost =
                      neighbor.dailyCostUsd[travelStyle] ??
                      neighbor.dailyCostUsd.mid;
                    const sharedMonths = neighbor.bestMonths.filter((m) =>
                      country.bestMonths.includes(m)
                    );

                    return (
                      <div
                        key={neighbor.code}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectCountry(neighbor.code)}
                          className="flex items-center gap-3 text-left min-w-0 flex-1 group"
                        >
                          <CountryFlag code={neighbor.code} size="md" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:underline truncate">
                                {neighbor.namePl}
                              </span>
                              <span className="text-xs text-slate-400">·</span>
                              <span
                                className={`text-xs font-medium ${
                                  nStatus === 'VISITED'
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : nStatus === 'PLANNED'
                                    ? 'text-sky-700 dark:text-sky-400'
                                    : nStatus === 'WISHLIST'
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {nStatus === 'VISITED'
                                  ? 'Odwiedzony'
                                  : nStatus === 'PLANNED'
                                  ? 'W planach'
                                  : nStatus === 'WISHLIST'
                                  ? 'Marzenie'
                                  : 'Nieodwiedzony'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="font-mono tabular-nums">
                                ${nCost}/dzień
                              </span>
                              <span>·</span>
                              <span>
                                {VISA_LABELS_PL[neighbor.visaForPl].short}
                              </span>
                              <span>·</span>
                              <span>Ryzyko {neighbor.riskLevel}/4</span>
                              <span>·</span>
                              <span>
                                Wspólny sezon:{' '}
                                {sharedMonths.length > 0
                                  ? `${sharedMonths.length} mies.`
                                  : 'Różny'}
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onAddCountryToTrip(neighbor.code)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                              nInTrip
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {nInTrip ? 'W trasie ✓' : '+ Do trasy'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectCountry(neighbor.code)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md"
                            title={`Przejdź do: ${neighbor.namePl}`}
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Personal Notes & Visited Year */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Twoje prywatne notatki i dziennik ({country.namePl})
                </h3>
                <span className="text-xs text-slate-400">
                  Zapisywane automatycznie w pamięci przeglądarki
                </span>
              </div>

              {userData.status === 'VISITED' && (
                <div>
                  <label
                    htmlFor="visited-year-input"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Rok odwiedzenia
                  </label>
                  <input
                    id="visited-year-input"
                    type="number"
                    min={1950}
                    max={2040}
                    placeholder="np. 2024"
                    value={userData.visitedYear ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      onUpdateVisitedYear(
                        country.code,
                        val === '' ? undefined : Number(val)
                      );
                    }}
                    className="w-36 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#122144] dark:focus:ring-sky-500 font-mono tabular-nums"
                  />
                </div>
              )}

              <div>
                <textarea
                  rows={4}
                  value={userData.notes ?? ''}
                  onChange={(e) => onUpdateNotes(country.code, e.target.value)}
                  placeholder="Wpisz własne wskazówki, numery lotów, kontakty do lokalnych kierowców, wymagane szczepienia lub wrażenia z podróży..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#122144] dark:focus:ring-sky-500 leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
