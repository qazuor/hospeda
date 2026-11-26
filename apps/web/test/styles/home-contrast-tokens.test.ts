/**
 * Regression tests for the home-page WCAG AA contrast fixes (HOS-2572).
 *
 * Each pair below failed Lighthouse (light theme, 4.5:1) before the fix. The
 * pairs are pinned by token: the AA-safe tokens (`--brand-primary-text`,
 * `--brand-accent-text`) are navy / deep orange in light and the brand colour
 * in dark, and both clear 4.5:1 with `--core-card`. Reverting to the raw brand
 * fills (white text on `--brand-primary` / `--brand-accent`) fails these tests.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../src/components');

/** Declarations of the first rule whose selector is exactly `selector`, comments stripped. */
function declarationsOf({ file, selector }: { file: string; selector: string }): string {
    const css = readFileSync(resolve(SRC, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm'));
    expect(match, `${selector} not found in ${file}`).not.toBeNull();
    return match?.[1] ?? '';
}

describe('home contrast tokens (HOS-2572)', () => {
    it.each([
        ['sections/HeroSection.astro', '.social-proof__badge', 'brand-primary-text'],
        ['sections/SearchBar.module.css', '.button', 'brand-primary-text'],
        ['newsletter/NewsletterForm.module.css', '.submitButton', 'brand-primary-text'],
        ['legal/CookieConsentBanner.module.css', '.btnPrimary', 'brand-accent-text']
    ])('%s %s fills with the AA-safe token --%s and --core-card text', (file, selector, token) => {
        // Act
        const decl = declarationsOf({ file, selector });

        // Assert
        expect(decl).toMatch(new RegExp(`background(?:-color)?:\\s*var\\(--${token}\\)`));
        expect(decl).toMatch(/color:\s*var\(--core-card/);
        expect(decl).not.toMatch(/--primary-foreground|--accent-foreground/);
    });

    it('should colour the cookie "Personalizar" link with --brand-primary-text', () => {
        // Act
        const decl = declarationsOf({
            file: 'legal/CookieConsentBanner.module.css',
            selector: '.btnSecondary'
        });

        // Assert
        expect(decl).toMatch(/color:\s*var\(--brand-primary-text\)/);
    });

    it('should use AA-safe colours for the review card eyebrow and avatar initials', () => {
        // Arrange
        const file = 'shared/cards/ReviewCard.module.css';

        // Act
        const accommodation = declarationsOf({ file, selector: '.entityTypeAccommodation' });
        const destination = declarationsOf({ file, selector: '.entityTypeDestination' });
        const initials = declarationsOf({ file, selector: '.avatarInitials' });

        // Assert
        expect(accommodation).toMatch(/color-mix\(in srgb, var\(--brand-primary-text\)/);
        expect(destination).toMatch(/color-mix\(in srgb, var\(--brand-accent-text\)/);
        expect(initials).toMatch(/color:\s*var\(--brand-primary-text\)/);
    });

    it('should not dim peek review slides below AA (opacity multiplies into text contrast)', () => {
        // Act
        const decl = declarationsOf({
            file: 'sections/TestimonialsCarousel.module.css',
            selector: '.mainSlide'
        });
        const opacity = Number(decl.match(/(?:^|\s)opacity:\s*([\d.]+)/)?.[1]);

        // Assert: 0.92 keeps the muted date at >= 4.6:1 in dark; 0.35 was ~1.8:1.
        expect(opacity).toBeGreaterThanOrEqual(0.9);
    });
});
