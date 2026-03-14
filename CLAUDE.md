# CLAUDE.md — Finanzas

This file provides context for AI assistants working in this repository.

## Project Overview

**Finanzas** is a Spanish-language personal finance management Progressive Web App (PWA) for tracking household income and expenses. Key capabilities:

- Log income and expense transactions with hierarchical categorization
- Split credit card charges into installments (cuotas)
- Create recurring transactions (monthly, weekly, biweekly, yearly)
- Track ARS and USD amounts using real-time MEP exchange rates
- Analyze spending via charts and tables (Dashboard, Evolucion, Gastos, Detallado)
- Manage transaction history with full inline editing
- Import transactions via CSV
- Manage categories, subcategories, concepts, and household members

The app is fully client-side; all data lives in Supabase (PostgreSQL + Auth).

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 19.2.0 |
| Build Tool | Vite | 7.3.1 |
| Routing | React Router DOM | 7.13.1 |
| Backend / DB | Supabase JS | 2.98.0 |
| Charts | Recharts | 3.7.0 |
| Icons | Lucide React | 0.575.0 |
| Linter | ESLint | 9.39.1 (flat config) |
| Deployment | Vercel | (auto-deploy) |

**Language:** JavaScript with JSX. TypeScript is not used (tsconfig exists but is unused).

---

## Environment Setup

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Both variables are required. They are accessed in `src/lib/supabase.js` via `import.meta.env`.

### Development Commands

```bash
npm run dev      # Start dev server with HMR (Vite)
npm run build    # Production build → /dist
npm run preview  # Preview production build locally
npm run lint     # Run ESLint
```

---

## Repository Structure

```
finanzas/
├── index.html              # HTML entry point — PWA meta, Google Fonts, SW registration
├── vite.config.js          # Minimal Vite config with React plugin
├── eslint.config.js        # ESLint flat config (ES2020, React hooks)
├── .env.example            # Required env var template
├── public/
│   ├── manifest.json       # PWA manifest (standalone display, dark theme)
│   ├── sw.js               # Service worker for offline support
│   └── icons/              # PWA icons (72px – 512px)
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Root: providers + BrowserRouter + route layout
    ├── index.css           # CSS custom properties (light/dark theme variables)
    ├── styles.css          # Additional component styles
    ├── context/
    │   ├── AuthContext.jsx     # Supabase Auth session state & methods
    │   └── ThemeContext.jsx    # Light/dark/auto theme with localStorage persistence
    ├── lib/
    │   ├── supabase.js         # Supabase client singleton
    │   ├── transactions.js     # createTransaction() — handles installments & recurrence
    │   ├── exchangeRate.js     # MEP rate fetching with DB cache (dolarapi.com)
    │   └── fetchAll.js         # Paginated Supabase fetcher (bypasses 1000-row limit)
    ├── components/
    │   ├── Sidebar.jsx         # Navigation sidebar with theme toggle & mobile support
    │   ├── CurrencyToggle.jsx  # ARS / USD switcher button pair
    │   ├── Auth.jsx            # (Legacy) auth form component
    │   └── TransactionForm.jsx # (Legacy) transaction form component
    └── pages/
        ├── Login.jsx           # Login / signup / forgot-password page
        ├── Carga.jsx           # Transaction entry form (largest page, 471 lines)
        ├── Dashboard.jsx       # KPI cards + cashflow chart with period filters
        ├── Evolucion.jsx       # Monthly income/expense/savings trend charts
        ├── Gastos.jsx          # Category expense breakdown table with sorting
        ├── Detallado.jsx       # Detailed monthly breakdown by category/concept
        ├── Historial.jsx       # Transaction history with pagination & inline editing
        └── Configuracion.jsx   # Settings: exchange rates, categories, persons, import
```

---

## Routing

Defined in `src/App.jsx`. All routes require authentication (enforced by `AuthGate`).

| Route | Component | Purpose |
|---|---|---|
| `/login` | Login.jsx | Auth page (login / signup / reset) |
| `/` | Carga.jsx | Transaction entry form |
| `/dashboard` | Dashboard.jsx | KPI summary & cashflow chart |
| `/evolucion` | Evolucion.jsx | Monthly trend analysis |
| `/gastos` | Gastos.jsx | Category expense breakdown |
| `/detallado` | Detallado.jsx | Detailed category/concept table |
| `/historial` | Historial.jsx | Transaction history & editing |
| `/configuracion` | Configuracion.jsx | App settings & management |

