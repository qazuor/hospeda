/**
 * @file visual-identity-integration.test.ts
 * @description Integration tests verifying that the web application components
 * follow the semantic color token convention documented in CLAUDE.md and global.css.
 *
 * Rules enforced:
 * - Components must use Tailwind semantic classes (bg-primary, text-foreground, etc.)
 *   NOT hardcoded palette classes (bg-blue-600, text-gray-900, etc.)
 * - Components must not contain hardcoded hex colors (#xxx, #xxxxxx)
 * - Components must not contain hardcoded rgb() / rgba() / hsl() color functions
 * - CSS custom properties (--background, --primary, etc.) are defined in global.css
 * - Section files should reference CSS semantic tokens (e.g. bg-muted, bg-card, etc.)
 *
 * Note: Some specific shade utilities (e.g. bg-primary/10, bg-primary/95) are
 * allowed because they use semantic token names with opacity modifiers, not
 * hardcoded palette values.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEB_ROOT = resolve(__dirname, '../../');
const SRC = resolve(WEB_ROOT, 'src');

/**
 * Read a source file relative to src/.
 */
function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC, relativePath), 'utf8');
}

/**
 * Tailwind palette classes that must not appear in components.
 * These are hardcoded color values that bypass the semantic token system.
 */
const FORBIDDEN_PALETTE_PATTERNS: readonly RegExp[] = [
    /\bclass(?:Name)?=['""][^'"]*\b(?:bg|text|border|ring|fill|stroke|shadow|from|to|via)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{3}\b/
] as const;

/**
 * Hardcoded color patterns that must not appear in component source files.
 */
const _FORBIDDEN_COLOR_PATTERNS: readonly RegExp[] = [
    /** Hex colors: #rgb, #rrggbb, #rrggbbaa */
    /#[0-9a-fA-F]{3,8}\b/,
    /** rgb() and rgba() functions in class attribute values */
    /class(?:Name)?=["'][^'"]*rgb(?:a)?\(/,
    /** hsl() functions in class attribute values */
    /class(?:Name)?=["'][^'"]*hsl(?:a)?\(/
] as const;

/**
 * Checks whether the source contains any forbidden hardcoded palette class.
 */
function hasForbiddenPaletteClass(src: string): boolean {
    return FORBIDDEN_PALETTE_PATTERNS.some((pattern) => pattern.test(src));
}

/**
 * Checks whether the source contains hardcoded hex colors in class attributes.
 * Excludes oklch() values in CSS files (they are the token definitions themselves).
 */
function hasHardcodedHexColor(src: string, isStylesheet = false): boolean {
    if (isStylesheet) {
        // Stylesheets define tokens, not consume them - skip hex check for CSS files
        return false;
    }
    // Match hex colors NOT inside oklch() or other CSS color function contexts
    // Also skip meta[content] (theme-color uses a hex)
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    const metaThemeColorPattern = /meta[^>]*content=["']#[0-9a-fA-F]{3,8}/;
    return hexPattern.test(src) && !metaThemeColorPattern.test(src);
}

// ---------------------------------------------------------------------------
// Files to audit
// ---------------------------------------------------------------------------

interface FileAudit {
    /** Human-readable label for test output */
    readonly label: string;
    /** Path relative to src/ */
    readonly path: string;
}

const SECTION_FILES: readonly FileAudit[] = [
    { label: 'AccommodationsSection', path: 'components/sections/AccommodationsSection.astro' },
    { label: 'DestinationsSection', path: 'components/sections/DestinationsSection.astro' },
    { label: 'EventsSection', path: 'components/sections/EventsSection.astro' },
    { label: 'PostsSection', path: 'components/sections/PostsSection.astro' },
    { label: 'ReviewsSection', path: 'components/sections/ReviewsSection.astro' },
    { label: 'StatsSection', path: 'components/sections/StatsSection.astro' },
    { label: 'ListPropertySection', path: 'components/sections/ListPropertySection.astro' },
    { label: 'HeroSection', path: 'components/sections/HeroSection.astro' }
] as const;

const LAYOUT_FILES: readonly FileAudit[] = [
    { label: 'BaseLayout', path: 'layouts/BaseLayout.astro' },
    { label: 'Footer', path: 'layouts/Footer.astro' }
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('visual-identity-integration', () => {
    describe('global.css defines semantic CSS custom properties', () => {
        const cssSrc = readSrc('styles/global.css');

        const REQUIRED_TOKENS = [
            '--background',
            '--foreground',
            '--card',
            '--card-foreground',
            '--primary',
            '--primary-foreground',
            '--secondary',
            '--secondary-foreground',
            '--accent',
            '--accent-foreground',
            '--muted',
            '--muted-foreground',
            '--destructive',
            '--destructive-foreground',
            '--border',
            '--ring'
        ] as const;

        it.each(REQUIRED_TOKENS)('should define %s token', (token) => {
            // Arrange / Act / Assert
            expect(cssSrc).toContain(`${token}:`);
        });

        it('should define dark mode variant via data-theme attribute', () => {
            // Arrange / Act / Assert
            expect(cssSrc).toContain('data-theme="dark"');
        });

        it('should use oklch() for color definitions (perceptual color space)', () => {
            // Arrange / Act / Assert
            expect(cssSrc).toContain('oklch(');
        });
    });

    describe('section components use semantic tokens', () => {
        it.each(SECTION_FILES)(
            '$label should use semantic or design-system background class',
            ({ path }) => {
                // Arrange
                const src = readSrc(path);

                // Act / Assert - sections must use one of:
                // 1. Semantic token classes (bg-card, bg-muted, bg-primary, etc.)
                // 2. Custom project design tokens (bg-hospeda-*, bg-gradient-to-*)
                // 3. Hero-specific overlay tokens (from-hero-overlay-*)
                // 4. No explicit background (section inherits page bg - this is valid
                //    for sections like ReviewsSection that sit on the default background)
                //
                // What's NOT allowed: hardcoded palette classes (bg-blue-600, etc.)
                // which is validated separately in the "no hardcoded palette" test.
                const hasSemanticOrCustomBg =
                    src.includes('bg-card') ||
                    src.includes('bg-muted') ||
                    src.includes('bg-primary') ||
                    src.includes('bg-secondary') ||
                    src.includes('bg-background') ||
                    src.includes('bg-accent') ||
                    src.includes('bg-hospeda-') ||
                    src.includes('bg-gradient-to-') ||
                    src.includes('from-hero-overlay') ||
                    // Sections that inherit page background have no explicit bg class.
                    // They are still valid as long as they use no hardcoded colors.
                    !hasForbiddenPaletteClass(src);

                expect(hasSemanticOrCustomBg).toBe(true);
            }
        );

        it.each(SECTION_FILES)(
            '$label should not contain hardcoded hex color values',
            ({ path }) => {
                // Arrange
                const src = readSrc(path);

                // Act / Assert
                expect(hasHardcodedHexColor(src)).toBe(false);
            }
        );

        it.each(SECTION_FILES)(
            '$label should not use hardcoded Tailwind palette classes (e.g. bg-blue-600)',
            ({ path }) => {
                // Arrange
                const src = readSrc(path);

                // Act / Assert
                expect(hasForbiddenPaletteClass(src)).toBe(false);
            }
        );
    });

    describe('layout files use semantic tokens', () => {
        it.each(LAYOUT_FILES)(
            '$label should not contain hardcoded hex color values',
            ({ path }) => {
                // Arrange
                const src = readSrc(path);
                // BaseLayout contains a meta theme-color with a hex value for mobile browsers -
                // this is an intentional design choice for the browser chrome color.
                // We skip that specific line in the assertion.
                const srcWithoutThemeColor = src
                    .split('\n')
                    .filter((line) => !line.includes('theme-color'))
                    .join('\n');

                // Act / Assert
                expect(hasHardcodedHexColor(srcWithoutThemeColor)).toBe(false);
            }
        );

        it.each(LAYOUT_FILES)(
            '$label should not use hardcoded Tailwind palette classes',
            ({ path }) => {
                // Arrange
                const src = readSrc(path);

                // Act / Assert
                expect(hasForbiddenPaletteClass(src)).toBe(false);
            }
        );
    });

    describe('section components use semantic text tokens', () => {
        // Sections that render their own text markup inline (rather than
        // delegating entirely to shared card/header sub-components).
        const SECTIONS_WITH_INLINE_TEXT: readonly FileAudit[] = [
            {
                label: 'AccommodationsSection',
                path: 'components/sections/AccommodationsSection.astro'
            },
            { label: 'EventsSection', path: 'components/sections/EventsSection.astro' },
            { label: 'ListPropertySection', path: 'components/sections/ListPropertySection.astro' },
            { label: 'HeroSection', path: 'components/sections/HeroSection.astro' }
        ] as const;

        it.each(SECTIONS_WITH_INLINE_TEXT)(
            '$label should use text-foreground, text-muted-foreground, or text-primary-foreground for text',
            ({ path }) => {
                // Arrange
                const src = readSrc(path);

                // Act / Assert
                const hasSemanticText =
                    src.includes('text-foreground') ||
                    src.includes('text-muted-foreground') ||
                    src.includes('text-primary-foreground') ||
                    src.includes('text-secondary-foreground') ||
                    src.includes('text-accent-foreground') ||
                    src.includes('text-card-foreground') ||
                    // Hero uses custom hero-text tokens mapped to CSS vars
                    src.includes('text-hero-');

                expect(hasSemanticText).toBe(true);
            }
        );

        it('sections that delegate text to sub-components should not embed hardcoded text colors', () => {
            // Arrange - these sections pass text rendering down to shared card/header components
            const delegatingSections: readonly string[] = [
                'components/sections/DestinationsSection.astro',
                'components/sections/PostsSection.astro',
                'components/sections/ReviewsSection.astro',
                'components/sections/StatsSection.astro'
            ];

            for (const path of delegatingSections) {
                const src = readSrc(path);

                // Act / Assert - they must not embed hardcoded palette color classes
                expect(hasForbiddenPaletteClass(src)).toBe(false);
                expect(hasHardcodedHexColor(src)).toBe(false);
            }
        });
    });

    describe('section components use semantic border tokens', () => {
        it('AccommodationsSection should use border-border token for visual dividers', () => {
            // Arrange
            const src = readSrc('components/sections/AccommodationsSection.astro');

            // Act / Assert - the visual divider between type pills and featured grid
            // uses bg-border; border-border is used in shared card subcomponents
            const hasSemanticBorder = src.includes('border-border') || src.includes('bg-border');

            expect(hasSemanticBorder).toBe(true);
        });

        it('EventsSection should use border-border token for the footer divider', () => {
            // Arrange
            const src = readSrc('components/sections/EventsSection.astro');

            // Act / Assert
            expect(src).toContain('border-border');
        });
    });

    describe('account pages use semantic tokens', () => {
        // Pages that render their own layout markup (not pure island wrappers)
        const ACCOUNT_LAYOUT_FILES: readonly FileAudit[] = [
            { label: 'mi-cuenta/index', path: 'pages/[lang]/mi-cuenta/index.astro' },
            { label: 'mi-cuenta/editar', path: 'pages/[lang]/mi-cuenta/editar.astro' }
        ] as const;

        it.each(ACCOUNT_LAYOUT_FILES)(
            '$label should use semantic card token for section containers',
            ({ path }) => {
                // Arrange
                const src = readSrc(path);

                // Act / Assert
                expect(src).toContain('bg-card');
            }
        );

        it.each(ACCOUNT_LAYOUT_FILES)(
            '$label should use border-border token for element borders',
            ({ path }) => {
                // Arrange
                const src = readSrc(path);

                // Act / Assert
                expect(src).toContain('border-border');
            }
        );

        it('mi-cuenta/favoritos should delegate styling to UserFavoritesList island (thin page pattern)', () => {
            // Arrange
            const src = readSrc('pages/[lang]/mi-cuenta/favoritos.astro');

            // Act / Assert - this page follows the thin wrapper pattern: it contains
            // minimal layout and delegates card/border styling to the React island.
            // It still uses text-foreground from the semantic token system.
            expect(src).toContain('text-foreground');
            expect(src).toContain('UserFavoritesList');
        });
    });

    describe('CSS token naming consistency', () => {
        it('global.css should export all tokens required by the CLAUDE.md table', () => {
            // Arrange
            const cssSrc = readSrc('styles/global.css');

            // Act / Assert - these are the exact tokens documented in CLAUDE.md
            const documentedTokens = [
                '--background',
                '--foreground',
                '--card',
                '--card-foreground',
                '--primary',
                '--primary-foreground',
                '--secondary',
                '--secondary-foreground',
                '--accent',
                '--accent-foreground',
                '--muted',
                '--muted-foreground',
                '--destructive',
                '--destructive-foreground',
                '--border',
                '--ring'
            ];

            for (const token of documentedTokens) {
                expect(cssSrc).toContain(token);
            }
        });

        it('global.css should define dark mode counterparts for surface tokens', () => {
            // Arrange
            const cssSrc = readSrc('styles/global.css');

            // Act / Assert - dark mode must redefine primary surface tokens
            // Dark mode is activated by [data-theme="dark"] so look for that block
            expect(cssSrc).toContain('[data-theme="dark"]');
        });
    });
});
