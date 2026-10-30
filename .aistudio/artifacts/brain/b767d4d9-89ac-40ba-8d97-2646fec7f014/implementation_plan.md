# Atlas 195 — System Planowania Podróży do Wszystkich Państw Świata

Kompleksowa aplikacja webowa dla podróżników realizujących cel odwiedzenia wszystkich 195 państw świata (193 członków ONZ oraz Watykan i Palestyna). Łączy kompletną bazę analityczną państw (koszty, poziom bezpieczeństwa, wizy dla obywateli RP, sezonowość) z silnikiem planowania pakietowego oraz interaktywnym kreatorem tras wielokrajowych.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> Poniższe decyzje architektoniczne i produktowe zostały zatwierdzone na podstawie Twoich odpowiedzi i zasad projektowych:

- **Potwierdzony zakres państw (195)**: Pełna lista 193 państw członkowskich ONZ oraz 2 państwa-obserwatorzy (Watykan i Palestyna), pogrupowana według kontynentów i naturalnych subkregionów logistycznych.
- **Potwierdzony silnik pakietowy (Klastry + Kreator Tras)**: Gotowe, zoptymalizowane pakiety podróżnicze (np. *Guianas Trio*, *Stan-Hopping w Azji Centralnej*, *Wschodnioafrykańska Pętla*, *Małe Antyle*, *Kaukaz Południowy*, *Mikropaństwa Europy*) oraz dynamiczny panel sąsiedztwa lądowego/lotniczego, który po kliknięciu dowolnego kraju natychmiast podpowiada, jakie państwa warto połączyć w jedną podróż.
- **Potwierdzone atrybuty analityczne dla polskiego podróżnika**: Wymogi wizowe dla polskiego paszportu (ruch bezwizowy / dowód osobisty, e-Visa / Visa on Arrival, wymagana wiza w ambasadzie), szacowany dzienny budżet (USD/PLN), poziom ryzyka bezpieczeństwa (1–4), najlepsze miesiące pod kątem pogody, status odwiedzenia (*Odwiedzone*, *Zaplanowane*, *Lista marzeń*, *Nieodwiedzone*) oraz prywatne notatki.
- **Weto Architektoniczne (Active Simplification Veto)**: Zamiast budować ciężki algorytm grafowy oparty o zewnętrzne, płatne API biletów lotniczych (które często blokują zapytania lub zwracają nieaktualne ceny), zastosujemy deterministyczną macierz klastrów logistycznych, granic lądowych i węzłów przesiadkowych (hubów) z możliwością ręcznego dostrajania liczby dni w kreatorze wypraw. Daje to natychmiastowe działanie (<10ms), 100% niezawodności offline i pełną kontrolę nad budżetem.

---

## 1. Overview & Core Concept

