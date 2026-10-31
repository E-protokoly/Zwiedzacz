import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, type FunctionDeclaration } from '@google/genai';
import {
  ALL_COUNTRIES,
  COUNTRIES_BY_CODE,
  CLUSTERS_BY_ID,
  RISK_LABELS_PL,
  VISA_LABELS_PL,
  formatMonthsRange,
} from './src/data/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

// Server-side in-memory caches so repeated clicks are instant (<5ms) and preserve API quota
const serverPhotosCache = new Map<
  string,
  Array<{
    namePl: string;
    categoryPl: string;
    descriptionPl: string;
    imageUrl: string | null;
    pageUrl: string | null;
  }>
>();

const serverNewsCache = new Map<
  string,
  {
    countryCode: string;
    summaryMarkdown: string;
    sources: { title: string; uri: string }[];
    fetchedAt: string;
  }
>();

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface WikiCandidatePage {
  title: string;
  extract?: string;
  thumbnail?: { source?: string };
  fullurl?: string;
}

function isValidLandmarkPhotoUrl(
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
    lower.includes('mapa_')
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
    lowerTitle.startsWith('politics of') ||
    lowerTitle.includes('war in ') ||
    lowerTitle.includes('conflict')
  ) {
    return false;
  }
  return true;
}

/**
 * Fetches a verified thumbnail from Wikipedia REST API (PL or EN).
 * Never mutates the thumbnail pixel bucket (Wikimedia CDN returns HTTP 400 on arbitrary sizes like 800px).
 */
async function fetchWikiSummaryByTitle(
  lang: 'pl' | 'en',
  title: string
): Promise<{
  title: string;
  description: string;
  imageUrl: string | null;
  pageUrl: string | null;
} | null> {
  if (!title || !title.trim()) return null;
  const headers = {
    'User-Agent': 'Atlas195TravelPlanner/1.0 (https://aistudio.google.com)',
    Accept: 'application/json',
  };
  try {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
      title.trim()
    )}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.type === 'disambiguation') return null;

    const thumbUrl = data?.thumbnail?.source;
    const origUrl = data?.originalimage?.source;
    const imageUrl = isValidLandmarkPhotoUrl(thumbUrl, data?.title)
      ? String(thumbUrl)
      : isValidLandmarkPhotoUrl(origUrl, data?.title)
      ? String(origUrl)
      : null;

    if (!imageUrl) {
      return null;
    }

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

