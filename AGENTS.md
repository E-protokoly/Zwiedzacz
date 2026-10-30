# AGENTS.md — Konstytucja Architektoniczna i Produktowa (Atlas 195)

Plik `/AGENTS.md` stanowi bezwzględne źródło prawdy dla rozwoju aplikacji **Atlas 195**. Każda zmiana w kodzie musi przejść walidację względem poniższych reguł UI/UX (Big Tech Enterprise), reguł funkcjonalnych oraz architektury wydajności.

---

## I. REGUŁY UI / UX — STANDARD „BIG TECH ENTERPRISE” (LINEAR / STRIPE / AIRBNB)

### 1. Zasada Stopniowego Odkrywania Danych (Progressive Disclosure)
- **Zakaz upychania wszystkiego w jednym wierszu:** Wiersz tabeli lub karta w katalogu może prezentować maksymalnie **4–5 kluczowych sygnałów** (Flaga + Nazwa Państwa, Kontynent/Klaster, Koszt dzienny, Poziom ryzyka, 1 główna akcja).
- **Zero powtarzalnych etykiet („Label Pollution”):** Zakaz powtarzania słów typu `Pakiet:`, `Sezon:`, `Zdjęcia i wiadomości`, `Stolica:` w każdym z 195 wierszy tabeli. Od tego jest nagłówek kolumny oraz panel szczegółów po kliknięciu wiersza.
- **Cały wiersz jest klikalny (`Row-as-Action`):** Kliknięcie dowolnego miejsca w wierszu otwiera szufladę szczegółów kraju (ze zdjęciami, wiadomościami, wizą, sezonem pogodowym i listą sąsiadów). Nie umieszczamy osobnych linków tekstowych „Zdjęcia i wiadomości” w każdym wierszu.

### 2. Prawdziwe Flagi Graficzne zamiast Emoji (`Windows Flag Fix`)
- System Windows nie obsługuje flag emoji Unicode (zamiast flag wyświetla dwuliterowe skróty `AF`, `AL`, `DZ`, co psuje czytelność).
- **Twarda reguła:** W całej aplikacji (tabela, karty, mapa, inspektor, kreator) używamy komponentu `<CountryFlag />` opartego o prawdziwe obrazy flag (`flagcdn.com`), a nie znaków tekstowych emoji.

### 3. Dyscyplina Gęstości i Oddechu (`Whitespace & Density Budget`)
- **Stała wysokość wiersza (`Single-Line Row Discipline`):** W tabeli każdy wiersz ma stałą, przewidywalną wysokość. Teksty nie mogą łamać się na 3–4 linie.
- **Sąsiedzi jako zwięzły licznik + podgląd:** W tabeli pokazujemy maksymalnie 2 sąsiadów z flagami w jednej linii + licznik `+X`, a pełną listę pakietową w inspektorze kraju.
- **Hierarchia typograficzna:**
  - Nazwa państwa: `14px font-semibold` (`text-slate-900 dark:text-slate-100`)
  - Stolica / podregion: `12px font-normal` (`text-slate-500 dark:text-slate-400`)
  - Liczby (ceny, dni, ryzyko, kolejność `#1–#195`): wyłącznie krój `font-mono tabular-nums`.

### 4. Redukcja Szumu Kolorystycznego (`Semantic Color Restraint`)
- Kolor w tabeli służy **wyłącznie do sygnalizacji wyjątków** (czerwony dla Ryzyka 4/4, bursztynowy dla Ryzyka 3/4 lub wymaganej wizy w ambasadzie, szmaragdowy dla już odwiedzonego kraju).
- Standardowe, bezpieczne wartości (Niskie ryzyko 1–2/4, Bezwizowo) mają stonowaną, neutralną kolorystykę.

### 5. Jeden Główny Pasek Sterowania (`Unified Command Bar`)
- Zakaz budowania wielopiętrowych ścian filtrów i przycisków nad tabelą.
- Wyszukiwarka + główne filtry mieszczą się w jednym, czystym pasku narzędziowym, a sortowanie odbywa się bezpośrednio przez nagłówki kolumn.

### 6. Dualizm Motywów i Kartografii (`True Dark Mode, Dark Map & PDF-First`)
- Tryb ciemny opiera się na głębokim kontraście powierzchni (`bg-slate-950` tło, `bg-slate-900` karty/tabele, `border-slate-800` cienkie linie podziału).
- **Synchronizacja Mapy z Motywem:** Przełączenie trybu ciemnego dynamicznie podmienia podkład kartograficzny Leaflet (`CartoDB Voyager` ⟷ `CartoDB Dark Matter`), aby jasna mapa nie oślepiała użytkownika w nocy.
- Dokumenty do druku (`Drukuj / PDF`) zawsze wymuszają białe tło i czarny tekst.

---

## II. REGUŁY FUNKCJONALNE I DOMENOWE (ATLAS 195 — PLANER PODRÓŻY)

### 1. Kompletność Bazy 195 Państw („Klub 195”)
- Aplikacja obsługuje dokładnie **195 państw** (193 państwa członkowskie ONZ + Watykan i Palestyna jako stali obserwatorzy).
- Każdy kraj posiada: kod ISO-2, stolicę, kontynent, podregion, przypisany klaster podróżniczy, 3 progi kosztowe (Backpacker / Komfort / Premium w USD i PLN), poziom ryzyka (1–4), wymogi wizowe dla polskiego paszportu, najlepsze miesiące pogodowe (1–12), rekomendowaną liczbę dni oraz macierz sąsiedztwa (`neighbors`).