---

## Architecture & Data Flow

### State Management

No Redux or Zustand. Two Context providers in `src/context/`:

- **AuthContext** — Wraps Supabase Auth. Provides `user`, `loading`, `signIn`, `signUp`, `signOut`, `resetPassword`. Listens to `onAuthStateChange`.
- **ThemeContext** — Manages `auto` / `light` / `dark` mode. Reads OS preference via `matchMedia`. Persists to `localStorage`. Applies `data-theme` attribute on `<html>`. Exposes `cycleTheme()` (auto → light → dark → auto).

Provider order in App.jsx: `AuthProvider` → `ThemeProvider` → `BrowserRouter`.

### Supabase Queries

Queries are made **directly inside page components** — there is no repository/service abstraction layer. Use the singleton from `src/lib/supabase.js`:

```js
import { supabase } from '../lib/supabase'

const { data, error } = await supabase
  .from('transactions')
  .select('*, categories(name), concepts(name)')
  .eq('user_id', user.id)
  .order('date', { ascending: false })
```

Always filter by `user_id` — there is no Row Level Security enforced at the application level beyond the authenticated session.

### Pagination

Supabase returns a maximum of 1000 rows per query. Use `fetchAllTransactions()` from `src/lib/fetchAll.js` for queries that may exceed this:

```js
import { fetchAllTransactions } from '../lib/fetchAll'

const data = await fetchAllTransactions({
  filters: [{ type: 'eq', column: 'type', value: 'expense' }],
  order: { column: 'date', ascending: false },
})
```

### Currency & Exchange Rates

- Transactions are stored with both `amount` (in original currency) and `amount_usd` (converted).
- Exchange rates (MEP — Mercado Electrónico de Pagos) are cached in the `exchange_rates` Supabase table.
- `getExchangeRate(date)` in `src/lib/exchangeRate.js`:
  1. Checks DB cache for most recent rate ≤ date
  2. Falls back to `dolarapi.com` API if needed
  3. Returns average of (compra + venta)

### Transaction Creation

`createTransaction()` in `src/lib/transactions.js` handles three cases:
1. **Simple** — One record inserted
2. **Installments (cuotas)** — Multiple records sharing `installment_group_id` (UUID), each with `installment_number` / `installments` fields
3. **Recurring** — Multiple records sharing `recurrence_id`, spaced by `recurrence_frequency`

---

## Database Schema

### `transactions`
Core table. Every transaction belongs to a `user_id`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| type | text | `'income'` or `'expense'` |
| date | date | Transaction date |
| amount | numeric | Amount in original currency |
| currency | text | `'ARS'` or `'USD'` |
| exchange_rate | numeric | MEP rate at transaction date |
| amount_usd | numeric | Converted USD amount |
| category_id | uuid | FK → categories |
| subcategory_id | uuid | FK → subcategories |
| concept_id | uuid | FK → concepts |
| income_concept | text | For income: Sueldo, Bono, Rentas, Otros |
| income_subtype | text | Sub-classification for income |
| payment_method | text | `'Contado'` or `'Crédito'` |
| installments | int | Total number of installments |
| installment_number | int | This installment's index |
| installment_group_id | uuid | Groups installment records together |
| recurrence_id | uuid | Groups recurring records together |
| recurrence_frequency | text | `'monthly'`, `'weekly'`, etc. |
| recurrence_total_periods | int | Total periods in recurrence |
| person_id | uuid | FK → persons |
| destination | text | Travel destination (Viajes category) |
| description | text | Free-text note |

### `categories`
| Column | Notes |
|---|---|
| id, user_id | — |
| name | Category label |
| type | `'expense'` or `'income'` |
| icon | Emoji or icon identifier |
| sort_order | Display ordering |
| archived | Boolean soft-delete |

### `subcategories`
Children of `categories`. Same structure as categories minus `type`/`icon`.

### `concepts`
Children of `subcategories`. Leaf level of the hierarchy.

### `persons`
Household members. Fields: `id`, `user_id`, `name`, `archived`.

### `exchange_rates`
| Column | Notes |
|---|---|
| date | Unique date key |
| rate | MEP average rate (ARS per USD) |
| source | API source identifier |

---

## Styling Conventions

### CSS Custom Properties

Theme variables are defined in `src/index.css` under `[data-theme="dark"]` (default) and `[data-theme="light"]`. Key variables:

