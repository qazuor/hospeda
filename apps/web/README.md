# 🌐 Hospeda Web

Public-facing website built with Astro, React 19, and Tailwind CSS for the Hospeda tourism platform.

## Overview

High-performance website featuring server-side rendering (SSR), static generation (SSG), and interactive React islands for the Hospeda tourism platform. Provides accommodation listings, destination guides, event calendars, and blog content for visitors.

**Tech Stack:**

- **Framework**: Astro 5 with React islands
- **UI**: React 19, Tailwind CSS, Shadcn UI
- **State**: Nanostores (lightweight client state)
- **i18n**: Multi-language support (ES/EN)
- **Authentication**: Clerk
- **Deployment**: Vercel

## Quick Start

```bash
# Install dependencies (from project root)
pnpm install

# Start development server
cd apps/web && pnpm dev

# Run tests
cd apps/web && pnpm test

# Type check
cd apps/web && pnpm typecheck
```

The website will be available at `http://localhost:4321`

## Key Features

- ⚡ **Fast Performance**: SSR/SSG with minimal JavaScript
- 🏝️ **Islands Architecture**: Interactive React components only where needed
- 🌍 **i18n Ready**: Spanish and English language support
- 🎨 **Modern UI**: Tailwind CSS with Shadcn components
- 🔍 **SEO Optimized**: Meta tags, sitemaps, structured data
- 📱 **Mobile First**: Responsive design for all devices
- 🔐 **User Auth**: Clerk authentication integration

## Available Pages

```text
/                          # Home page
/alojamientos              # Accommodation listings
/alojamientos/:slug        # Individual accommodation
/destinos                  # Destination guides
/destinos/:slug            # Individual destination
/eventos                   # Event calendar
/eventos/:slug             # Individual event
/publicaciones             # Blog/news posts
/publicaciones/:slug       # Individual post
/auth/signin               # Sign in page
/auth/signup               # Sign up page
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production (SSG + SSR) |
| `pnpm build:preview` | Build for preview deployment |
| `pnpm preview` | Preview production build locally |
| `pnpm test` | Run all tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm lint` | Lint code with Biome |
| `pnpm format` | Format code with Biome |
| `pnpm analyze` | Analyze bundle size |

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Site Configuration
PUBLIC_SITE_URL=http://localhost:4321
PUBLIC_API_URL=http://localhost:3001

# Clerk Authentication (PUBLIC keys are safe to expose)
PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# i18n
PUBLIC_DEFAULT_LOCALE=es
```

## Documentation

📚 **Complete documentation available in [apps/web/docs/README.md](./docs/README.md)** *(to be created in Phase 2)*

Topics covered in detailed docs:

- **Architecture**: Islands architecture, SSR/SSG strategy
- **Development**: Creating pages, components, styling
- **Routing**: File-based routing, dynamic routes
- **Data Fetching**: Build-time, server-side, client-side
- **i18n**: Adding translations, managing languages
- **SEO**: Meta tags, sitemaps, structured data
- **Performance**: Lighthouse optimization, lazy loading

For shared components and utilities, see:

- **UI Components**: [packages/auth-ui/docs/](../../packages/auth-ui/docs/)
- **Icons**: [packages/icons/docs/](../../packages/icons/docs/)
- **i18n**: [packages/i18n/docs/](../../packages/i18n/docs/)

## Project Structure

```text
src/
├── pages/              # File-based routing (Astro pages)
├── components/         # React & Astro components
├── layouts/            # Layout components
├── lib/                # Utilities and helpers
├── hooks/              # React hooks
├── store/              # Nanostores state
├── i18n/               # Translations
├── styles/             # Global styles
└── middleware/         # Astro middleware
```

---

**Need help?** Check the [complete documentation](./docs/README.md) or contact the development team.