- **Co robi aplikacja**: Pozwala przeglądać, filtrować i sortować wszystkie 195 państw świata według nazwy, dziennego kosztu podróży, poziomu ryzyka, wymogów wizowych dla obywateli Polski i optymalnego sezonu, a także planować wielokrajowe wyprawy pakietowe i śledzić postęp w drodze do „Klubu 195”.
- **Grupa docelowa**: Świadomi podróżnicy (Country Collectors / Nomadzi) dążący do odwiedzenia każdego kraju świata w sposób zoptymalizowany czasowo, finansowo i logistycznie.
- **Główna wartość**: Rozwiązuje najtrudniejszy problem w odwiedzaniu 195 państw — logistykę odległych lub kosztownych regionów — poprzez grupowanie państw w logiczne pakiety („skoro lecę 12 godzin w ten rejon, które 3–5 sąsiednich państw mogę zwiedzić za jednym razem?”).

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Eksploracja i Sortowanie Katalogu 195 Państw**: Użytkownik przełącza się między widokiem **Tabeli Analitycznej** a widokiem **Kafelków (Bento)**, filtruje kraje po kontynencie, statusie odwiedzenia, wymogach wizowych (PL), poziomie ryzyka, budżecie dziennym lub wybranym miesiącu podróży, oraz sortuje wyniki rosnąco/malejąco.
2. **Inspekcja Kraju i Sąsiedztwa („Zwiedź przy okazji”)**: Kliknięcie dowolnego kraju otwiera szczegółowy panel inspektora z informacjami o bezpieczeństwie, wizie dla Polaków, walucie, najlepszych miesiącach, polach na własne notatki oraz sekcją **„Połącz w pakiet (Sąsiedzi i klastry)”** — skąd jednym kliknięciem można dodać sąsiednie kraje do wspólnej trasy.
3. **Gotowe Klastry Regionalne**: Widok prezentujący wyselekcjonowane pakiety podróżnicze (np. *3 Gujany + Surinam*, *5 krajów Azji Centralnej*, *Zatoka Gwinejska*, *Wyspy Pacyfiku*, *Bałkany Zachodnie*) ze wskaźnikiem postępu użytkownika w danym klastrze (np. `2 / 5 odwiedzonych`) i przyciskiem wczytania całego pakietu do Kreatora Tras.
4. **Kreator Wypraw Pakietowych (Trip Builder)**: Interaktywny warsztat, w którym użytkownik układa kolejność krajów w ramach jednej podróży, określa liczbę dni w każdym kraju, wybiera styl podróżowania (*Backpacker*, *Komfort / Średni*, *Premium*), sprawdza ostrzeżenia sezonowe (czy wybrany miesiąc pasuje do wszystkich krajów w pakiecie) oraz widzi łączny koszt, czas trwania i listę potrzebnych wiz. Zapisane wyprawy trafiają do zakładki *Moje Wyprawy* z ochroną przed utratą danych.

### Visual Identity & Theme
- **Aesthetic Direction**: *Login Luxury & Desktop Calm / Editorial Cartographic SaaS* — czyste, płaskie płótno bez zagnieżdżonych „kartonów w kartonach”, cienkie linie podziału (`border-slate-200/70`), wysoka czytelność danych tabelarycznych i wyrafinowana hierarchia typograficzna.
- **Color Palette & Mood (60-30-10)**:
  - **60% Dominant Canvas**: Chłodna, papierowa biel `#F8FAFC` (`bg-slate-50`) i czysta powierzchnia robocza `#FFFFFF` (`bg-white`).
  - **30% Structural Surfaces & Typography**: Głęboki grafit `#0F172A` (`text-slate-900`) dla nagłówków, `#475569` (`text-slate-600`) dla metadanych, subtelne obramowania `#E2E8F0` (`border-slate-200`).
  - **10% Primary & Semantic Accents**: Granatowy akcent głównych akcji `#122144` (`bg-[#122144]`), szmaragdowy `#16A34A` dla bezpiecznych krajów / statusu odwiedzonego, bursztynowy `#D97706` dla podwyższonej ostrożności, karmazynowy `#DC2626` dla wysokiego ryzyka.
- **Typography & Hierarchy (2+1 Font Rule)**:
  - *Display / Headings*: `Plus Jakarta Sans` (SemiBold/Bold, `text-wrap: balance`).
  - *Body & UI Controls*: `DM Sans` dla czytelności gęstych opisów i formularzy.
  - *Numeric & Tabular Data*: `JetBrains Mono` z `tabular-nums` dla kosztów dziennych, indeksów ryzyka, liczników `195` i kalkulacji budżetowych.
- **Zero-Pill Metadata Discipline**: Metadane na kartach i w wierszach tabeli (subregion, wiza, sezon) prezentowane jako czysty, nieobramowany tekst rozdzielony separatorami typograficznymi (`·` oraz `/`), bez krzykliwych kolorowych pigułek.