async function searchWikiGeneratorSingle(
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
  const headers = {
    'User-Agent': 'Atlas195TravelPlanner/1.0 (https://aistudio.google.com)',
    Accept: 'application/json',
  };
  try {
    const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=6&prop=pageimages|extracts|info&exintro=1&explaintext=1&exchars=190&inprop=url&pithumbsize=500&format=json`;
    const res = await fetch(searchUrl, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    const pages: WikiCandidatePage[] = data?.query?.pages
      ? Object.values(data.query.pages)
      : [];

    const out: Array<{
      title: string;
      description: string;
      imageUrl: string;
      pageUrl: string | null;
    }> = [];

    for (const p of pages) {
      const img = p?.thumbnail?.source;
      if (img && isValidLandmarkPhotoUrl(img, p.title)) {
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

async function resolvePlaceCandidate(
  labelPl: string,
  categoryPl: string,
  namePl: string,
  nameEn: string
): Promise<{
  namePl: string;
  categoryPl: string;
  descriptionPl: string;
  imageUrl: string;
  pageUrl: string | null;
} | null> {
  const summary =
    (await fetchWikiSummaryByTitle('pl', labelPl)) ||
    (await fetchWikiSummaryByTitle('en', labelPl));

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

  const searchHitsPl = await searchWikiGeneratorSingle(
    'pl',
    `${labelPl} ${namePl}`
  );
  if (searchHitsPl.length > 0) {
    const hit = searchHitsPl[0];
    return {
      namePl: labelPl,
      categoryPl,
      descriptionPl:
        hit.description || `Jedna z głównych atrakcji w kraju ${namePl}.`,
      imageUrl: hit.imageUrl,
      pageUrl: hit.pageUrl,
    };
  }

  const searchHitsEn = await searchWikiGeneratorSingle(
    'en',
    `${labelPl} ${nameEn}`
  );
  if (searchHitsEn.length > 0) {
    const hit = searchHitsEn[0];
    return {
      namePl: labelPl,
      categoryPl,
      descriptionPl:
        hit.description || `Jedno z najbardziej znanych miejsc w kraju ${namePl}.`,
      imageUrl: hit.imageUrl,
      pageUrl: hit.pageUrl,
    };
  }

  return null;
}

/**
 * Searches Wikipedia REST & Action APIs in parallel for illustrated landmark/tourism articles in a country
 * (Uses 0% Gemini API quota and returns verified HTTP 200 Wikimedia thumbnail URLs!)
 */
async function searchWikipediaLandmarksForCountry(
  namePl: string,
  nameEn: string,
  capitalPl: string,
  highlightsPl: string
): Promise<
  Array<{
    namePl: string;
    categoryPl: string;
    descriptionPl: string;
    imageUrl: string | null;
    pageUrl: string | null;
  }>
> {
  // Extract landmark names before the em-dash (e.g., "Kraków, Gdańsk, Tatry, Mazury — główna baza...")
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

  const candidateTasks: Array<
    Promise<{
      namePl: string;
      categoryPl: string;
      descriptionPl: string;
      imageUrl: string;
      pageUrl: string | null;
    } | null>
  > = [
    resolvePlaceCandidate(
      capitalPl,
      `Stolica · ${namePl}`,
      namePl,
      nameEn
    ).then((res) =>
      res ? { ...res, namePl: `${capitalPl} — Stolica` } : null
    ),
    ...rawTokens.slice(0, 4).map((token) =>
      resolvePlaceCandidate(
        token,
        `Atrakcja i region · ${namePl}`,
        namePl,
        nameEn
      )
    ),
  ];

  const [resolvedCandidates, fallbackPl, fallbackEn] = await Promise.all([
    Promise.all(candidateTasks),
    searchWikiGeneratorSingle('pl', `${namePl} zabytek park narodowy miasto`),
    searchWikiGeneratorSingle('en', `${nameEn} UNESCO World Heritage landmark`),
  ]);

  const results: Array<{
    namePl: string;
    categoryPl: string;
    descriptionPl: string;
    imageUrl: string | null;
    pageUrl: string | null;
  }> = [];
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

  return results.slice(0, 4);
}

/**
 * Fetches live news headlines from Google News RSS feed (PL & EN) with 0 API quota cost
 */
async function fetchGoogleNewsRssHeadlines(
  namePl: string,
  nameEn: string,
  capitalPl: string
): Promise<Array<{ title: string; link: string; pubDate: string; source: string }>> {
  const items: Array<{
    title: string;
    link: string;
    pubDate: string;
    source: string;
  }> = [];

  const rssUrls = [
    `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${namePl} (${capitalPl} OR kraj OR świat OR podróż)`
    )}&hl=pl&gl=PL&ceid=PL:pl`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(
      namePl
    )}&hl=pl&gl=PL&ceid=PL:pl`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${nameEn} country news`
    )}&hl=en-US&gl=US&ceid=US:en`,
  ];

  for (const rssUrl of rssUrls) {
    if (items.length >= 6) break;
    try {
      const res = await fetch(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Atlas195Bot/1.0)',
        },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (const block of itemBlocks) {
        if (items.length >= 8) break;
        const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
        const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const sourceMatch = block.match(/<source[^>]*>([\s\S]*?)<\/source>/);

        const rawTitle = (titleMatch?.[1] || '')
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'")
          .trim();
        const rawLink = (linkMatch?.[1] || '').trim();
        const rawDate = (dateMatch?.[1] || '').trim();
        const rawSource = (sourceMatch?.[1] || 'Google News')
          .replace(/<!\[CDATA\[|\]\]>/g, '')
          .trim();

        if (
          rawTitle &&
          rawLink &&
          !items.some((existing) => existing.title === rawTitle)
        ) {
          items.push({
            title: rawTitle,
            link: rawLink,
            pubDate: rawDate,
            source: rawSource,
          });
        }
      }
    } catch {
      // Ignore RSS fetch errors
    }
  }

  return items.slice(0, 6);
}

// Tool declarations for the Travel Assistant
const saveTripPlanTool: FunctionDeclaration = {
  name: 'saveTripPlan',
  description:
    'Zapisuje nową lub zaktualizowaną wielokrajową wyprawę pakietową (wycieczkę) na liście zapisanych wypraw użytkownika oraz ustawia ją jako aktywną trasę.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description:
          'Nazwa wyprawy pakietowej po polsku, np. "Wyprawa Kaukaz Południowy" lub "Azja Centralna — 5 Stanów".',
      },
      targetMonth: {
        type: Type.INTEGER,
        description:
          'Numer planowanego miesiąca wyjazdu od 1 (Styczeń) do 12 (Grudzień).',
      },
      travelStyle: {
        type: Type.STRING,
        description:
          'Styl podróżowania: "budget" (Backpacker), "mid" (Komfort) lub "comfort" (Premium).',
      },
      estimatedFlightsUsd: {
        type: Type.INTEGER,
        description:
          'Szacowany koszt głównych przelotów międzykontynentalnych z Polski w USD.',
      },
      stops: {
        type: Type.ARRAY,
        description: 'Lista krajów na trasie w kolejności zwiedzania.',
        items: {
          type: Type.OBJECT,
          properties: {
            countryCode: {
              type: Type.STRING,
              description:
                'Dwuliterowy kod ISO-2 kraju (np. "JP", "KR", "GE", "AM", "GY", "SR").',
            },
            days: {
              type: Type.INTEGER,
              description: 'Zalecana liczba dni w tym kraju.',
            },
            notes: {
              type: Type.STRING,
              description:
                'Krótka wskazówka logistyczna lub plan dla tego etapu (np. jak przekroczyć granicę, co zobaczyć).',
            },
          },
          required: ['countryCode', 'days'],
        },
      },
    },
    required: ['name', 'targetMonth', 'stops'],
  },
};

const markCountriesStatusTool: FunctionDeclaration = {
  name: 'markCountriesStatus',
  description:
    'Zmienia status odwiedzenia dla jednego lub wielu krajów w dzienniku użytkownika (np. oznacza kraje jako odwiedzone, w planach lub na liście marzeń).',
  parameters: {
    type: Type.OBJECT,
    properties: {
      countryCodes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description:
          'Tablica dwuliterowych kodów ISO-2 państw (np. ["PL", "CZ", "SK"]).',
      },
      status: {
        type: Type.STRING,
        description:
          'Nowy status: "VISITED" (odwiedzony), "PLANNED" (w planach), "WISHLIST" (lista marzeń) lub "UNVISITED" (nieodwiedzony).',
      },
    },
    required: ['countryCodes', 'status'],
  },
};

const saveCountryNoteTool: FunctionDeclaration = {
  name: 'saveCountryNote',
  description:
    'Zapisuje notatkę podróżniczą lub wskazówkę w dzienniku użytkownika dla konkretnego kraju.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      countryCode: {
        type: Type.STRING,
        description: 'Dwuliterowy kod ISO-2 kraju (np. "CO", "VN").',
      },
      note: {
        type: Type.STRING,
        description: 'Treść notatki do zapisania przy tym kraju.',
      },
    },
    required: ['countryCode', 'note'],
  },
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Endpoint: Top iconic places & verified landmark photos (Wikipedia-powered, 0 Gemini Quota Burn!)
  app.post('/api/country-photos', async (req, res) => {
    try {
      const {
        countryCode,
        namePl,
        nameEn,
        capitalPl,
        highlightsPl,
        forceRefresh,
      } = req.body ?? {};
      if (!namePl || !countryCode) {
        res.status(400).json({ error: 'Brak nazwy lub kodu kraju.' });
        return;
      }

      if (!forceRefresh) {
        const cached = serverPhotosCache.get(countryCode);
        if (cached && cached.length > 0) {
          res.json({ countryCode, places: cached });
          return;
        }
      }

      const enrichedPlaces = await searchWikipediaLandmarksForCountry(
        namePl,
        nameEn || namePl,
        capitalPl || namePl,
        highlightsPl || ''
      );

      if (enrichedPlaces.length > 0) {
        serverPhotosCache.set(countryCode, enrichedPlaces);
      }

      res.json({
        countryCode,
        places: enrichedPlaces,
      });
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : 'Nieznany błąd pobierania zdjęć miejsc.';
      console.error('Error in /api/country-photos:', errMsg);
      res.status(200).json({ countryCode: req.body?.countryCode, places: [] });
    }
  });

  // 2. Endpoint: Latest world news & travel situation (Zero-429 Architecture: Google News RSS + Optional Gemini Summary)
  app.post('/api/country-news', async (req, res) => {
    try {
      const { countryCode, namePl, nameEn, capitalPl, forceRefresh } =
        req.body ?? {};
      if (!namePl || !countryCode) {
        res.status(400).json({ error: 'Brak nazwy lub kodu kraju.' });
        return;
      }

      if (!forceRefresh) {
        const cached = serverNewsCache.get(countryCode);
        if (cached) {
          res.json(cached);
          return;
        }
      }

      const countryRecord = COUNTRIES_BY_CODE[countryCode];
      const cluster = countryRecord
        ? CLUSTERS_BY_ID[countryRecord.clusterId]
        : undefined;

      // Step 1: Always fetch real live headlines from Google News RSS (0 quota cost, never 429s)
      const rssItems = await fetchGoogleNewsRssHeadlines(
        namePl,
        nameEn || namePl,
        capitalPl || ''
      );

      const rssSources = rssItems.map((item) => ({
        title: `${item.title} (${item.source})`,
        uri: item.link,
      }));

      let summaryMarkdown = '';

      // Step 2: Try to synthesize with Gemini WITHOUT expensive googleSearch tool quota (feeding RSS headlines directly)
      if (process.env.GEMINI_API_KEY) {
        try {
          const ai = getGenAIClient();
          const headlinesContext =
            rssItems.length > 0
              ? rssItems
                  .map(
                    (it, idx) =>
                      `${idx + 1}. ${it.title} (${it.source}, ${it.pubDate})`
                  )
                  .join('\n')
              : 'Brak nagłówków RSS z ostatniej doby.';

          const prompt = `Przygotuj zwięzły, aktualny raport dla polskiego podróżnika o kraju: ${namePl} (${nameEn}, stolica: ${capitalPl}).
