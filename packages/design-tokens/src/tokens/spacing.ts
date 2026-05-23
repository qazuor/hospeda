/**
 * @file spacing.ts
 * @description Spacing tokens for SPEC-153.
 *
 * Two coexisting layers:
 *
 *   1. **Numeric scale** — the union of doc 05 §5.3 and web's current set.
 *      Doc 05 specifies 0/1/2/3/4/5/6/8/10/12/16/20/24; web ships 1..10
 *      + 12. We export the union (0..10, 12, 16, 20, 24) so admin's
 *      Tailwind utilities have the canonical Tailwind-flavored stops AND
 *      web's existing tokens remain resolvable byte-for-byte.
 *
 *   2. **Semantic composites** anchored to web's global.css —
 *      space-section / -sm / -lg, space-container-x, space-card-gap,
 *      space-section-header-mb, space-card-content. Most use clamp()
 *      for fluid responsive spacing.
 *
 * Per doc 05 §5.3 + Eje 8, the same numeric scale serves both apps —
 * density differences (web uses 8/12 for padding/gap, admin uses 4-5/6-8)
 * are encoded at the component-style level, NOT in this token module.
 *
 * All values are CSS expression strings. The numeric scale uses rem-based
 * units for accessibility (scales with user font-size); the semantic
 * composites use clamp() where fluid behavior matters.
 */

// ============================================================================
// Numeric scale (rem-based, accessibility-friendly)
//
// Values for 1..10 + 12 anchor to web's --space-1..-12 byte-for-byte
// (verified by the seed manifest). 0/16/20/24 come from doc 05 §5.3 and
// have no current web declaration — admin's Tailwind utilities are the
// primary consumer.
// ============================================================================

export const spacing = {
    0: '0',
    1: '0.25rem', // 4px
    2: '0.5rem', // 8px
    3: '0.75rem', // 12px
    4: '1rem', // 16px
    5: '1.25rem', // 20px
    6: '1.5rem', // 24px
    7: '1.75rem', // 28px — web-only extra
    8: '2rem', // 32px
    9: '2.25rem', // 36px — web-only extra
    10: '2.5rem', // 40px
    12: '3rem', // 48px
    16: '4rem', // 64px — doc 05 only (admin)
    20: '5rem', // 80px — doc 05 only (admin)
    24: '6rem' // 96px — doc 05 only (admin)
} as const satisfies Record<number, string>;

export type SpacingKey = keyof typeof spacing;

// ============================================================================
// Semantic composites — anchored to web seed byte-for-byte
//
// Keys are camelCase; the CSS generator (T-153-16) maps them back to web's
// kebab-case --space-* token names. All values come from web's global.css
// :root.
// ============================================================================

export const semanticSpacing = {
    /**
     * Default vertical section padding. Fluid clamp 48px → 120px.
     * Web token `--space-section`.
     */
    section: 'clamp(3rem, 8vw, 7.5rem)',
    /**
     * Compact vertical section padding for dense layouts. Fluid 40px → 80px.
     * Web token `--space-section-sm`.
     */
    sectionSm: 'clamp(2.5rem, 5vw, 5rem)',
    /**
     * Large vertical section padding (hero / pricing surfaces). Fluid
     * 64px → 160px. Web token `--space-section-lg`.
     */
    sectionLg: 'clamp(4rem, 10vw, 10rem)',
    /**
     * Horizontal container padding (gutter). Fluid 12px → 24px.
     * Web token `--space-container-x`.
     */
    containerX: 'clamp(0.75rem, 3vw, 1.5rem)',
    /**
     * Gap between cards in a grid. Fluid 16px → 30px.
     * Web token `--space-card-gap`.
     */
    cardGap: 'clamp(1rem, 3vw, 1.875rem)',
    /**
     * Bottom margin under section headers. Fixed 50px.
     * Web token `--space-section-header-mb`.
     */
    sectionHeaderMb: '50px',
    /**
     * Inner padding of card content surfaces (top-right-bottom shorthand).
     * Web token `--space-card-content`.
     */
    cardContent: '27px 30px 26px'
} as const satisfies Record<string, string>;

export type SemanticSpacingName = keyof typeof semanticSpacing;

// ============================================================================
// Master spacing aggregate
// ============================================================================

export const spacingTokens = {
    scale: spacing,
    semantic: semanticSpacing
} as const;
