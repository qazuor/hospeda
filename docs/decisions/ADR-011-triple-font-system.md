# ADR-011: Three-Font System with Playfair Display, Caveat, and Inter

## Status

Accepted

## Context

Hospeda is a tourism platform targeting visitors to Concepcion del Uruguay and the Litoral region of Argentina. The visual identity must balance warmth and elegance (to evoke travel inspiration) with clean readability (to support functional tasks like searching, booking, and account management).

Typography is one of the strongest tools for establishing brand personality. The font choices directly affect how users perceive the platform .. whether it feels premium, trustworthy, and inviting or generic and forgettable.

The platform serves content in three languages (Spanish, English, Portuguese), so chosen fonts must support Latin Extended character sets including accented characters common in all three languages.

## Decision

Adopt a three-font typographic system:

- **Playfair Display** (serif) .. Headings and display text. Conveys elegance, sophistication, and editorial quality. Used for page titles, section headings, and hero text.
- **Caveat** (handwritten) .. Accent text and decorative elements. Adds warmth, personality, and a human touch. Used sparingly for quotes, testimonials, callouts, and decorative labels.
- **Inter** (sans-serif) .. Body text, UI elements, and functional copy. Provides excellent readability at all sizes and weights. Used for paragraphs, buttons, form labels, navigation, and all functional text.

### Usage Rules

| Font | Use Case | Example |
|------|----------|---------|
| Playfair Display | Page titles, section headings, hero text | "Discover the Litoral" |
| Caveat | Quotes, testimonials, accent labels, handwritten feel | "A hidden gem" |
| Inter | Body text, buttons, forms, navigation, UI | "Search accommodations" |

## Consequences

### Positive

- Strong visual hierarchy with clear distinction between heading, accent, and body text.
- Warm, inviting personality that fits the tourism domain without sacrificing professionalism.
- Excellent readability for functional content through Inter's optimized screen rendering.
- Caveat adds a distinctive, memorable brand element that differentiates Hospeda from generic platforms.
- All three fonts support Latin Extended characters needed for Spanish, English, and Portuguese.

### Negative

- Three font downloads increase initial page load (mitigated by `font-display: swap` and subsetting).
- Requires clear pairing rules to prevent misuse (e.g., Caveat should never be used for body text or critical UI).
- Design consistency demands discipline .. each font must be used only in its designated contexts.

### Neutral

- All three fonts are available through Google Fonts with open licenses.
- Font loading can be optimized with preloading the most critical weights and using `font-display: swap`.

## Alternatives Considered

1. **Single font (e.g., Inter only)** .. Simplest approach with minimal performance overhead. However, a single sans-serif font creates a generic, utilitarian feel that lacks the warmth and personality expected from a tourism platform. Headings and body text blend together, weakening visual hierarchy.

2. **System fonts only** .. Zero download cost and instant rendering, but completely eliminates brand identity through typography. The platform would look like every other default-styled website, losing a key differentiator in the tourism space where visual appeal drives engagement.

3. **Two fonts (Playfair Display + Inter)** .. A solid pairing that covers headings and body text effectively. However, it misses the personality layer that Caveat provides. Testimonials and accent text rendered in either Playfair or Inter lack the warm, human touch that a handwritten font brings. The third font adds significant brand character for a relatively small performance cost.
