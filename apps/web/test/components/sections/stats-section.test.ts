/**
 * @file stats-section.test.ts
 * @description Focused tests for StatsSection.astro and its supporting data layer.
 *
 * Covers: Props interface, i18n translation keys, imported components,
 * data binding against STATS array, layout tokens, decorative element
 * usage, scroll-reveal animation hook, and semantic token compliance.
 *
 * Also covers the STATS static data array shape and the StatCard source file
 * to verify the section composes correctly.
 *
 * Strategy: source-file reading via readFileSync.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sectionsDir = resolve(__dirname, '../../../src/components/sections');
const sharedDir = resolve(__dirname, '../../../src/components/shared');
const dataDir = resolve(__dirname, '../../../src/data');

const sectionSrc = readFileSync(resolve(sectionsDir, 'StatsSection.astro'), 'utf8');
const statCardSrc = readFileSync(resolve(sharedDir, 'StatCard.astro'), 'utf8');
const statsDataSrc = readFileSync(resolve(dataDir, 'stats.ts'), 'utf8');

// ---------------------------------------------------------------------------
// StatsSection.astro - Props interface
// ---------------------------------------------------------------------------

describe('StatsSection.astro - Props interface', () => {
    it('should define a Props interface', () => {
        // Arrange / Act / Assert
        expect(sectionSrc).toContain('interface Props');
    });

    it('should declare locale as a readonly optional prop', () => {
        expect(sectionSrc).toContain('readonly locale?');
    });

    it('should default the locale to "es" for the Argentina market', () => {
        expect(sectionSrc).toContain("locale = 'es'");
    });
});

// ---------------------------------------------------------------------------
// StatsSection.astro - i18n integration
// ---------------------------------------------------------------------------

describe('StatsSection.astro - i18n integration', () => {
    it('should import createT from @/lib/i18n', () => {
        expect(sectionSrc).toContain('createT');
        expect(sectionSrc).toContain('@/lib/i18n');
    });

    it('should create a translation function with the locale prop', () => {
        expect(sectionSrc).toContain('createT(locale)');
    });

    it('should translate the section title via home.statistics.title', () => {
        expect(sectionSrc).toContain("t('home.statistics.title'");
    });

    it('should translate the section subtitle via home.statistics.subtitle', () => {
        expect(sectionSrc).toContain("t('home.statistics.subtitle'");
    });

    it('should provide a Spanish fallback for the title', () => {
        expect(sectionSrc).toContain("'Entre Rios en numeros'");
    });

    it('should provide a Spanish fallback for the subtitle', () => {
        expect(sectionSrc).toContain('La comunidad de turismo');
    });
});

// ---------------------------------------------------------------------------
// StatsSection.astro - Imported components
// ---------------------------------------------------------------------------

describe('StatsSection.astro - Imported components', () => {
    it('should import StatCard from shared components', () => {
        expect(sectionSrc).toContain('StatCard');
    });

    it('should import SectionHeader from shared components', () => {
        expect(sectionSrc).toContain('SectionHeader');
    });

    it('should import BackgroundPattern for the section background texture', () => {
        expect(sectionSrc).toContain('BackgroundPattern');
    });

    it('should import DecorativeElement for illustrative flourishes', () => {
        expect(sectionSrc).toContain('DecorativeElement');
    });
});

// ---------------------------------------------------------------------------
// StatsSection.astro - STATS data binding
// ---------------------------------------------------------------------------

describe('StatsSection.astro - STATS data binding', () => {
    it('should import STATS from the data layer', () => {
        expect(sectionSrc).toContain('STATS');
        expect(sectionSrc).toContain('@/data/stats');
    });

    it('should iterate over STATS using .map()', () => {
        expect(sectionSrc).toContain('STATS.map(');
    });

    it('should pass each stat entry to StatCard via the stat prop', () => {
        expect(sectionSrc).toContain('<StatCard stat={stat}');
    });
});

// ---------------------------------------------------------------------------
// StatsSection.astro - Layout and structure
// ---------------------------------------------------------------------------

describe('StatsSection.astro - Layout and structure', () => {
    it('should use a <section> element as the root', () => {
        expect(sectionSrc).toContain('<section');
    });

    it('should set id="stats" for anchor-link navigation', () => {
        expect(sectionSrc).toMatch(/id="stats"/);
    });

    it('should constrain width with max-w-5xl container', () => {
        expect(sectionSrc).toContain('max-w-5xl');
    });

    it('should use a responsive grid layout (grid-cols-2 expanding to 6)', () => {
        expect(sectionSrc).toContain('grid-cols-2');
        expect(sectionSrc).toContain('md:grid-cols-6');
    });

    it('should apply the scroll-reveal class for entrance animation', () => {
        expect(sectionSrc).toContain('scroll-reveal');
    });

    it('should use relative positioning with z-index stacking', () => {
        expect(sectionSrc).toContain('relative z-[1]');
    });
});

// ---------------------------------------------------------------------------
// StatsSection.astro - Semantic token compliance
// ---------------------------------------------------------------------------

describe('StatsSection.astro - Semantic token compliance', () => {
    it('should use bg-muted/30 for the section background (not hardcoded palette)', () => {
        expect(sectionSrc).toContain('bg-muted');
        expect(sectionSrc).not.toContain('bg-gray-');
        expect(sectionSrc).not.toContain('bg-slate-');
    });

    it('should reference decorative SVG assets from the public images directory', () => {
        expect(sectionSrc).toContain('/images/decoratives/');
    });

    it('should use a pattern from the public patterns directory', () => {
        expect(sectionSrc).toContain('/images/patterns/pattern-dots.svg');
    });
});

// ---------------------------------------------------------------------------
// StatsSection.astro - Decorative elements
// ---------------------------------------------------------------------------

describe('StatsSection.astro - Decorative elements', () => {
    it('should include a compass/brujula decorative element', () => {
        expect(sectionSrc).toContain('deco-brujula.svg');
    });

    it('should include wave/olas decorative element at the bottom', () => {
        expect(sectionSrc).toContain('deco-olas.svg');
    });

    it('should include a double-arrow decorative element', () => {
        expect(sectionSrc).toContain('deco-flecha-doble.svg');
    });

    it('should include multi-pins decorative element', () => {
        expect(sectionSrc).toContain('deco-multi-pins.svg');
    });
});

// ---------------------------------------------------------------------------
// STATS data array shape
// ---------------------------------------------------------------------------

describe('stats.ts - Data integrity', () => {
    it('should export STATS as a named constant', () => {
        expect(statsDataSrc).toContain('export const STATS');
    });

    it('should type STATS as readonly Stat[]', () => {
        expect(statsDataSrc).toContain('readonly Stat[]');
    });

    it('should contain 6 stat entries (one per grid column)', () => {
        // Count occurrences of the value key as a proxy for entry count
        const valueMatches = statsDataSrc.match(/value:/g) ?? [];
        expect(valueMatches.length).toBe(6);
    });

    it('should include an accommodations stat with value "120+"', () => {
        expect(statsDataSrc).toContain("value: '120+'");
        expect(statsDataSrc).toContain("label: 'Alojamientos'");
    });

    it('should include a travellers stat with value "15.000+"', () => {
        expect(statsDataSrc).toContain("value: '15.000+'");
        expect(statsDataSrc).toContain("label: 'Viajeros'");
    });

    it('should include a destinations stat with value "25"', () => {
        expect(statsDataSrc).toContain("value: '25'");
        expect(statsDataSrc).toContain("label: 'Destinos'");
    });

    it('should include a rating stat with value "4.8"', () => {
        expect(statsDataSrc).toContain("value: '4.8'");
        expect(statsDataSrc).toContain("label: 'Calificacion'");
    });

    it('should include an events stat with value "50+"', () => {
        expect(statsDataSrc).toContain("value: '50+'");
        expect(statsDataSrc).toContain("label: 'Eventos'");
    });

    it('should include a satisfaction stat with value "98%"', () => {
        expect(statsDataSrc).toContain("value: '98%'");
        expect(statsDataSrc).toContain("label: 'Satisfaccion'");
    });

    it('should import icons from @repo/icons (not inline SVGs)', () => {
        expect(statsDataSrc).toContain("from '@repo/icons'");
    });

    it('should import Stat type with import type (type-only import)', () => {
        expect(statsDataSrc).toContain('import type { Stat }');
    });
});

// ---------------------------------------------------------------------------
// StatCard.astro - Structural correctness
// ---------------------------------------------------------------------------

describe('StatCard.astro - Structural correctness', () => {
    it('should import the Stat type from the data types module', () => {
        expect(statCardSrc).toContain('import type { Stat }');
    });

    it('should define a Props interface accepting a stat prop', () => {
        expect(statCardSrc).toContain('stat: Stat');
    });

    it('should render the stat.value in a prominent heading-level element', () => {
        expect(statCardSrc).toContain('{stat.value}');
    });

    it('should render the stat.label', () => {
        expect(statCardSrc).toContain('{stat.label}');
    });

    it('should render the stat.description', () => {
        expect(statCardSrc).toContain('{stat.description}');
    });

    it('should render the stat.icon component', () => {
        expect(statCardSrc).toContain('stat.icon');
    });

    it('should mark the icon container as aria-hidden (decorative)', () => {
        expect(statCardSrc).toContain('aria-hidden="true"');
    });

    it('should use bg-card semantic token for the card surface', () => {
        expect(statCardSrc).toContain('bg-card');
        expect(statCardSrc).not.toContain('bg-white');
    });

    it('should use text-foreground for the value and label text', () => {
        expect(statCardSrc).toContain('text-foreground');
    });

    it('should use text-muted-foreground for the description text', () => {
        expect(statCardSrc).toContain('text-muted-foreground');
    });

    it('should use bg-primary/10 for the icon background pill', () => {
        expect(statCardSrc).toContain('bg-primary/10');
    });

    it('should use text-primary for the icon color', () => {
        expect(statCardSrc).toContain('text-primary');
    });
});
