import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Sparkles,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import {
  SavedTripPlan,
  TravelStyle,
  TripStop,
  UserCountryData,
  VisitStatus,
} from '../types/travel.ts';
import {
  ALL_COUNTRIES,
  COUNTRIES_BY_CODE,
  CLUSTERS_BY_ID,
  TRAVEL_CLUSTERS,
  RISK_LABELS_PL,
  VISA_LABELS_PL,
  formatMonthsRange,
} from '../data/index.ts';

interface AssistantApiResponse {
  reply: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
  }>;
  sources?: { title: string; uri: string }[];
}

function buildClientAssistantFallback(
  userMessage: string
): AssistantApiResponse {
  const qLower = userMessage.toLowerCase();

  const matchedClusterDirect = TRAVEL_CLUSTERS.find(
    (cl) =>
      qLower.includes(cl.namePl.toLowerCase()) ||
      (qLower.includes('azji centralnej') && cl.id === 'as-central-stans') ||
      (qLower.includes('afryki południowej') && cl.id === 'af-south-indian') ||
      (qLower.includes('pacyfik') && cl.id === 'oc-south-pacific') ||
      (qLower.includes('gujan') && cl.id === 'sa-guianas-north') ||
      (qLower.includes('kaukaz') && cl.id === 'as-caucasus') ||
      (qLower.includes('bałkan') && cl.id === 'eu-balkans') ||
      (qLower.includes('bałty') && cl.id === 'eu-central-baltic')
  );

  const matchedCountries = ALL_COUNTRIES.filter(
    (c) =>
      qLower.includes(c.namePl.toLowerCase().slice(0, 5)) ||
      qLower.includes(c.nameEn.toLowerCase()) ||
      qLower.includes(c.subregion.toLowerCase()) ||
      qLower.includes(c.continent.toLowerCase())
  );

  const seedCountry =
    matchedCountries[0] ||
    (matchedClusterDirect
      ? ALL_COUNTRIES.find((c) => c.clusterId === matchedClusterDirect.id)
      : undefined) ||
    ALL_COUNTRIES.find((c) => qLower.includes('azj')) ||
    ALL_COUNTRIES.find((c) => qLower.includes('afryk')) ||
    COUNTRIES_BY_CODE['GY'];

  const cluster =
    matchedClusterDirect ||
    (seedCountry ? CLUSTERS_BY_ID[seedCountry.clusterId] : undefined);

  const clusterCountries = ALL_COUNTRIES.filter(
    (c) => c.clusterId === (cluster?.id || seedCountry?.clusterId || 'sa-guianas-north')
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

    const clusterListText =
      clusterCountries.length > 1
        ? clusterCountries
            .map(
              (c) =>
                `**${c.namePl}** (${VISA_LABELS_PL[c.visaForPl].short}, ~$${c.dailyCostUsd.mid}/dzień)`
            )
            .join(', ')
        : neighborNames || 'Wyspa / połączenia lotnicze';

    return {
      reply: `Oto najważniejsze informacje podróżnicze dla regionu **${
        cluster?.namePl || seedCountry.namePl
      }** (punkt bazowy: **${seedCountry.namePl}**, stolica: ${
        seedCountry.capitalPl
      }):\n\n- **Państwa w pakiecie regionalnym:** ${clusterListText}\n- **Sezon pogodowy:** ${formatMonthsRange(
        seedCountry.bestMonths
      )}\n- **Wiza dla Polaków (${seedCountry.namePl}):** ${
        VISA_LABELS_PL[seedCountry.visaForPl].label
      } (${seedCountry.visaNotePl})\n- **Budżet dzienny:** Backpacker $${
        seedCountry.dailyCostUsd.budget
      } · Komfort $${seedCountry.dailyCostUsd.mid} · Premium $${
        seedCountry.dailyCostUsd.comfort
      }\n- **Bezpieczeństwo:** ${
        RISK_LABELS_PL[seedCountry.riskLevel].label
      }\n- **Sąsiedzi do połączenia w jedną podróż:** ${
        neighborNames || 'Połączenia regionalne z głównego hubu'
      }\n\nJeśli chcesz, napisz *„Zaplanuj i zapisz pakiet dla ${
        cluster?.namePl || seedCountry.namePl
      }”*, a automatycznie ułożę i zapiszę tę trasę w Kreatorze Wypraw oraz na Mapie Świata!`,
      toolCalls: [],
      sources: [],
    };
  }

  const fallbackStops = clusterCountries.map((c) => ({
    countryCode: c.code,
    days: c.recommendedDays,
    notes: `${c.capitalPl} — ${c.highlightsPl}`,
  }));

  const pkgName = cluster
    ? `Pakiet: ${cluster.namePl}`
    : `Wyprawa: ${seedCountry?.namePl || 'Pakiet Regionalny'}`;

  return {
    reply: `Przygotowałam i automatycznie zapisałam dla Ciebie optymalny pakiet regionalny **${pkgName}** obejmujący **${
      fallbackStops.length
    } sąsiednich państw**: ${clusterCountries
      .map((c) => `${c.namePl} (${c.recommendedDays} dni)`)
      .join(' → ')}.\n\n- **Brama lotnicza:** ${
      cluster?.gatewayHub || clusterCountries[0]?.capitalPl
    }\n- **Logistyka na miejscu:** ${
      cluster?.transportModePl || 'Przejazdy lądowe i połączenia regionalne'
    }\n- **Najlepsze miesiące:** ${
      cluster ? formatMonthsRange(cluster.bestMonths) : 'Cały rok'
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
  };
}

interface ExecutedActionSummary {
  type: 'saveTripPlan' | 'markCountriesStatus' | 'saveCountryNote';
  title: string;
  details: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: ExecutedActionSummary[];
  sources?: { title: string; uri: string }[];
  timestamp: string;
}

const CHAT_STORAGE_KEY = 'atlas195_assistant_chat_v1';

const INITIAL_GREETING: ChatMessage = {
  id: 'welcome-msg',
  role: 'assistant',
  text: 'Cześć! Jestem Twoją osobistą asystentką planowania podróży do wszystkich 195 państw świata. Powiedz mi, jaki region, budżet lub termin Cię interesuje — ułożę dla Ciebie optymalny pakiet sąsiednich krajów i od razu zapiszę naszą wycieczkę w Twoim planerze oraz na mapie!',
  timestamp: new Date().toISOString(),
};

interface TravelAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userProgress: Record<string, UserCountryData>;
  activeStops: TripStop[];
  activeTripName: string;
  savedTrips: SavedTripPlan[];
  onSaveTripFromAssistant: (
    name: string,
    targetMonth: number,
    travelStyle: TravelStyle,
    estimatedFlightsUsd: number,
    stops: TripStop[]
  ) => void;
  onMarkCountriesFromAssistant: (codes: string[], status: VisitStatus) => void;
  onSaveCountryNoteFromAssistant: (code: string, note: string) => void;
  onNavigateToTab: (tab: 'map' | 'builder' | 'catalog' | 'clusters') => void;
}

export const TravelAssistantDrawer: React.FC<TravelAssistantDrawerProps> = ({
  isOpen,
  onClose,
  userProgress,
  activeStops,
  activeTripName,
  savedTrips,
  onSaveTripFromAssistant,
  onMarkCountriesFromAssistant,
  onSaveCountryNoteFromAssistant,
  onNavigateToTab,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return [INITIAL_GREETING];
  });

  const [inputValue, setInputValue] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore quota
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt ?? inputValue).trim();
    if (!textToSend || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    if (!customPrompt) setInputValue('');
    setIsSending(true);

    try {
      const visitedCodes = Object.entries(userProgress)
        .filter(([, data]) => data.status === 'VISITED')
        .map(([code]) => code);

      const activeTripSummary =
        activeStops.length > 0
          ? `${activeTripName}: ${activeStops
              .map((s) => `${s.countryCode} (${s.days}d)`)
              .join(' -> ')}`
          : 'Brak aktywnej trasy';

      const savedTripsNames = savedTrips.map(
        (t) => `${t.name} (${t.stops.map((s) => s.countryCode).join(',')})`
      );

      let data: AssistantApiResponse | null = null;

      try {
        const response = await fetch('/api/assistant/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedHistory.slice(-12).map((m) => ({
              role: m.role,
              text: m.text,
            })),
            userContext: {
              visitedCodes,
              activeTripSummary,
              savedTripsNames,
            },
          }),
        });

        if (response.ok) {
          const parsed = await response.json();
          if (parsed && typeof parsed.reply === 'string') {
            data = parsed;
          }
        }
      } catch {
        // Static hosting (GitHub Pages) — fall back to client-side deterministic travel assistant
      }

      if (!data) {
        data = buildClientAssistantFallback(textToSend);
      }

      const executedActions: ExecutedActionSummary[] = [];
      const toolCalls = Array.isArray(data.toolCalls) ? data.toolCalls : [];

      for (const tc of toolCalls) {
        if (tc.name === 'saveTripPlan' && tc.args) {
          const rawStops = Array.isArray(tc.args.stops) ? tc.args.stops : [];
          const validStops: TripStop[] = rawStops
            .map(
              (s: {
                countryCode?: string;
                days?: number;
                notes?: string;
              }) => {
                const code = String(s.countryCode ?? '')
                  .toUpperCase()
                  .trim();
                const country = COUNTRIES_BY_CODE[code];
                if (!country) return null;
                return {
                  countryCode: code,
                  days: Math.max(
                    1,
                    Number(s.days) || country.recommendedDays || 3
                  ),
                  notes: String(s.notes ?? ''),
                };
              }
            )
            .filter((s: TripStop | null): s is TripStop => Boolean(s));

          if (validStops.length > 0) {
            const name =
              String(tc.args.name || '').trim() ||
              `Wyprawa (${validStops.length} państw)`;
            const month = Math.min(
              12,
              Math.max(1, Number(tc.args.targetMonth) || 5)
            );
            const style: TravelStyle =
              tc.args.travelStyle === 'budget' ||
              tc.args.travelStyle === 'comfort'
                ? tc.args.travelStyle
                : 'mid';
            const flightsUsd = Math.max(
              0,
              Number(tc.args.estimatedFlightsUsd) || 550
            );

            onSaveTripFromAssistant(
              name,
              month,
              style,
              flightsUsd,
              validStops
            );

            const namesList = validStops
              .map((s) => COUNTRIES_BY_CODE[s.countryCode]?.namePl ?? s.countryCode)
              .join(' → ');

            executedActions.push({
              type: 'saveTripPlan',
              title: `Zapisano wycieczkę: ${name}`,
              details: `${validStops.length} państw: ${namesList}`,
            });
          }
        } else if (tc.name === 'markCountriesStatus' && tc.args) {
          const codes = (
            Array.isArray(tc.args.countryCodes) ? tc.args.countryCodes : []
          )
            .map((c: unknown) => String(c).toUpperCase().trim())
            .filter((code: string) => Boolean(COUNTRIES_BY_CODE[code]));

          const statusRaw = String(tc.args.status || 'VISITED').toUpperCase();
          const status: VisitStatus =
            statusRaw === 'PLANNED' ||
            statusRaw === 'WISHLIST' ||
            statusRaw === 'UNVISITED'
              ? statusRaw
              : 'VISITED';

          if (codes.length > 0) {
            onMarkCountriesFromAssistant(codes, status);
            executedActions.push({
              type: 'markCountriesStatus',
              title: `Zaktualizowano status (${status})`,
              details: codes
                .map((c: string) => COUNTRIES_BY_CODE[c]?.namePl ?? c)
                .join(', '),
            });
          }
        } else if (tc.name === 'saveCountryNote' && tc.args) {
          const code = String(tc.args.countryCode ?? '')
            .toUpperCase()
            .trim();
          const note = String(tc.args.note ?? '').trim();
          const country = COUNTRIES_BY_CODE[code];
          if (country && note) {
            onSaveCountryNoteFromAssistant(code, note);
            executedActions.push({
              type: 'saveCountryNote',
              title: `Zapisano notatkę: ${country.namePl}`,
              details: note,
            });
          }
        }
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text:
          data.reply ||
          'Gotowe! Zapisałam zmiany w Twoim planerze podróży.',
        actions: executedActions.length > 0 ? executedActions : undefined,
        sources: Array.isArray(data.sources) ? data.sources : undefined,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Wystąpił problem z połączeniem.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: `Przepraszam, wystąpił błąd podczas przetwarzania: ${errMsg}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const quickPrompts = [
    'Zaplanuj i zapisz mi pakiet: Gujana, Surinam i Trynidad',
    'Ułóż i zapisz 14-dniową trasę po 5 krajach Azji Centralnej',
    'Które bezpieczne kraje Afryki Południowej połączę w jedną podróż bez wizy?',
    'Zaplanuj i zapisz wycieczkę po wyspach Pacyfiku z bazą na Fidżi',
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-lg h-full border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#122144] dark:bg-sky-600 text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                Asystentka Podróży — Planowanie i Zapisywanie Tras
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Układa pakiety sąsiednich państw i automatycznie zapisuje Wasze plany
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setMessages([INITIAL_GREETING])}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-colors"
              title="Wyczyść historię rozmowy"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
              aria-label="Zamknij asystentkę"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/60 dark:bg-slate-950/60">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[90%] rounded-xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#122144] dark:bg-sky-600 text-white'
                    : 'bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Executed Tool Actions Confirmation Cards */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    {msg.actions.map((act, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-lg text-emerald-950 dark:text-emerald-200 space-y-1.5"
                      >
                        <div className="font-bold flex items-center gap-1.5 text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{act.title}</span>
                        </div>
                        <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
                          {act.details}
                        </div>
                        {act.type === 'saveTripPlan' && (
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToTab('map');
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded text-[11px] font-semibold text-slate-900 dark:text-slate-100 hover:bg-emerald-100 dark:hover:bg-slate-700"
                            >
                              <MapPin className="w-3 h-3" />
                              Pokaż na Mapie
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onNavigateToTab('builder');
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#122144] dark:bg-sky-600 text-white rounded text-[11px] font-semibold hover:bg-slate-800 dark:hover:bg-sky-500"
                            >
                              <span>Otwórz w Kreatorze</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Grounding Sources if any */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                    {msg.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline max-w-[200px] truncate"
                      >
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{src.title}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex items-start">
              <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#122144] dark:bg-sky-500 animate-ping" />
                <span>Analizuję połączenia i zapisuję plan podróży...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Starter Prompts & Input Form */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
          {messages.length <= 2 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Przykładowe polecenia (kliknij, aby wysłać):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(p)}
                    disabled={isSending}
                    className="text-left px-2.5 py-1.5 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue ?? ''}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Napisz dokąd chcesz jechać lub poproś o zapisanie planu..."
              disabled={isSending}
              className="flex-1 px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#122144]"
            />
            <button
              type="submit"
              disabled={isSending || !inputValue.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 disabled:opacity-40 rounded-lg transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Wyślij</span>
            </button>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