### Interactive Feedback & Motion
- Natychmiastowa reakcja filtrów i sortowania (<50ms) na pełnym zbiorze 195 państw.
- Automatyczny zapis postępów, notatek i budowanych tras w `localStorage` z obsługą eksportu/importu pliku JSON.
- Strażnik niezapisanych zmian podczas edycji wielokrajowej wyprawy w kreatorze.

---

## 3. Key Product Decisions & Trade-Offs

- **Decyzja 1: Kompletna, wbudowana baza 195 państw z danymi dla polskiego paszportu**
  - *Wybrane podejście*: Lokalny, silnie typowany rejestr wszystkich 195 państw zawierający polskie nazwy, kody ISO, flagi, kontynenty, subregiony, poziom ryzyka (1–4), średni koszt dzienny w 3 standardach, wymóg wizowy dla obywateli RP, najlepsze miesiące w roku (1–12), kody sąsiadów oraz przypisanie do klastrów pakietowych.
  - *Dlaczego*: Gwarantuje błyskawiczne sortowanie i filtrowanie po dowolnym parametrze bez opóźnień sieciowych i bez limitów zewnętrznych API.
- **Decyzja 2: Kalkulator Kompatybilności Sezonowej i Wizowej w Kreatorze Pakietów**
  - *Wybrane podejście*: Gdy użytkownik łączy kilka sąsiednich państw w jedną trasę i wybiera miesiąc wyjazdu (np. Listopad), kreator automatycznie podświetla, czy każdy kraj w pakiecie ma w tym miesiącu dobre warunki pogodowe oraz wylicza, ile wiz trzeba wyrobić przed wyjazdem.
  - *Dlaczego*: Łączenie sąsiednich krajów często rozbija się o porę deszczową lub konieczność uzyskania wizy w ambasadzie przed wyjazdem — automatyczna walidacja eliminuje błędy planistyczne.
- **Decyzja 3: Trwałość danych (Zero Data Loss)**
  - *Wybrane podejście*: Synchronizacja stanu odwiedzonych państw, notatek osobistych oraz zapisanych wypraw w `localStorage` + możliwość pobrania i wgrania pełnej kopii zapasowej JSON.
  - *Dlaczego*: Pozwala od razu korzystać z aplikacji bez wymogu zakładania konta, chroniąc jednocześnie wieloletni dziennik podróży użytkownika.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     TOP BAR & PAGE HEADER TOOLBAR                          │
│  Brand: Atlas 195   │  Nawigacja: Katalog · Klastry · Kreator · Statystyki │
│  Breadcrumbs + Licznik Postępu (X / 195) + Przełącznik Tabela / Kafelki    │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  1. KATALOG KRAJÓW  │     │ 2. KLASTRY PAKIETOWE│     │  3. KREATOR WYPRAW  │
│  (195 Państw ONZ+)  │     │ (Regiony & Sąsiedzi)│     │   (Trip Builder)    │
├─────────────────────┤     ├─────────────────────┤     ├─────────────────────┤
│ • Wyszukiwarka live │     │ • 28 gotowych       │     │ • Kolejka krajów    │
│ • Filtry: Kontynent,│     │   pakietów bliskich │     │   z liczbą dni      │
│   Status, Ryzyko,   │     │   krajów            │     │ • Wybór standardu   │
│   Wiza PL, Miesiąc  │     │ • Pokrycie pakietu  │     │   (Backpacker/Komf) │
│ • Sortowanie wielo- │     │   (% odwiedzonych)  │     │ • Walidator pogody  │
│   kryterialne       │     │ • 1-klik: "Załaduj  │     │   i wiz PL          │
│ • Widok: Tabela /   │     │   nieodwiedzone do  │     │ • Kalkulator kosztu │
│   Kafelki           │     │   Kreatora Tras"    │     │   i zapisanych tras │
└──────────┬──────────┘     └──────────┬──────────┘     └──────────┬──────────┘
           │                           │                           │
           └───────────────────────────┼───────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             INSPEKTOR KRAJU I SĄSIEDZTWA (Slide-over / Modal)              │
