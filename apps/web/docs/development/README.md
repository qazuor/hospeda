# Development Guide

Complete guide for developers working on the Hospeda Web App.

---

## 📖 Overview

This section provides comprehensive guides for developing features in the Astro + React web application.

**Target Audience**: Developers building pages, components, and features for the public-facing Hospeda platform.

---

## 🚀 Quick Start for Developers

### Prerequisites

Before you start development:

1. ✅ Complete [Setup Guide](../setup.md)
2. ✅ Understand [Architecture](../architecture.md)
3. ✅ Read [Code Standards](../../../../.claude/docs/standards/code-standards.md)
4. ✅ Familiarize with [TDD Methodology](../../../../.claude/skills/tdd-methodology.md)

### Development Workflow

```bash
# 1. Start dev server
cd apps/web && pnpm dev

# 2. Make changes (TDD: test first!)
# 3. Run tests
pnpm test

# 4. Check quality
pnpm typecheck
pnpm lint

# 5. Commit changes (atomic commits!)
git add <specific-files>
git commit -m "feat(web): your change"
```

---

## 📚 Development Guides

### Core Concepts

#### [Islands Architecture](islands.md)

**Essential Reading** - Understanding Islands Architecture is critical:

- **What**: Astro Islands pattern
- **Why**: Performance optimization strategy
- **How**: Partial hydration with React components
- **When**: Choose between Astro vs React components

**Topics**:

- Static-first rendering
- Selective hydration
- Client directives (`client:load`, `client:idle`, etc.)
- Performance implications

**Read First**: Before building any component

#### [Pages & Routing](pages.md)

Complete guide to Astro's file-based routing:

- **File-based routing**: How URLs map to files
- **Static vs dynamic routes**: When to use each
- **Route parameters**: Access and validate params
- **API routes**: Build backend endpoints
- **Middleware**: Handle auth, logging, etc.

**Topics**:

- Creating static pages
- Dynamic route parameters
- Generating static paths
- SSR vs SSG configuration
- Route grouping and organization

**When to read**: When adding new pages or routes

### Tutorials

#### [Creating Pages - Tutorial](creating-pages.md)

**Step-by-step tutorial** for creating a new page:

- Complete walkthrough from start to finish
- Real-world example: Event detail page
- File creation, routing, data fetching
- Layout integration, SEO, testing

**Format**: Hands-on tutorial with code examples

**Best for**: First-time page creation or reference

### Building Blocks

#### [Component Organization](components.md)

Best practices for organizing and building components:

- **Component types**: Astro vs React islands
- **File structure**: Where to put components
- **Naming conventions**: File and component names
- **Props patterns**: Type-safe component interfaces
- **Composition**: Building complex UIs

**Topics**:

- Directory structure (`components/`, `layouts/`)
- Component categories (UI, forms, features)
- Barrel files and exports
- Astro component patterns
- React island patterns

**When to read**: Before creating reusable components

#### [Styling Guide](styling.md)

Styling with Tailwind CSS + Shadcn UI:

- **Tailwind CSS**: Utility-first styling
- **Shadcn UI**: Component library integration
- **Scoped styles**: Component-level CSS
- **Global styles**: Theme and design system
- **Responsive design**: Breakpoints and mobile-first

**Topics**:

- Tailwind utility classes
- Shadcn component usage
- Scoped `<style>` blocks
- Custom Tailwind config
- Dark mode support
- Responsive patterns

**When to read**: Before styling any component

---

## 🎯 Common Development Tasks

### Creating a New Static Page

```bash
# 1. Create page file
touch src/pages/about.astro

# 2. Use layout
# 3. Add content
# 4. Test locally
pnpm dev
```

**Guide**: [Creating Pages Tutorial](creating-pages.md)

### Creating a Dynamic Page

```bash
# 1. Create dynamic route
touch src/pages/eventos/[slug].astro

# 2. Implement getStaticPaths()
# 3. Fetch data for each path
# 4. Test with real data
```