### 2. Algorytm Optymalnej Trasy Przez Cały Świat (`5-Phase Masterplan 1 → 195`)
- **Zakaz losowego skakania po kontynentach:** Algorytm układa 195 państw w spójne wyprawy pakietowe (amortyzując koszt głównego biletu lotniczego przez kilka sąsiednich krajów).
- **5-Fazowa Hierarchia Kolejności:**
  - **Faza 1 (Start):** Bezpieczne (1/4), tanie i bezwizowe pakiety blisko Polski oraz w tanich regionach Azji/Kaukazu.
  - **Faza 2:** Bezpieczne (1–2/4) pakiety kontynentalne o średnim budżecie (Ameryka Łacińska, Azja Wschodnia, bezpieczna Afryka).
  - **Faza 3:** Bezpieczne (1–2/4), ale najdroższe kraje oraz odległe wyspy wymagające drogiego *Island Hoppingu* (Karaiby, Skandynawia, Australia, Oceania/Pacyfik).
  - **Faza 4:** Kraje o podwyższonym ryzyku (3/4) oraz trudnej logistyce wizowej w ambasadach (np. Afryka Zachodnia i Środkowa).
  - **Faza 5 (Na sam koniec):** Państwa o najwyższym ryzyku 4/4 (konflikty zbrojne, alerty MSZ) — zawsze odseparowane od zwykłych pakietów turystycznych i przesunięte na sam koniec planu.

### 3. Planowanie Pakietowe („Zwiedź przy okazji”)
- **Silnik Sąsiedztwa:** Wybór dowolnego kraju natychmiast wskazuje kraje sąsiednie lądowo lub połączone krótkim lotem regionalnym, które jeszcze nie zostały odwiedzone.
- **26 Klastrów Regionalnych:** Kraje są pogrupowane w logiczne pakiety geograficzne, które można wczytać jednym kliknięciem do Kreatora Wypraw lub na Mapę.

### 4. Jedno Źródło Prawdy Trasy (`Map ↔ Builder ↔ AI Sync`)
- Aktywna wycieczka (`tripStops`) jest współdzielona pomiędzy **Mapą Świata**, **Kreatorem Wypraw**, **Optymalną Trasą 195** oraz **Asystentką AI**.
- Dodanie kraju lub wczytanie etapu w dowolnym module natychmiast rysuje trasę (`polyline`) i podpowiedzi sąsiadów na Mapie Świata oraz przelicza budżet i walidację pogody/wiz w Kreatorze.

### 5. Inspektor Kraju: Zdjęcia + Najnowsze Wiadomości na Żywo
- Otwarcie dowolnego kraju prezentuje:
  1. **Galerię 4 najciekawszych miejsc i zabytków** (prawdziwe zdjęcia z Wikimedia/Wikipedia z podglądem Lightbox oraz bezpiecznym fallbackiem Zero-Broken-Image).
  2. **Najnowsze wiadomości ze świata i komunikaty dla podróżnych** pobierane na żywo przez Gemini z Google Search Grounding (z klikalnymi linkami źródłowymi).
  3. **Status odwiedzenia, rok podróży i prywatne notatki** zapisywane natychmiastowo.

### 6. Osobista Asystentka Podróży z Zapisem Planów (`Actionable AI Assistant`)
- Asystentka posiada narzędzia wykonawcze (`Function Calling`):
  - `saveTripPlan`: układa trasę pakietową i **automatycznie zapisuje ją** w Kreatorze Wypraw oraz na Mapie Świata.
  - `markCountriesStatus`: oznacza wybrane państwa jako odwiedzone / w planach / na liście marzeń.
  - `saveCountryNote`: dopisuje praktyczne wskazówki bezpośrednio do notatek danego kraju.

---

## III. ARCHITEKTURA WYDAJNOŚCI, CACHE I BEZPIECZEŃSTWA DANYCH

### 1. Dwuwarstwowy Cache dla AI i Multimediów (`Zero-Latency Reopen`)
- Wyniki zapytań `/api/country-news` oraz `/api/country-photos` są cache'owane w `sessionStorage` po kodzie ISO kraju (`countryCode`). Ponowne otwarcie tego samego kraju ładuje zdjęcia i wiadomości natychmiastowo (**<10ms**), bez ponownego odpytywania sieci. Odświeżenie z sieci następuje wyłącznie na jawne żądanie użytkownika (przycisk `Odśwież`).

### 2. Bezpieczeństwo Danych Użytkownika (`Zero Data Loss`)
- Każda zmiana statusu odwiedzenia, notatki, motywu (`Dark Mode`), aktywnej trasy czy rozmowy z asystentką zapisuje się synchronicznie w `localStorage`.
- Nadpisanie edytowanej trasy nowym klastrem lub etapem z Masterplanu jest chronione przez strażnika niezapisanych zmian (`UnsavedChangesModal`).
- Użytkownik ma w każdej chwili dostęp do pełnego eksportu i importu swoich danych w formacie `.json`.

### 3. Izolacja Błędów i Pancerne Formularze (`Zero-Freeze UI`)
- Każdy główny widok aplikacji jest odizolowany własnym komponentem `<ErrorBoundary isolateSection={true}>`.
- Wszystkie pola formularzy są w 100% kontrolowane (`value={field ?? ''}`), a wszystkie szuflady i modale renderują się przez `createPortal(..., document.body)`.
