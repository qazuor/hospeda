# ADR-012: Warm Beige Sections for Tourism Content, Gray for Functional UI

## Status

Accepted

## Context

Hospeda serves two distinct types of content within the same platform:

1. **Tourism content** .. Destinations, accommodations, events, testimonials, and hero sections designed to inspire visitors and evoke the warmth of the Litoral region.
2. **Functional UI** .. Authentication forms, account management, admin panels, and platform settings where clarity and efficiency matter more than emotional appeal.

Using a single background color system across both content types creates a mismatch. A fully warm palette makes functional sections feel unprofessional. A fully neutral palette makes tourism content feel cold and uninviting. The platform needs a visual strategy that differentiates these zones while maintaining a cohesive design.

## Decision

Apply a dual-tone background strategy based on content purpose:

### Warm Beige Palette (Tourism Content)

- Base warm: `#f5f0eb`
- Light variant: `#faf7f4`
- Accent warm: `#ede5dc`

Used for: Hero sections, destination showcases, accommodation listings, event highlights, testimonials, featured content blocks, and any section designed to inspire or emotionally engage visitors.

### Neutral Gray Palette (Functional UI)

- Standard background grays from Tailwind's default palette.

Used for: Sign-in/sign-up forms, account settings, admin dashboard, search results (functional view), pagination areas, and any section focused on task completion.

### Boundary Rules

- Tourism pages (home, destinations, accommodations, events) primarily use warm backgrounds.
- Functional pages (auth, mi-cuenta, admin) primarily use gray backgrounds.
- Mixed pages use warm for the inspirational header/hero and gray for the functional body.

## Consequences

### Positive

- Tourism content feels inviting and emotionally warm, matching user expectations for a travel platform.
- Functional sections maintain a clean, professional feel that supports task-focused interaction.
- Clear visual zones help users understand whether they are browsing (warm) or managing (gray).
- The warm palette reinforces brand identity in the sections where first impressions matter most.

### Negative

- More color tokens to maintain in the design system and Tailwind configuration.
- Each new section requires a conscious decision about which palette applies.
- Designers and developers must follow the boundary rules consistently to avoid visual incoherence.

### Neutral

- The beige tones are subtle enough to pair well with both light and dark mode implementations.
- The strategy can evolve as the platform grows without requiring a full redesign.

## Alternatives Considered

1. **Uniform color scheme across all sections** .. Simplest to implement and maintain, but fails to differentiate the emotional and functional aspects of the platform. Tourism sections either feel too sterile or functional sections feel too decorative.

2. **Full warm palette everywhere** .. Creates a strong tourism identity but makes functional sections (forms, settings, admin) feel overly casual and harder to use. Form fields and data tables need visual clarity that warm tones can undermine.

3. **Full gray/neutral palette everywhere** .. Professional and clean, but strips the platform of the warmth and personality that tourism users expect. The platform would feel like a SaaS tool rather than a travel discovery experience. Competing tourism platforms use warm, inviting colors to differentiate from generic web applications.
