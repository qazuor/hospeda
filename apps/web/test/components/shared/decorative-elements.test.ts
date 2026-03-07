/**
 * @file decorative-elements.test.ts
 * @description Tests for shared Astro decorative/layout components.
 * Validates Props interfaces, accessibility (aria-hidden), semantic token usage,
 * and structural conventions.
 *
 * Components covered:
 * - BackgroundPattern.astro
 * - DecorativeElement.astro
 * - Illustration.astro
 * - PaperFold.astro
 * - ParallaxDivider.astro
 * - WaveDivider.astro
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sharedDir = resolve(__dirname, '../../../src/components/shared');

const backgroundPattern = readFileSync(resolve(sharedDir, 'BackgroundPattern.astro'), 'utf8');
const decorativeElement = readFileSync(resolve(sharedDir, 'DecorativeElement.astro'), 'utf8');
const illustration = readFileSync(resolve(sharedDir, 'Illustration.astro'), 'utf8');
const paperFold = readFileSync(resolve(sharedDir, 'PaperFold.astro'), 'utf8');
const parallaxDivider = readFileSync(resolve(sharedDir, 'ParallaxDivider.astro'), 'utf8');
const waveDivider = readFileSync(resolve(sharedDir, 'WaveDivider.astro'), 'utf8');

// ---------------------------------------------------------------------------
// BackgroundPattern
// ---------------------------------------------------------------------------
describe('BackgroundPattern.astro', () => {
    it('should define a Props interface', () => {
        expect(backgroundPattern).toContain('interface Props');
    });

    it('should have a pattern prop', () => {
        expect(backgroundPattern).toContain('pattern:');
    });

    it('should have an optional size prop', () => {
        expect(backgroundPattern).toContain('size?:');
    });

    it('should have an optional opacity prop', () => {
        expect(backgroundPattern).toContain('opacity?:');
    });

    it('should mark the element as aria-hidden', () => {
        expect(backgroundPattern).toContain('aria-hidden="true"');
    });

    it('should use absolute inset-0 positioning', () => {
        expect(backgroundPattern).toContain('absolute inset-0');
    });

    it('should use pointer-events-none', () => {
        expect(backgroundPattern).toContain('pointer-events-none');
    });

    it('should set background-image via inline style', () => {
        expect(backgroundPattern).toContain('background-image');
        expect(backgroundPattern).toContain('background-size');
        expect(backgroundPattern).toContain('background-repeat');
    });

    it('should use class:list for conditional classes', () => {
        expect(backgroundPattern).toContain('class:list');
    });
});

// ---------------------------------------------------------------------------
// DecorativeElement
// ---------------------------------------------------------------------------
describe('DecorativeElement.astro', () => {
    it('should define a Props interface', () => {
        expect(decorativeElement).toContain('interface Props');
    });

    it('should have a src prop', () => {
        expect(decorativeElement).toContain('src:');
    });

    it('should have a position prop', () => {
        expect(decorativeElement).toContain('position:');
    });

    it('should have optional size, opacity, rotate props', () => {
        expect(decorativeElement).toContain('size?:');
        expect(decorativeElement).toContain('opacity?:');
        expect(decorativeElement).toContain('rotate?:');
    });

    it('should have a flip prop for mirroring', () => {
        expect(decorativeElement).toContain('flip');
    });

    it('should have an objectContain prop', () => {
        expect(decorativeElement).toContain('objectContain');
    });

    it('should mark img elements as aria-hidden', () => {
        expect(decorativeElement).toContain('aria-hidden="true"');
    });

    it('should render images with empty alt for decorative purpose', () => {
        expect(decorativeElement).toContain('alt=""');
    });

    it('should use absolute positioning', () => {
        expect(decorativeElement).toContain('absolute');
    });

    it('should use pointer-events-none', () => {
        expect(decorativeElement).toContain('pointer-events-none');
    });

    it('should apply -scale-x-100 when flip is true', () => {
        expect(decorativeElement).toContain('-scale-x-100');
    });

    it('should use class:list for conditional classes', () => {
        expect(decorativeElement).toContain('class:list');
    });
});

// ---------------------------------------------------------------------------
// Illustration
// ---------------------------------------------------------------------------
describe('Illustration.astro', () => {
    it('should define a Props interface', () => {
        expect(illustration).toContain('interface Props');
    });

    it('should have a src prop', () => {
        expect(illustration).toContain('src:');
    });

    it('should have a position prop', () => {
        expect(illustration).toContain('position:');
    });

    it('should have an optional size prop', () => {
        expect(illustration).toContain('size?:');
    });

    it('should mark img as aria-hidden', () => {
        expect(illustration).toContain('aria-hidden="true"');
    });

    it('should render img with empty alt for decorative purpose', () => {
        expect(illustration).toContain('alt=""');
    });

    it('should use absolute positioning', () => {
        expect(illustration).toContain('absolute');
    });

    it('should use pointer-events-none', () => {
        expect(illustration).toContain('pointer-events-none');
    });

    it('should use object-contain for image fitting', () => {
        expect(illustration).toContain('object-contain');
    });

    it('should use class:list for conditional classes', () => {
        expect(illustration).toContain('class:list');
    });
});

// ---------------------------------------------------------------------------
// PaperFold
// ---------------------------------------------------------------------------
describe('PaperFold.astro', () => {
    it('should define a Props interface', () => {
        expect(paperFold).toContain('interface Props');
    });

    it('should declare size prop as readonly', () => {
        expect(paperFold).toContain('readonly size?:');
    });

    it('should support sm and md size variants', () => {
        expect(paperFold).toContain('"sm" | "md"');
    });

    it('should have aria-hidden since it is purely decorative', () => {
        expect(paperFold).toContain('aria-hidden="true"');
    });

    it('should use absolute positioning', () => {
        expect(paperFold).toContain('absolute');
    });

    it('should use semantic muted token for gradient', () => {
        expect(paperFold).toContain('from-muted');
        expect(paperFold).toContain('via-muted');
    });

    it('should vary sizes based on the size prop', () => {
        expect(paperFold).toContain('outerSize');
        expect(paperFold).toContain('innerSize');
    });

    it('should use class:list for conditional sizing', () => {
        expect(paperFold).toContain('class:list');
    });

    it('should use rotate-45 for the fold illusion', () => {
        expect(paperFold).toContain('rotate-45');
    });
});

// ---------------------------------------------------------------------------
// ParallaxDivider
// ---------------------------------------------------------------------------
describe('ParallaxDivider.astro', () => {
    it('should define a Props interface', () => {
        expect(parallaxDivider).toContain('interface Props');
    });

    it('should have required image prop', () => {
        expect(parallaxDivider).toContain('image:');
    });

    it('should have required title prop', () => {
        expect(parallaxDivider).toContain('title:');
    });

    it('should have required subtitle prop', () => {
        expect(parallaxDivider).toContain('subtitle:');
    });

    it('should have optional topWaveClass and bottomWaveClass props', () => {
        expect(parallaxDivider).toContain('topWaveClass?:');
        expect(parallaxDivider).toContain('bottomWaveClass?:');
    });

    it('should have an optional variant prop', () => {
        expect(parallaxDivider).toContain('variant?:');
    });

    it('should mark the background image div as aria-hidden', () => {
        expect(parallaxDivider).toContain('aria-hidden="true"');
    });

    it('should use semantic fill-secondary as default top wave class', () => {
        expect(parallaxDivider).toContain('fill-secondary');
    });

    it('should use semantic fill-background as default bottom wave class', () => {
        expect(parallaxDivider).toContain('fill-background');
    });

    it('should use semantic text-primary-foreground for the title', () => {
        expect(parallaxDivider).toContain('text-primary-foreground');
    });

    it('should render title and subtitle props in content', () => {
        expect(parallaxDivider).toContain('{title}');
        expect(parallaxDivider).toContain('{subtitle}');
    });

    it('should render as a section element', () => {
        expect(parallaxDivider).toContain('<section');
    });

    it('should have multiple predefined wave variants', () => {
        expect(parallaxDivider).toContain('cloud1');
        expect(parallaxDivider).toContain('cloud2');
        expect(parallaxDivider).toContain('cloud3');
    });

    it('should use SVG for wave paths', () => {
        expect(parallaxDivider).toContain('<svg');
        expect(parallaxDivider).toContain('viewBox');
    });
});

// ---------------------------------------------------------------------------
// WaveDivider
// ---------------------------------------------------------------------------
describe('WaveDivider.astro', () => {
    it('should define a Props interface', () => {
        expect(waveDivider).toContain('interface Props');
    });

    it('should declare path prop as readonly', () => {
        expect(waveDivider).toContain('readonly path:');
    });

    it('should declare fillClass prop as readonly', () => {
        expect(waveDivider).toContain('readonly fillClass?:');
    });

    it('should declare position prop as readonly', () => {
        expect(waveDivider).toContain('readonly position?:');
    });

    it('should declare height prop as readonly', () => {
        expect(waveDivider).toContain('readonly height?:');
    });

    it('should declare marginClass prop as readonly', () => {
        expect(waveDivider).toContain('readonly marginClass?:');
    });

    it('should support top, bottom, inline positions', () => {
        expect(waveDivider).toContain('"top" | "bottom" | "inline"');
    });

    it('should default fillClass to fill-background semantic token', () => {
        expect(waveDivider).toContain('fill-background');
    });

    it('should mark SVG as aria-hidden', () => {
        expect(waveDivider).toContain('aria-hidden="true"');
    });

    it('should render an SVG element', () => {
        expect(waveDivider).toContain('<svg');
    });

    it('should use preserveAspectRatio="none" for full-width stretching', () => {
        expect(waveDivider).toContain('preserveAspectRatio="none"');
    });

    it('should apply position classes from a positionClasses map', () => {
        expect(waveDivider).toContain('positionClasses');
    });

    it('should use class:list for conditional positioning', () => {
        expect(waveDivider).toContain('class:list');
    });
});

// ---------------------------------------------------------------------------
// Illustration.astro - additional edge-case and prop tests
// ---------------------------------------------------------------------------
describe('Illustration.astro - default size fallback', () => {
    it('should define a default responsive size when size is omitted', () => {
        // Default size covers h-28 w-28, md:h-40 md:w-40, lg:h-52 lg:w-52
        expect(illustration).toContain('h-28 w-28');
    });

    it('should use responsive Tailwind size modifiers in the default', () => {
        expect(illustration).toContain('md:h-40 md:w-40');
        expect(illustration).toContain('lg:h-52 lg:w-52');
    });
});

describe('Illustration.astro - opacity styling', () => {
    it('should apply reduced opacity on small screens', () => {
        expect(illustration).toContain('opacity-40');
    });

    it('should apply full opacity on medium+ screens', () => {
        expect(illustration).toContain('md:opacity-80');
    });
});

describe('Illustration.astro - wrapper element', () => {
    it('should wrap the img inside a div element', () => {
        expect(illustration).toContain('<div class:list');
    });
});

// ---------------------------------------------------------------------------
// BackgroundPattern.astro - additional structural tests
// ---------------------------------------------------------------------------
describe('BackgroundPattern.astro - inline style attributes', () => {
    it('should set background-image from the pattern prop', () => {
        expect(backgroundPattern).toContain("url('${pattern}')");
    });

    it('should set background-size from the size prop', () => {
        expect(backgroundPattern).toContain('${size}');
    });

    it('should default to 60px 60px for background-size', () => {
        expect(backgroundPattern).toContain('60px 60px');
    });

    it('should always apply background-repeat: repeat', () => {
        expect(backgroundPattern).toContain('background-repeat: repeat');
    });
});

describe('BackgroundPattern.astro - default opacity', () => {
    it('should default opacity class to opacity-50', () => {
        expect(backgroundPattern).toContain('opacity-50');
    });
});

// ---------------------------------------------------------------------------
// Illustration image files exist in public/images/
// ---------------------------------------------------------------------------
describe('Illustration image files exist in public/images/', () => {
    const publicImagesDir = resolve(__dirname, '../../../public/images');

    it('should have ilustracion-anfitriones.svg', () => {
        expect(existsSync(resolve(publicImagesDir, 'ilustracion-anfitriones.svg'))).toBe(true);
    });

    it('should have ilustracion-buscar-alojamiento.svg', () => {
        expect(existsSync(resolve(publicImagesDir, 'ilustracion-buscar-alojamiento.svg'))).toBe(
            true
        );
    });

    it('should have ilustracion-destinos.svg', () => {
        expect(existsSync(resolve(publicImagesDir, 'ilustracion-destinos.svg'))).toBe(true);
    });

    it('should have ilustracion-eventos.svg', () => {
        expect(existsSync(resolve(publicImagesDir, 'ilustracion-eventos.svg'))).toBe(true);
    });

    it('should have ilustracion-notas.svg', () => {
        expect(existsSync(resolve(publicImagesDir, 'ilustracion-notas.svg'))).toBe(true);
    });

    it('should have ilustracion-publica-alojamiento.svg', () => {
        expect(existsSync(resolve(publicImagesDir, 'ilustracion-publica-alojamiento.svg'))).toBe(
            true
        );
    });

    it('should have ilustracion-reviews.svg', () => {
        expect(existsSync(resolve(publicImagesDir, 'ilustracion-reviews.svg'))).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// DecorativeElement.astro - scale-x flip behaviour
// ---------------------------------------------------------------------------
describe('DecorativeElement.astro - flip transform', () => {
    it('should use -scale-x-100 to mirror image when flip is true', () => {
        expect(decorativeElement).toContain('-scale-x-100');
    });

    it('should conditionally include the flip class using class:list', () => {
        // The flip condition appears inside the class:list array
        expect(decorativeElement).toContain('flip');
    });
});

// ---------------------------------------------------------------------------
// PaperFold.astro - additional structural tests
// ---------------------------------------------------------------------------
describe('PaperFold.astro - inner/outer element sizing', () => {
    it('should derive outerSize and innerSize from the size variant', () => {
        expect(paperFold).toContain('outerSize');
        expect(paperFold).toContain('innerSize');
    });
});

describe('PaperFold.astro - gradient composition', () => {
    it('should compose from-muted and via-muted gradient tokens', () => {
        expect(paperFold).toContain('from-muted');
        expect(paperFold).toContain('via-muted');
    });
});
