# ADR-001: Astro over Next.js for Public Web App

## Status

Accepted

## Context

The Hospeda platform needed a frontend framework for its public-facing web application. The site is primarily content-driven, showcasing tourist accommodations, destinations, events, and blog posts for the Litoral region of Argentina. Key requirements included:

- Excellent SEO performance for discoverability in the Argentine tourism market
- Minimal JavaScript sent to the browser for fast page loads on varying network conditions
- Server-side rendering for dynamic, personalized content
- Ability to add interactivity where needed (search filters, maps, forms) without hydrating the entire page
- Support for internationalization (Spanish, English, Portuguese)

The target audience includes travelers researching accommodations in Concepcion del Uruguay and surrounding areas, often browsing on mobile devices with inconsistent connectivity.

## Decision

We chose **Astro 5** with its islands architecture as the framework for the public web application (`apps/web`). React is used selectively for interactive components via client directives (`client:visible`, `client:idle`, `client:load`).

## Consequences

### Positive

- **Minimal JavaScript bundle** .. Astro ships zero JavaScript by default. Only interactive islands send JS to the client, resulting in significantly smaller bundles compared to full-framework approaches.
- **Fast Time to First Byte (TTFB)** .. Server-rendered pages with minimal client-side overhead deliver content quickly, critical for SEO and user experience.
- **Islands architecture** .. Selective hydration allows us to keep most of the site static while adding React interactivity only where needed (search bars, filter panels, map components).
- **Native SSR support** .. Astro's server-side rendering integrates cleanly with the Vercel adapter for on-demand page generation.
- **Content-first design** .. Astro's architecture aligns naturally with a content-heavy tourism site where most pages are read-only.
- **SEO advantages** .. Full HTML delivered on first request, automatic sitemap generation, and clean integration with structured data (JSON-LD).

### Negative

- **Smaller ecosystem** .. Fewer third-party integrations and community resources compared to Next.js.
- **Less seamless React integration** .. React components require explicit client directives and cannot share state as easily as in a pure React application.
- **Team learning curve** .. Developers familiar with React/Next.js needed time to learn Astro's component model and .astro file syntax.
- **Limited client-side routing** .. View transitions provide some SPA-like feel, but full client-side routing is not as mature as Next.js.

### Neutral

- Astro's ecosystem is growing rapidly, narrowing the gap with more established frameworks.
- The team developed strong patterns for deciding when to use Astro components versus React islands.

## Alternatives Considered

### Next.js

Next.js was the most obvious alternative given the team's React experience. However, it was rejected because:

- Even with Server Components, Next.js ships more client-side JavaScript than necessary for a content-driven site.
- The App Router adds complexity that does not provide clear benefits for a primarily read-only tourism site.
- Bundle sizes would be larger, impacting load times for users on mobile networks in Argentina.

### Remix

Remix offers excellent SSR and progressive enhancement but was considered overkill for a content-heavy site. Its strengths (form handling, nested routes with data loading) are more valuable for highly interactive applications than for a tourism content platform.

### Plain React SPA

A single-page application was rejected early due to:

- Poor SEO performance without significant SSR infrastructure.
- Large initial JavaScript bundle required before any content renders.
- Fundamentally misaligned with a content-first, SEO-dependent use case.
