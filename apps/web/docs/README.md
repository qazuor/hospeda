# Web Documentation

Welcome to the Hospeda Web App documentation.

---

## 🚀 Quick Start

Get started with the web app in minutes:

```bash
# Install dependencies (from project root)
pnpm install

# Start dev server
cd apps/web && pnpm dev

# Visit http://localhost:4321
```

**New to the web app?** Start with:

1. [Setup Guide](setup.md) - Configure local environment
2. [Architecture](architecture.md) - Understand Astro + React
3. [Usage Guide](usage/README.md) - Learn app features
4. [Development Guide](development/README.md) - Build new features

---

## 📚 Documentation Structure

### Core Documentation

- **[Setup Guide](setup.md)** - Local development setup
- **[Architecture](architecture.md)** - Technical architecture overview

### Usage Documentation

Learn how to use the web app:

- **[Features Overview](usage/features.md)** - User-facing features
- **[Navigation Guide](usage/navigation.md)** - Site structure
- **[Mobile Experience](usage/mobile.md)** - Responsive design

### Development Documentation

Build and extend the web app:

- **[Creating Pages](development/creating-pages.md)** - Page development
- **[Creating Components](development/creating-components.md)** - Component patterns
- **[Island Architecture](development/islands.md)** - React islands
- **[Styling](development/styling.md)** - Tailwind CSS
- **[Routing](development/routing.md)** - File-based routing
- **[Data Fetching](development/data-fetching.md)** - SSR/SSG/Client
- **[State Management](development/state.md)** - Nanostores
- **[Internationalization](development/i18n.md)** - i18n setup
- **[Authentication](development/auth.md)** - Clerk integration

### Examples

Practical code examples:

- **[Page Examples](examples/pages.md)** - Complete page implementations
- **[Component Examples](examples/components.md)** - Component patterns
- **[Integration Examples](examples/integrations.md)** - API, auth, i18n

---

## 💡 Common Tasks

### Creating a New Page

```bash
# 1. Create page file
apps/web/src/pages/nueva-pagina.astro

# 2. Add content
# 3. Test at http://localhost:4321/nueva-pagina
```

[Full tutorial →](development/creating-pages.md)

### Adding a React Component

```bash
# 1. Create component
apps/web/src/components/MiComponente.tsx

# 2. Use with client directive
<MiComponente client:load />
```

[Full tutorial →](development/creating-components.md)

### Adding Translations

```bash
# 1. Add keys to i18n files
apps/web/src/i18n/es.json
apps/web/src/i18n/en.json

# 2. Use in code
{t('mi.clave')}
```

[Full tutorial →](development/i18n.md)

---

## 🏗️ Architecture Quick Reference

**Framework**: Astro + React 19
**Rendering**: SSR + SSG (Hybrid)
**Styling**: Tailwind CSS
**State**: Nanostores
**i18n**: Custom i18n package
**Auth**: Clerk
**Icons**: Custom icon package

### Key Concepts

- **Astro Pages**: File-based routing, SSR/SSG
- **React Islands**: Interactive components with `client:*` directives
- **Nanostores**: Lightweight state management
- **Content Collections**: Type-safe markdown content
- **View Transitions**: Smooth page transitions

[Learn more →](architecture.md)

---

## 🔧 Development Workflow

### 1. Local Setup

```bash
# From project root
pnpm install
cd apps/web
pnpm dev
```

### 2. Make Changes

- Edit pages in `src/pages/`
- Edit components in `src/components/`
- Hot reload updates automatically

### 3. Quality Checks

```bash
# TypeScript
pnpm typecheck

# Linting
pnpm lint

# Tests
pnpm test

# Coverage
pnpm test:coverage
```

### 4. Build

```bash
# Production build
pnpm build

# Preview build
pnpm preview
```

---

## 📂 Project Structure