**Guide**: [Pages & Routing](pages.md#dynamic-routes)

### Adding an Interactive Component

```bash
# 1. Create React component
touch src/components/EventCalendar.tsx

# 2. Use in Astro page with client directive
<EventCalendar client:visible />

# 3. Choose appropriate hydration strategy
```

**Guide**: [Islands Architecture](islands.md#when-to-use-react)

### Styling a Component

```bash
# Option 1: Tailwind (recommended)
<div class="rounded-lg shadow-md p-4">

# Option 2: Scoped styles
<style>
  .custom { @apply rounded-lg shadow-md p-4; }
</style>

# Option 3: Shadcn component
import { Card } from "@/components/ui/card"
```

**Guide**: [Styling Guide](styling.md)

### Adding an API Endpoint

```bash
# 1. Create API route
touch src/pages/api/events.ts

# 2. Export HTTP methods
export const GET: APIRoute = async () => { }

# 3. Test endpoint
curl http://localhost:4321/api/events
```

**Guide**: [Pages & Routing](pages.md#api-routes)

---

## 🏗️ Architecture Quick Reference

### Tech Stack

**Framework**:

- Astro 4.x - Static site generator with Islands
- React 19 - Interactive UI components

**Styling**:

- Tailwind CSS - Utility-first CSS
- Shadcn UI - Component library

**State**:

- Nanostores - Lightweight state management

**Auth**:

- Clerk - Authentication & user management

**Data**:

- `@repo/service-core` - Business logic services
- `@repo/schemas` - Zod validation schemas

### Component Decision Tree

```text
Need interactivity (clicks, forms, state)?
├─ YES → Use React component (.tsx)
│   ├─ Critical/above-fold? → client:load
│   ├─ Below-fold? → client:idle or client:visible
│   └─ Mobile-only? → client:media="(max-width: 768px)"
└─ NO → Use Astro component (.astro)
    └─ Pure static HTML, zero JavaScript
```

### Rendering Strategy

```text
Content changes frequently?
├─ YES → Server-Side Rendering (SSR)
│   └─ export const prerender = false
└─ NO → Static Site Generation (SSG)
    └─ Default behavior, no config needed
```

---

## 📁 Project Structure Reference

```text
src/
├── pages/              # Routes (file-based routing)
│   ├── index.astro         # Homepage: /
│   ├── about.astro         # Static: /about
│   ├── alojamientos/       # Accommodations section
│   │   ├── index.astro         # List: /alojamientos
│   │   └── [slug].astro        # Detail: /alojamientos/:slug
│   ├── destinos/           # Destinations section
│   ├── eventos/            # Events section
│   ├── publicaciones/      # Posts/blog section
│   └── api/                # API endpoints
│       └── events.ts           # GET /api/events
├── components/         # Reusable components
│   ├── accommodation/      # Accommodation-specific
│   ├── destination/        # Destination-specific
│   ├── event/              # Event-specific
│   ├── ui/                 # Generic UI (buttons, cards, etc.)
│   └── forms/              # Form components
├── layouts/            # Page layouts
│   ├── MainLayout.astro    # Default layout
│   ├── Header.astro        # Site header
│   └── Footer.astro        # Site footer
├── lib/                # Utility functions
├── hooks/              # React hooks
├── store/              # Nanostores state
├── i18n/               # Translations (ES/EN)
├── styles/             # Global styles
└── middleware.ts       # Astro middleware
```

**See**: [Component Organization](components.md) for detailed structure

---

## 🧪 Testing Guidelines

### Test Requirements

- ✅ **90% coverage minimum** - No exceptions
- ✅ **TDD approach** - Write tests first
- ✅ **Test types**: Unit + Integration + E2E

### Test Structure

```text
src/components/AccommodationCard.tsx
test/components/AccommodationCard.test.tsx
```

**Location**: `test/` folder at app root, mirroring `src/` structure

### Example Test

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AccommodationCard } from './AccommodationCard';

describe('AccommodationCard', () => {
  it('should render accommodation name', () => {
    const mockAccommodation = {
      id: '1',
      name: 'Hotel Test',
      slug: 'hotel-test',
      description: 'A test hotel'
    };

    render(<AccommodationCard accommodation={mockAccommodation} />);

    expect(screen.getByText('Hotel Test')).toBeInTheDocument();
  });

  it('should display price when provided', () => {
    const mockAccommodation = {
      id: '1',
      name: 'Hotel Test',
      slug: 'hotel-test',
      description: 'A test hotel',
      pricePerNight: 5000
    };

    render(<AccommodationCard accommodation={mockAccommodation} />);

    expect(screen.getByText(/5000/)).toBeInTheDocument();
  });
});
```

**Full guide**: [TDD Methodology](../../../../.claude/skills/tdd-methodology.md)

---

## 🎨 Design System

### Colors

```typescript
// Tailwind config colors
primary: '#your-primary-color'
secondary: '#your-secondary-color'
accent: '#your-accent-color'

// Usage
<button class="bg-primary text-white">Click me</button>
```

### Typography

```typescript
// Headings
<h1 class="text-4xl font-bold">Page Title</h1>
<h2 class="text-3xl font-semibold">Section Title</h2>
<h3 class="text-2xl font-medium">Subsection</h3>

// Body
<p class="text-base">Regular text</p>
<p class="text-sm">Small text</p>
```

### Spacing

```typescript
// Container
<div class="container mx-auto px-4">

// Spacing
<div class="mt-4">      // Margin top: 1rem
<div class="p-6">       // Padding all: 1.5rem
<div class="gap-4">     // Gap: 1rem
```

**Full guide**: [Styling Guide](styling.md)

---

## 🌍 Internationalization (i18n)

### Translation Files

```text
src/i18n/
├── es.json    # Spanish (default)
└── en.json    # English
```

### Usage in Components

**Astro**:

```astro
---
import { t } from '../i18n';
---

<h1>{t('home.welcome')}</h1>
<p>{t('home.description', { name: 'Hospeda' })}</p>
```

**React**:

```tsx
import { useStore } from '@nanostores/react';
import { t, locale } from '../i18n';

export function Greeting() {
  const currentLocale = useStore(locale);
  return <h1>{t('greeting', { locale: currentLocale })}</h1>;
}
```

**Rule**: **Never** hardcode user-facing strings

---

## 🔐 Authentication

### Server-Side (Pages)

```astro
---
import { getAuth } from '@clerk/astro/server';

const { userId } = getAuth(Astro);

if (!userId) {
  return Astro.redirect('/auth/signin');
}
---
```

### Client-Side (React)

```tsx
import { useUser, SignInButton } from '@clerk/clerk-react';

export function AuthStatus() {
  const { isSignedIn, user } = useUser();

  if (!isSignedIn) return <SignInButton />;

  return <div>Hello, {user.firstName}</div>;
}
```

---

## ⚡ Performance Best Practices

### Rendering Optimization

1. **Default to static** - Use SSG unless content changes frequently
2. **Minimize React islands** - Use Astro components when possible
3. **Defer hydration** - Use `client:idle` or `client:visible`
4. **Lazy load images** - Use Astro's `<Image>` component
5. **Code split** - Dynamic imports for heavy components

### Example: Optimized Component Loading

```astro
---
// Heavy component only for desktop
import { DesktopAnalytics } from '../components/DesktopAnalytics';
// Light component
import { AccommodationCard } from '../components/AccommodationCard';
---

<!-- Static component -->
<AccommodationCard accommodation={data} />

<!-- Hydrate only on desktop, when idle -->
<DesktopAnalytics
  client:media="(min-width: 1024px)"
  client:idle
/>
```

---

## 🔍 Debugging Tips

### Dev Server Issues

```bash
# Clear cache and restart
rm -rf .astro node_modules/.vite
pnpm install
pnpm dev
```

### TypeScript Errors

```bash
# Check types
pnpm typecheck

# Common fix: regenerate env types
pnpm astro sync
```

### Build Failures

```bash
# Check build output
pnpm build

# Preview production build
pnpm preview
```

---

## 📖 Additional Resources

### Internal Documentation

- **[Architecture Guide](../architecture.md)** - Technical architecture
- **[Setup Guide](../setup.md)** - Local development setup
- **[Usage Guide](../usage/README.md)** - End-user features
- **[Code Standards](../../../../.claude/docs/standards/code-standards.md)** - Project code standards

### External Resources

- **[Astro Docs](https://docs.astro.build)** - Official Astro documentation
- **[React 19 Docs](https://react.dev)** - React documentation
- **[Tailwind CSS](https://tailwindcss.com/docs)** - Tailwind documentation
- **[Shadcn UI](https://ui.shadcn.com)** - Component library docs

---

## 🤝 Getting Help

### Stuck on Something?

1. **Check the guides** - Most common patterns are documented
2. **Search the codebase** - Look for similar implementations
3. **Ask for help** - Team collaboration is encouraged

### Found a Bug?

1. Create an issue with reproduction steps
2. Include error messages and stack traces
3. Mention your environment (Node version, OS, etc.)

### Want to Improve Docs?

1. Submit a PR with improvements
2. Follow markdown formatting standards
3. Add code examples where helpful

---

⬅️ Back to [Web App Documentation](../README.md)