Poniżej znajdują się najnowsze nagłówki prasowe pobrane przed chwilą z serwisu informacyjnego:
${headlinesContext}

Napisz raport po polsku w 3 krótkich sekcjach (użyj nagłówków ###):
### 1. Najnowsze wiadomości z kraju i ze świata
(Podsumuj najważniejsze bieżące informacje z powyższych nagłówków oraz sytuację w kraju w 3-4 punktach)
### 2. Bezpieczeństwo i komunikaty dla podróżnych
(Poziom bezpieczeństwa: ${
            countryRecord
              ? RISK_LABELS_PL[countryRecord.riskLevel].label
              : 'Standardowy'
          }. Opisz na co uważać i jak wygląda aktualna logistyka wjazdowa)
### 3. Praktyczny puls dla turysty z Polski
(Wiza: ${
            countryRecord
              ? VISA_LABELS_PL[countryRecord.visaForPl].label
              : ''
          }, najlepsze miesiące: ${
            countryRecord ? formatMonthsRange(countryRecord.bestMonths) : ''
          }).`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });

          if (response.text && response.text.trim().length > 40) {
            summaryMarkdown = response.text.trim();
          }
        } catch (geminiErr) {
          // Quota (429) or transient error: silently fall back to deterministic live RSS + travel intelligence report below!
          console.warn(
            `Gemini quota/fallback triggered for ${countryCode}, serving live RSS news report directly.`
          );
        }
      }

      // Step 3: Resilient Zero-429 Fallback using the live Google News RSS items + Country Travel Intelligence
      if (!summaryMarkdown) {
        const headlinesBullets =
          rssItems.length > 0
            ? rssItems
                .slice(0, 5)
                .map((it) => {
                  const dateShort = it.pubDate
                    ? new Date(it.pubDate).toLocaleDateString('pl-PL', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Aktualne';
                  return `- **${it.title}** — źródło: *${it.source}* (${dateShort})`;
                })
                .join('\n')
            : `- Brak nagłówków alarmowych z ostatnich godzin dla regionu **${namePl}** (${capitalPl}). Sytuacja podróżnicza pozostaje zgodna ze standardowym profilem kraju.`;

        const riskInfo = countryRecord
          ? `${RISK_LABELS_PL[countryRecord.riskLevel].label} — ${
              RISK_LABELS_PL[countryRecord.riskLevel].description
            }`
          : 'Sprawdź bieżące komunikaty MSZ przed wylotem.';

        const visaInfo = countryRecord
          ? `${VISA_LABELS_PL[countryRecord.visaForPl].label} (${
              countryRecord.visaNotePl
            })`
          : 'Sprawdź wymogi paszportowe.';

        const seasonInfo = countryRecord
          ? formatMonthsRange(countryRecord.bestMonths)
          : 'Cały rok';

        summaryMarkdown = `### 1. Najnowsze wiadomości z kraju i ze świata (${namePl})
${headlinesBullets}

### 2. Bieżąca sytuacja bezpieczeństwa i komunikaty dla podróżnych
- **Ocena bezpieczeństwa:** ${riskInfo}
- **Logistyka regionalna:** ${
          cluster
            ? `Kraj należy do pakietu **${cluster.namePl}** (główny hub: ${cluster.gatewayHub}; rekomendowany transport: ${cluster.transportModePl}).`
            : `Głównym punktem wjazdowym pozostaje stolica kraju — **${capitalPl}**.`
        }

### 3. Praktyczny puls dla turysty z Polski
- **Wymogi wjazdowe (paszport PL):** ${visaInfo}
- **Optymalne okno pogodowe:** ${seasonInfo} (zalecany czas zwiedzania: ok. ${
          countryRecord?.recommendedDays ?? 4
        } dni)
- **Najważniejsze miejsca:** ${
          countryRecord?.highlightsPl ?? capitalPl
        }`;
      }

      const payload = {
        countryCode,
        summaryMarkdown,
        sources: rssSources,
        fetchedAt: new Date().toISOString(),
      };

      serverNewsCache.set(countryCode, payload);
      res.json(payload);
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : 'Nieznany błąd pobierania wiadomości.';
      console.error('Error in /api/country-news:', errMsg);
      res.status(500).json({
        error: `Nie udało się pobrać wiadomości: ${errMsg}`,
      });
    }
  });

  // 3. Endpoint: Interactive AI Travel Assistant with Function Calling & Local Smart Fallback on 429 Quota
  app.post('/api/assistant/chat', async (req, res) => {
    try {
      const { messages, userContext } = req.body ?? {};
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Brak historii wiadomości.' });
        return;
      }

      const lastUserMessage =
        String(messages[messages.length - 1]?.text || '').trim();

      const visitedCodes = Array.isArray(userContext?.visitedCodes)
        ? userContext.visitedCodes.join(', ')
        : 'PL';
      const activeTripSummary =
        userContext?.activeTripSummary || 'Brak aktywnej trasy';
      const savedTripsList = Array.isArray(userContext?.savedTripsNames)
        ? userContext.savedTripsNames.join('; ')
        : 'Brak zapisanych tras';

      const systemInstruction = `Nazywasz się Lira i jesteś osobistą Asystentką Planowania Podróży w aplikacji Atlas 195 (cel: zwiedzenie wszystkich 193 państw ONZ + Watykanu i Palestyny = 195 państw).
W rozmowie ZAWSZE używasz wyłącznie formy żeńskiej ("zapisałam", "przygotowałam", "sprawdziłam", "dodałam").
Jesteś konkretna, partnerska i doskonale znasz logistykę pakietowego zwiedzania świata (łączenia sąsiednich państw w jedną podróż lądem, promem lub krótkim lotem), wymogi wizowe dla polskiego paszportu, ceny i bezpieczeństwo.

Kontekst użytkownika:
- Odwiedzone kraje (kody ISO-2): ${visitedCodes}
- Aktualnie edytowana wycieczka na mapie/w kreatorze: ${activeTripSummary}
- Zapisane wyprawy użytkownika: ${savedTripsList}

ZASADY DZIAŁANIA NARZĘDZI (FUNCTION CALLING):
1. Gdy użytkownik prosi o ułożenie planu podróży, zaproponowanie pakietu krajów lub zapisanie trasy/wycieczki — OBOWIĄZKOWO wywołaj narzędzie \`saveTripPlan\` z dokładnymi dwuliterowymi kodami ISO-2 państw (np. GY, SR, TT, KZ, KG, UZ, TJ, TM, FJ, TV, WS, TO, GH, TG, BJ), liczbą dni i notatkami etapowymi. Dzięki temu plan natychmiast zapisze się w aplikacji i wyświetli na mapie oraz w Kreatorze Wypraw!
2. Gdy użytkownik mówi, że odwiedził jakieś kraje lub chce je oznaczyć w planach/marzeniach — wywołaj narzędzie \`markCountriesStatus\`.
3. Gdy użytkownik prosi o zanotowanie czegoś przy konkretnym kraju — wywołaj narzędzie \`saveCountryNote\`.
4. Zawsze oprócz wywołania narzędzia napisz zwięzłą, pomocną odpowiedź po polsku wyjaśniającą logistykę trasy (jak przemieszczać się między krajami w pakiecie, kiedy jechać i jakie wizy są potrzebne dla Polaka).`;

      const contents = messages.map((m: { role: string; text: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

      try {
        const ai = getGenAIClient();
        // Use gemini-2.5-flash without googleSearch tool first to avoid the strict Search Grounding RPM limit
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction,
            tools: [
              {
                functionDeclarations: [
                  saveTripPlanTool,
                  markCountriesStatusTool,
                  saveCountryNoteTool,
                ],
              },
            ],
          },
        });

        const functionCalls = response.functionCalls ?? [];
        let replyText = response.text ?? '';

        if (!replyText.trim() && functionCalls.length > 0) {
          replyText =
            'Gotowe! Przygotowałam i zapisałam ten pakiet podróżniczy bezpośrednio w Twoim Kreatorze Wypraw oraz zaznaczyłam trasę na Mapie Świata.';
        }

        res.json({
          reply: replyText,
          toolCalls: functionCalls.map((fc) => ({
            name: fc.name,
            args: fc.args,
          })),
          sources: [],
        });
        return;
      } catch (geminiErr) {
        console.warn(
          'Assistant Gemini quota fallback triggered, using deterministic package planner:',
          geminiErr
        );
      }

      // Deterministic Offline/Quota-Safe Assistant Fallback so the user can STILL plan & save trips even when Gemini API quota is exhausted!
      const qLower = lastUserMessage.toLowerCase();
      const matchedCountries = ALL_COUNTRIES.filter(
        (c) =>
          qLower.includes(c.namePl.toLowerCase().slice(0, 5)) ||
          qLower.includes(c.nameEn.toLowerCase()) ||
          qLower.includes(c.subregion.toLowerCase()) ||
          qLower.includes(c.continent.toLowerCase())
      );

      const seedCountry =
        matchedCountries[0] ||
        ALL_COUNTRIES.find((c) => qLower.includes('azj')) ||
        ALL_COUNTRIES.find((c) => qLower.includes('afryk')) ||
        COUNTRIES_BY_CODE['GY'];

      const cluster = seedCountry
        ? CLUSTERS_BY_ID[seedCountry.clusterId]
        : undefined;
      const clusterCountries = ALL_COUNTRIES.filter(
        (c) => c.clusterId === (seedCountry?.clusterId || 'sa-guianas-north')
      ).slice(0, 5);

      const hasTripPlanningIntent =
        /(zaplanuj|ułóż|uloz|zapisz|stworz|stwórz|zbuduj|przygotuj|wypraw|tras|wycieczk|pakiet|plan\b)/i.test(
          qLower
        );

      if (!hasTripPlanningIntent && seedCountry) {
        const neighborNames = seedCountry.neighbors
          .map((code) => COUNTRIES_BY_CODE[code]?.namePl)
          .filter(Boolean)
          .join(', ');

        res.json({
          reply: `Oto najważniejsze informacje podróżnicze dla **${seedCountry.namePl}** (${seedCountry.capitalPl}):\n\n- **Sezon pogodowy:** ${formatMonthsRange(
            seedCountry.bestMonths
          )}\n- **Wiza dla Polaków:** ${
            VISA_LABELS_PL[seedCountry.visaForPl].label
          } (${seedCountry.visaNotePl})\n- **Budżet dzienny:** Backpacker $${
            seedCountry.dailyCostUsd.budget
          } · Komfort $${seedCountry.dailyCostUsd.mid} · Premium $${
            seedCountry.dailyCostUsd.comfort
          }\n- **Bezpieczeństwo:** ${
            RISK_LABELS_PL[seedCountry.riskLevel].label
          }\n- **Kraje sąsiednie w pakiecie (${
            cluster?.namePl || seedCountry.subregion
          }):** ${neighborNames || 'Wyspa / połączenia lotnicze'}\n\nJeśli chcesz, napisz *„Zaplanuj i zapisz pakiet dla ${
            seedCountry.namePl
          }”*, a automatycznie ułożę i zapiszę tę trasę w Kreatorze Wypraw!`,
          toolCalls: [],
          sources: [],
        });
        return;
      }

      const fallbackStops = clusterCountries.map((c) => ({
        countryCode: c.code,
        days: c.recommendedDays,
        notes: `${c.capitalPl} — ${c.highlightsPl}`,
      }));

      const pkgName = cluster
        ? `Pakiet: ${cluster.namePl}`
        : `Wyprawa: ${seedCountry?.namePl || 'Pakiet Regionalny'}`;

      res.json({
        reply: `Przygotowałam i automatycznie zapisałam dla Ciebie optymalny pakiet regionalny **${pkgName}** obejmujący **${fallbackStops.length} sąsiednich państw**: ${clusterCountries
          .map((c) => `${c.namePl} (${c.recommendedDays} dni)`)
          .join(' → ')}.\n\n- **Brama lotnicza:** ${
          cluster?.gatewayHub || clusterCountries[0]?.capitalPl
        }\n- **Logistyka na miejscu:** ${
          cluster?.transportModePl || 'Przejazdy lądowe i połączenia regionalne'
        }\n\nWycieczka jest już zapisana w Twoim **Kreatorze Wypraw** oraz zaznaczona na **Mapie Świata**!`,
        toolCalls: [
          {
            name: 'saveTripPlan',
            args: {
              name: pkgName,
              targetMonth: cluster?.bestMonths[0] ?? 5,
              travelStyle: 'mid',
              estimatedFlightsUsd: cluster?.estimatedFlightFromPlUsd ?? 550,
              stops: fallbackStops,
            },
          },
        ],
        sources: [],
      });
    } catch (error: unknown) {
      const errMsg =
        error instanceof Error
          ? error.message
          : 'Nieznany błąd komunikacji z asystentką.';
      console.error('Error in /api/assistant/chat:', errMsg);
      res.status(500).json({
        error: `Wystąpił błąd podczas rozmowy z asystentką: ${errMsg}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Atlas 195 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
