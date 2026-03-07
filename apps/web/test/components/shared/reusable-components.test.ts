import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../../src');

function readComponent(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

describe('AccommodationCard uses shared components', () => {
    const content = readComponent('components/shared/AccommodationCard.astro');

    it('should import CategoryBadge', () => {
        expect(content).toContain('import CategoryBadge from');
    });

    it('should import LocationBadge', () => {
        expect(content).toContain('import LocationBadge from');
    });

    it('should import RatingBadge', () => {
        expect(content).toContain('import RatingBadge from');
    });

    it('should import AmenityTag', () => {
        expect(content).toContain('import AmenityTag from');
    });

    it('should NOT have inline type badge markup', () => {
        // The old pattern: <span class="rounded-full ... bg-primary text-primary-foreground">{card.type}</span>
        expect(content).not.toMatch(
            /class="rounded-full.*bg-primary text-primary-foreground">\{card\.type\}/
        );
    });

    it('should NOT import StarIcon or LocationIcon directly', () => {
        expect(content).not.toContain('StarIcon');
        expect(content).not.toContain('LocationIcon');
    });
});

describe('EventCard uses shared components', () => {
    const content = readComponent('components/shared/EventCard.astro');

    it('should import CategoryBadge', () => {
        expect(content).toContain('import CategoryBadge from');
    });

    it('should import LocationBadge', () => {
        expect(content).toContain('import LocationBadge from');
    });

    it('should NOT import LocationIcon directly', () => {
        expect(content).not.toContain('LocationIcon');
    });
});

describe('ReviewCard uses shared components', () => {
    const content = readComponent('components/shared/ReviewCard.astro');

    it('should import StarsDisplay', () => {
        expect(content).toContain('import StarsDisplay from');
    });

    it('should NOT have inline star array pattern', () => {
        expect(content).not.toContain('Array.from({ length: 5 })');
    });

    it('should NOT import StarIcon directly', () => {
        expect(content).not.toContain('StarIcon');
    });
});

describe('FeaturedArticleCard uses shared components', () => {
    const content = readComponent('components/shared/FeaturedArticleCard.astro');

    it('should import PaperFold', () => {
        expect(content).toContain('import PaperFold from');
    });

    it('should import CategoryBadge', () => {
        expect(content).toContain('import CategoryBadge from');
    });

    it('should NOT have inline paper fold div', () => {
        // Old pattern had h-10 w-10 + h-12 w-12 directly
        expect(content).not.toMatch(/class="absolute -bottom-1 -right-1 z-20 h-10 w-10/);
    });
});

describe('SecondaryArticleCard uses shared components', () => {
    const content = readComponent('components/shared/SecondaryArticleCard.astro');

    it('should import PaperFold', () => {
        expect(content).toContain('import PaperFold from');
    });

    it('should import CategoryBadge', () => {
        expect(content).toContain('import CategoryBadge from');
    });

    it('should NOT have inline paper fold div', () => {
        expect(content).not.toMatch(/class="absolute -bottom-1 -right-1 z-20 h-8 w-8/);
    });
});

describe('PostsSection uses GradientButton for CTA', () => {
    const content = readComponent('components/sections/PostsSection.astro');

    it('should import GradientButton', () => {
        expect(content).toContain('import GradientButton from');
    });

    it('should NOT have inline SVG arrow', () => {
        expect(content).not.toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    });
});

describe('DestinationsSection uses GradientButton for CTA', () => {
    const content = readComponent('components/sections/DestinationsSection.astro');

    it('should import GradientButton', () => {
        expect(content).toContain('import GradientButton from');
    });
});

describe('Footer uses WaveDivider instead of inline SVG', () => {
    const content = readComponent('layouts/Footer.astro');

    it('should NOT have inline SVG with viewBox 0 0 1440 60', () => {
        expect(content).not.toContain('<svg viewBox="0 0 1440 60"');
    });

    it('should import WaveDivider', () => {
        expect(content).toContain('import WaveDivider from');
    });

    it('should use WaveDivider component', () => {
        expect(content).toContain('<WaveDivider');
    });
});

describe('Section wave-mask transitions (fixed-height waves via mask-image)', () => {
    it('HeroSection should use wave-bottom-hero mask instead of WaveDivider', () => {
        const content = readComponent('components/sections/HeroSection.astro');
        expect(content).toContain('wave-bottom-hero');
        expect(content).not.toContain('import WaveDivider from');
    });

    it('AccommodationsSection should use wave-bottom-a mask instead of WaveDivider', () => {
        const content = readComponent('components/sections/AccommodationsSection.astro');
        expect(content).toContain('wave-bottom-a');
        expect(content).not.toContain('import WaveDivider from');
    });

    it('DestinationsSection should use wave-bottom-b mask', () => {
        const content = readComponent('components/sections/DestinationsSection.astro');
        expect(content).toContain('wave-bottom-b');
    });

    it('EventsSection should use wave-bottom-c mask', () => {
        const content = readComponent('components/sections/EventsSection.astro');
        expect(content).toContain('wave-bottom-c');
    });

    it('PostsSection should use wave-bottom-d mask instead of WaveDivider', () => {
        const content = readComponent('components/sections/PostsSection.astro');
        expect(content).toContain('wave-bottom-d');
        expect(content).not.toContain('import WaveDivider from');
    });
});

describe('Section z-index stacking order', () => {
    it('HeroSection should have z-[12]', () => {
        const content = readComponent('components/sections/HeroSection.astro');
        expect(content).toContain('z-[12]');
    });

    it('AccommodationsSection should have z-[10] and negative margin', () => {
        const content = readComponent('components/sections/AccommodationsSection.astro');
        expect(content).toContain('z-[10]');
        expect(content).toContain('-mt-10');
    });

    it('DestinationsSection should have z-[8] and negative margin', () => {
        const content = readComponent('components/sections/DestinationsSection.astro');
        expect(content).toContain('z-[8]');
        expect(content).toContain('-mt-10');
    });

    it('EventsSection should have z-[6]', () => {
        const content = readComponent('components/sections/EventsSection.astro');
        expect(content).toContain('z-[6]');
    });

    it('PostsSection should have z-[4]', () => {
        const content = readComponent('components/sections/PostsSection.astro');
        expect(content).toContain('z-[4]');
    });

    it('ReviewsSection should have z-[2]', () => {
        const content = readComponent('components/sections/ReviewsSection.astro');
        expect(content).toContain('z-[2]');
    });

    it('StatsSection should have z-[1]', () => {
        const content = readComponent('components/sections/StatsSection.astro');
        expect(content).toContain('z-[1]');
    });
});

describe('ParallaxDivider always renders waves', () => {
    const content = readComponent('components/shared/ParallaxDivider.astro');

    it('should have default value for topWaveClass', () => {
        expect(content).toMatch(/topWaveClass\s*=\s*"fill-secondary"/);
    });

    it('should have default value for bottomWaveClass', () => {
        expect(content).toMatch(/bottomWaveClass\s*=\s*"fill-background"/);
    });

    it('should always render top wave SVG (not conditional)', () => {
        expect(content).not.toContain('{topWaveClass && (');
    });

    it('should always render bottom wave SVG (not conditional)', () => {
        expect(content).not.toContain('{bottomWaveClass && (');
    });
});

describe('index.astro ParallaxDividers have wave class props', () => {
    const homepageContent = readFileSync(resolve(srcDir, 'pages/[lang]/index.astro'), 'utf8');

    it('should pass topWaveClass to ParallaxDivider', () => {
        expect(homepageContent).toContain('topWaveClass=');
    });

    it('should pass bottomWaveClass to ParallaxDivider', () => {
        expect(homepageContent).toContain('bottomWaveClass=');
    });
});

describe('Obsolete section files removed', () => {
    it('sections/Navbar.astro should not exist', () => {
        expect(existsSync(resolve(srcDir, 'components/sections/Navbar.astro'))).toBe(false);
    });

    it('sections/Footer.astro should not exist', () => {
        expect(existsSync(resolve(srcDir, 'components/sections/Footer.astro'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// StarsDisplay.astro - direct source inspection
// ---------------------------------------------------------------------------
describe('StarsDisplay.astro - Props interface', () => {
    const content = readComponent('components/shared/StarsDisplay.astro');

    it('should define a Props interface', () => {
        expect(content).toContain('interface Props');
    });

    it('should have a required count prop', () => {
        expect(content).toContain('readonly count:');
    });

    it('should have an optional max prop defaulting to 5', () => {
        expect(content).toContain('readonly max?');
        expect(content).toContain('max = 5');
    });

    it('should support sm and md size variants', () => {
        expect(content).toContain('"sm" | "md"');
    });

    it('should default to sm size when no size is specified', () => {
        expect(content).toContain('size = "sm"');
    });
});

describe('StarsDisplay.astro - Star icon rendering', () => {
    const content = readComponent('components/shared/StarsDisplay.astro');

    it('should import StarIcon from @repo/icons', () => {
        expect(content).toContain('StarIcon');
        expect(content).toContain('@repo/icons');
    });

    it('should use fill weight for filled stars', () => {
        expect(content).toContain('"fill"');
    });

    it('should use duotone weight for unfilled stars', () => {
        expect(content).toContain('"duotone"');
    });

    it('should apply text-accent class to filled stars', () => {
        expect(content).toContain('text-accent');
    });

    it('should apply text-muted class to unfilled stars', () => {
        expect(content).toContain('text-muted');
    });

    it('should use Array.from with length = max to generate stars', () => {
        expect(content).toContain('Array.from({ length: max })');
    });
});

describe('StarsDisplay.astro - Size variants', () => {
    const content = readComponent('components/shared/StarsDisplay.astro');

    it('should map sm size to 16px icon size', () => {
        expect(content).toContain('16');
    });

    it('should map md size to 20px icon size', () => {
        expect(content).toContain('20');
    });

    it('should compute iconSize from the size variant', () => {
        expect(content).toContain('iconSize');
    });
});

describe('StarsDisplay.astro - Wrapper element', () => {
    const content = readComponent('components/shared/StarsDisplay.astro');

    it('should render inside a flex container', () => {
        expect(content).toContain('<div class="flex gap-0.5">');
    });

    it('should use gap-0.5 between stars for compact spacing', () => {
        expect(content).toContain('gap-0.5');
    });
});