```css
--bg-primary       /* Main background */
--bg-secondary     /* Sidebar, card backgrounds */
--bg-card          /* Card surfaces */
--bg-hover         /* Hover states */
--text-primary     /* Main text */
--text-secondary   /* Muted text */
--border           /* Border color */
--color-income     /* Green for income */
--color-expense    /* Red for expenses */
--color-savings    /* Blue for savings */
--color-accent     /* Primary accent */
--sidebar-width    /* 260px expanded */
--sidebar-collapsed /* 72px collapsed */
```

### Inline Styles

All component styling uses **React inline style objects** referencing CSS variables:

```jsx
<div style={{
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  borderRadius: 'var(--radius-md)',
  padding: '16px',
}}>
```

Do **not** introduce Tailwind, CSS modules, or external component libraries. Follow the inline styles + CSS variables pattern.

### Fonts

- Body / UI: **DM Sans** (weights 300–700, loaded via Google Fonts)
- Monospace / numbers: **JetBrains Mono** (weights 400–500)

---

## Naming Conventions

- **Components:** PascalCase (`Carga`, `Dashboard`, `CurrencyToggle`)
- **Functions / variables:** camelCase
- **Files:** PascalCase for components, camelCase for lib utilities
- **UI labels:** Spanish throughout (Carga, Gastos, Historial, Configuracion, etc.)
- **Local abbreviations used in forms:** `amt` (amount), `cur` (currency), `cat` (category), `sub` (subcategory), `con` (concept), `inst` (installments)

---

## Key Patterns

### Data Fetching in Components

```js
useEffect(() => {
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('...')
      .eq('user_id', user.id)
    if (error) console.error(error)
    else setTransactions(data)
    setLoading(false)
  }
  if (user) load()
}, [user])
```

### Formatting Currency

Throughout the app, amounts are displayed using `Intl.NumberFormat` with locale `es-AR`:

```js
const fmt = (val, currency = 'ARS') =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(val)
```

### Category Hierarchy

Categories have three levels:
1. **Category** (e.g., "Alimentación")
2. **Subcategory** (e.g., "Supermercado")
3. **Concept** (e.g., "Carrefour")

Selectors cascade: choosing a category filters subcategories; choosing a subcategory filters concepts.

---

## ESLint Rules

Configured in `eslint.config.js` (flat config format):

- `eslint:recommended` — standard JS rules
- `react-hooks/rules-of-hooks` — enforce hooks rules
- `react-refresh/only-export-components` — Vite fast refresh compatibility
- **Custom exception:** `no-unused-vars` ignores variables starting with uppercase (to allow imported but destructured components)

Run: `npm run lint`

---

## PWA Details

- **manifest.json** in `/public` — standalone display, dark theme color `#111827`
- **sw.js** in `/public` — registered in `index.html` for offline support
- **iOS support** — apple-touch-icon.png, `apple-mobile-web-app-capable` meta tags
- Icons provided in 8 sizes (72×72 to 512×512) in `/public/icons/`

---

## Deployment

Deployed on **Vercel** (project ID: `prj_UvoAlZ9tBRL2TIUSPIyS2naZAdsX`).

- Pushes to `main` trigger automatic Vercel deployments
- Build command: `npm run build` → output directory: `dist`
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel environment variables

---

## Development Workflow

1. Create a feature branch from `main`
2. Run `npm run dev` for local development
3. Make changes following the conventions above
4. Run `npm run lint` before committing
5. Commit with descriptive messages
6. Push branch and open a PR targeting `main`
7. Vercel will create a preview deployment for the PR

---

## Important Files Quick Reference

| File | Role |
|---|---|
| `src/App.jsx` | Root component, routing, provider composition |
| `src/lib/supabase.js` | Supabase client — import `supabase` from here |
| `src/lib/transactions.js` | Use `createTransaction()` for all new transactions |
| `src/lib/fetchAll.js` | Use `fetchAllTransactions()` when data may exceed 1000 rows |
| `src/lib/exchangeRate.js` | Use `getExchangeRate(date)` to get MEP rate |
| `src/context/AuthContext.jsx` | Use `useAuth()` hook for user session |
| `src/context/ThemeContext.jsx` | Use `useTheme()` hook for current theme |
| `src/index.css` | Edit CSS variables here for theme changes |
| `src/pages/Carga.jsx` | Transaction entry — most complex form in the app |
| `src/pages/Configuracion.jsx` | Settings — category/person/rate management |