```text
apps/web/
├── src/
│   ├── pages/              # Routes (file-based)
│   │   ├── index.astro         # Home page (/)
│   │   ├── alojamientos/       # Accommodations
│   │   ├── destinos/           # Destinations
│   │   ├── eventos/            # Events
│   │   └── api/                # API endpoints
│   ├── components/         # React & Astro components
│   │   ├── accommodation/
│   │   ├── destination/
│   │   ├── ui/                 # Reusable UI
│   │   └── forms/              # Forms
│   ├── layouts/            # Layout components
│   ├── styles/             # Global styles
│   ├── lib/                # Utilities
│   ├── hooks/              # React hooks
│   ├── store/              # Nanostores
│   ├── i18n/               # Translations
│   └── middleware.ts       # Middleware
├── public/                 # Static assets
├── docs/                   # Documentation
└── astro.config.mjs       # Astro configuration
```

---

## 🌐 Key Pages

- **Home**: `/` - Landing page
- **Accommodations**: `/alojamientos` - Accommodation listings
- **Destinations**: `/destinos` - Destination pages
- **Events**: `/eventos` - Event listings
- **Posts**: `/publicaciones` - News/blog posts
- **Auth**: `/auth` - Sign in/up pages

---

## 🎨 Styling

Uses Tailwind CSS with custom configuration:

```astro
<div class="container mx-auto px-4">
  <h1 class="text-4xl font-bold text-primary">Title</h1>
</div>

<style>
  .custom {
    @apply flex items-center gap-4;
  }
</style>
```

[Styling guide →](development/styling.md)

---

## 🌍 Internationalization

Supports Spanish and English:

```astro
---
import { t } from '../i18n';
---

<h1>{t('home.welcome')}</h1>
<p>{t('home.description', { name: 'Hospeda' })}</p>
```

[i18n guide →](development/i18n.md)

---

## 🔐 Authentication

Uses Clerk for authentication:

```astro
---
import { getAuth } from '@clerk/astro/server';

const { userId } = getAuth(Astro);
if (!userId) return Astro.redirect('/auth/signin');
---

<div>Protected content</div>
```

[Auth guide →](development/auth.md)

---

## 🧪 Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# Interactive UI
pnpm test:ui
```

### Testing Standards

- Write tests for all components
- Test user interactions
- Test accessibility
- 90% coverage minimum

[Testing guide →](development/testing.md)

---

## 📦 Key Dependencies

- `astro` - Framework
- `@astrojs/react` - React integration
- `@clerk/astro` - Authentication
- `nanostores` - State management
- `tailwindcss` - Styling
- `@repo/service-core` - Business logic
- `@repo/i18n` - Internationalization
- `@repo/icons` - Icons

---

## 🎯 Best Practices

1. **Use Astro components by default** - React only for interactivity
2. **Minimize client-side JavaScript** - Leverage SSR/SSG
3. **Use proper client directives** - `client:load`, `client:idle`, `client:visible`
4. **Optimize images** - Use Astro's `<Image>` component
5. **Type everything** - `import type { ... }`
6. **Test accessibility** - Semantic HTML + ARIA
7. **Use i18n** - No hardcoded strings
8. **Follow naming conventions** - See standards
9. **Keep components small** - Single responsibility
10. **Write tests first** - TDD approach

---

## 🔗 Related Documentation

- **[Root Documentation](../../../docs/README.md)** - Project overview
- **[API Documentation](../../api/docs/README.md)** - Backend API
- **[Admin Documentation](../../admin/docs/README.md)** - Admin dashboard
- **[Main CLAUDE.md](../CLAUDE.md)** - Web app guidelines
- **[Project CLAUDE.md](../../../CLAUDE.md)** - Project-wide guidelines

---

## 📞 Need Help?

- **Development Issues**: Check [troubleshooting](development/troubleshooting.md)
- **Architecture Questions**: See [architecture](architecture.md)
- **Component Patterns**: Browse [examples](examples/)
- **Project Guidelines**: Read [CLAUDE.md](../CLAUDE.md)

---

**Last updated**: 2025-11-05
