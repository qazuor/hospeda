# Hospeda Web2

New public-facing website for the Hospeda tourism accommodation platform, targeting the Litoral Entrerriano region of Argentina. Built with Astro 5, React 19 islands, Tailwind CSS v4, and deployed on Vercel.

This app will eventually **replace `apps/web`** with a fresh design based on the TravHub reference template, featuring organic shapes, warm peach tones, Geologica + Roboto + Caveat typography, and a fully tokenized design system.

## Quick Start

```bash
# From monorepo root
pnpm install

# Copy env file and adjust values
cp apps/web2/.env.example apps/web2/.env.local
# Edit .env.local with your values (see Environment section below)

# Start dev server (port 4322)
pnpm --filter hospeda-web2 dev

# Or start all apps
pnpm dev
```

The app runs at `http://localhost:4322`. Requires the API (`apps/api`) running on port 3001.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Astro 5 (SSR + SSG hybrid) |
| UI Islands | React 19 (interactive components only) |
| Styling | Tailwind CSS v4 with CSS custom properties |
| Adapter | @astrojs/vercel (ISR, image optimization) |
| Auth | Better Auth via @repo/auth-ui |
| i18n | @repo/i18n (es, en, pt) |
| Validation | Zod via @repo/schemas |
| Monitoring | Sentry (optional, controlled by env var) |
| Testing | Vitest + Testing Library |

## Scripts

```bash
pnpm dev              # Start dev server at http://localhost:4322
pnpm build            # Production build (SSR)
pnpm preview          # Preview production build locally
pnpm test             # Run all tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
pnpm typecheck        # TypeScript validation
pnpm lint             # Biome linting
pnpm format           # Biome formatting
```

## Environment Variables

Copy `.env.example` to `.env.local`. Required variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `HOSPEDA_API_URL` or `PUBLIC_API_URL` | Yes | API server URL (e.g., `http://localhost:3001`) |
| `HOSPEDA_SITE_URL` or `PUBLIC_SITE_URL` | Yes | This app's URL (e.g., `http://localhost:4322`) |
| `HOSPEDA_BETTER_AUTH_URL` | For auth | Better Auth endpoint (e.g., `http://localhost:3001/api/auth`) |
| `HOSPEDA_REVALIDATION_SECRET` | For ISR | 32+ char secret matching the API |
| `PUBLIC_SENTRY_DSN` | No | Sentry DSN (omit to disable monitoring) |
| `PUBLIC_ENABLE_LOGGING` | No | Set to `true` to enable client-side logging |

Server-side variables use `HOSPEDA_*` prefix. Client-side (browser-safe) variables use `PUBLIC_*` prefix.

## Pages

```
/{locale}/                                    Homepage
/{locale}/alojamientos/                       Accommodation listing
/{locale}/alojamientos/{slug}/                Accommodation detail
/{locale}/alojamientos/{slug}/propietario/    Owner profile
/{locale}/alojamientos/{slug}/galeria/        Photo gallery
/{locale}/alojamientos/tipo/{type-slug}/      Filter by type
/{locale}/destinos/                           Destination listing
/{locale}/destinos/{slug}/                    Destination detail
/{locale}/destinos/{slug}/galeria/            Photo gallery
/{locale}/destinos/{slug}/alojamientos/       Accommodations in destination
/{locale}/eventos/                            Event listing
/{locale}/eventos/{slug}/                     Event detail
/{locale}/eventos/categoria/{cat-slug}/       Filter by category
/{locale}/eventos/destino/{dest-slug}/        Filter by destination
/{locale}/publicaciones/                      Post listing
/{locale}/publicaciones/{slug}/               Post detail
/{locale}/publicaciones/categoria/{cat-slug}/ Filter by category
/{locale}/publicaciones/etiqueta/{tag-slug}/  Filter by tag
/{locale}/publicaciones/destino/{dest-slug}/  Filter by destination
/{locale}/mi-cuenta/                          User account (protected)
/{locale}/mi-cuenta/favoritos/                Bookmarks (protected)
/{locale}/mi-cuenta/preferencias/             Preferences (protected)
/{locale}/mi-cuenta/resenas/                  Reviews (protected)
/{locale}/mi-cuenta/suscripcion/              Subscription (protected)
/{locale}/suscriptores/                       Subscriber landing (public)
/{locale}/suscriptores/precios/propietarios/  Owner pricing (public)
/{locale}/suscriptores/precios/turistas/      Tourist pricing (public)
/{locale}/suscriptores/propietarios/          Owner landing (public)
/{locale}/contacto/                           Contact form
/{locale}/faq/                                FAQ
/{locale}/ayuda/                              Help
/{locale}/nosotros/                           About us
/{locale}/legal/terminos-condiciones/         Terms of service
/{locale}/legal/politica-privacidad/          Privacy policy
/404                                          Not found
/500                                          Server error
```

Locale prefix is required on all routes. Supported: `es` (default), `en`, `pt`. Root `/` redirects to `/es/`.

## Design

The visual identity is documented in `STYLE_GUIDE.md`. Key traits:

- **Organic asymmetric shapes** (`border-radius: 0 100px`)
- **Warm palette**: peach tint surfaces, sunset orange accent, earthy darks
- **Typography**: Geologica (headings), Roboto (body), Caveat (decorative taglines)
- **Fully tokenized**: all colors, spacing, radius, shadows, and transitions are CSS custom properties. Adding a theme = adding one CSS block
- **Dark mode**: via `data-theme="dark"` on `<html>`

Reference screenshots are in `design/`.

## Related Documentation

- [Style Guide](STYLE_GUIDE.md) - Complete design token reference
- [CLAUDE.md](CLAUDE.md) - Development guidelines for AI assistants
- [Root CLAUDE.md](../../CLAUDE.md) - Monorepo-wide conventions
- [API Route Architecture](../api/docs/route-architecture.md) - API tier reference