│ • Zmiana statusu (Odwiedzony / Zaplanowany / Marzenie) + Notatnik          │
│ • Macierz "Zwiedź przy okazji": Kraje graniczne i bliskie lotniczo         │
│ • Szybkie akcje: "Dodaj do aktywnej wyprawy" / "Utwórz pakiet z sąsiadami" │
└──────────────────────────────────────┬─────────────────────────────────────┘
                                       ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                SILNIK DANYCH I STANU (Zero-Freeze Storage)                 │
│ • Rejestr 195 Państw (Koszty, Ryzyko 1-4, Wizy PL, Miesiące 1-12, Sąsiedzi)│
│ • Persystencja localStorage (Statusy, Notatki, Zapisane Trasy, Eksport JSON)│
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **`CountryRecord` (195 rekordów)**:
  - `code`: Kod ISO-2 (np. `PL`, `JP`, `GY`, `VA`, `PS`)
  - `namePl` / `nameEn`: Pełna polska i angielska nazwa kraju + stolica
  - `unStatus`: `'UN_MEMBER'` (193) | `'UN_OBSERVER'` (2: Watykan, Palestyna)
  - `continent` & `subregion`: Kontynent oraz klaster geograficzny
  - `riskLevel`: `1` (Bardzo bezpiecznie), `2` (Umiarkowane / Standardowa ostrożność), `3` (Podwyższone ryzyko), `4` (Wysokie ryzyko / Ostrzeżenie MSZ)
  - `dailyCostUsd`: Obiekt `{ budget: number, mid: number, comfort: number }` (wraz z przelicznikiem na PLN)
  - `visaForPl`: `'VISA_FREE'` (Bezwizowo / Dowód), `'EVISA_VOA'` (e-Wiza / Na lotnisku), `'EMBASSY_VISA'` (Wiza tradycyjna)
  - `bestMonths`: Tablica numerów miesięcy `1..12` optymalnych pogodowo
  - `neighbors`: Tablica kodów ISO krajów sąsiednich (lądowych i bliskich morskich/lotniczych) do rekomendacji „przy okazji”
  - `clusterId`: Identyfikator gotowego pakietu podróżniczego
- **`UserCountryState`**:
  - `status`: `'VISITED' | 'PLANNED' | 'WISHLIST' | 'UNVISITED'`
  - `visitedYear`: Opcjonalny rok odwiedzin
  - `notes`: Własne notatki podróżnika
- **`TripPlan` (Pakietowa Wyprawa)**:
  - `id`, `title`, `targetMonth` (1–12), `travelStyle` (`'budget' | 'mid' | 'comfort'`), `estimatedFlightsUsd`
  - `stops`: Lista `{ countryCode, days, customDailyUsd?, notes? }`

### Interactive Component & State Mapping
- **Pasek narzędzi i filtrów**: Każda zmiana kryterium sortowania (Nazwa A–Z, Koszt dzienny rosnąco/malejąco, Poziom ryzyka, Liczba sąsiadów w pakiecie) lub filtru (Kontynent, Status, Wiza PL, Miesiąc wyjazdu) natychmiast przelicza widok tabeli/kafelków.
- **Akcje pakietowe („Zwiedź przy okazji”)**: W karcie szczegółów każdego kraju widoczna jest lista bezpośrednich sąsiadów z oznaczeniem ich statusu odwiedzenia, kosztu dziennego i wymogu wizowego oraz przyciskiem **„Zbuduj pakiet z tym krajem i sąsiadami”**, który automatycznie przenosi użytkownika do Kreatora Wypraw z gotową trasą.
- **Zarządzanie postępem**: Kliknięcie statusu kraju w tabeli, na kafelku lub w inspektorze natychmiast aktualizuje globalny licznik odwiedzonych państw (`X / 195`), statystyki kontynentalne oraz postęp wewnątrz klastrów regionalnych.
