/**
 * @file ImageGallery.lightbox-scrim.source.test.ts
 * @description The image lightbox scrim is darker than the shared modal scrim,
 * so the white caption and description stay readable (owner smoke, HOS-2520).
 *
 * jsdom cannot compute contrast, so this guards the structure. The lightbox
 * Dialog passes a dedicated overlay class, and that class sets an opaque-enough
 * black. The caption text is also brighter than the old 0.7/0.75 alphas.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CSS = readFileSync(
    resolve(__dirname, '../../src/components/ImageGallery.module.css'),
    'utf8'
);
const TSX = readFileSync(
    resolve(__dirname, '../../src/components/ImageGallery.client.tsx'),
    'utf8'
);

/** Returns the body of the first rule whose selector matches `selector` exactly. */
function ruleBody({ selector }: { readonly selector: string }): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = CSS.match(new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    return match?.[2] ?? '';
}

/** Extracts the alpha of the first `oklch(L C H / A)` color in `body`. */
function alphaOf({ body, property }: { readonly body: string; readonly property: string }): number {
    const match = body.match(new RegExp(`${property}:\\s*oklch\\([^/]+/\\s*([0-9.]+)\\)`));
    return match?.[1] ? Number(match[1]) : Number.NaN;
}

describe('ImageGallery lightbox scrim', () => {
    it('passes a dedicated overlay class to the lightbox Dialog', () => {
        // Arrange
        const dialogOpen = TSX.match(/<Dialog\b[^>]*variant="transparent"[^>]*>/s)?.[0] ?? '';

        // Assert
        expect(dialogOpen).toContain('overlayClassName={styles.lightboxOverlay}');
    });

    it('darkens the lightbox scrim to at least 0.9 black, above the shared 0.7', () => {
        // Arrange
        const body = ruleBody({ selector: '.lightboxOverlay.lightboxOverlay' });

        // Act
        const alpha = alphaOf({ body, property: 'background-color' });

        // Assert
        expect(body).toMatch(/background-color:\s*oklch\(0 0 0 \//);
        expect(alpha).toBeGreaterThanOrEqual(0.9);
    });

    it('keeps the caption and description bright enough over the scrim', () => {
        // Act
        const caption = alphaOf({
            body: ruleBody({ selector: '.lightboxCaption' }),
            property: 'color'
        });
        const description = alphaOf({
            body: ruleBody({ selector: '.lightboxDescription' }),
            property: 'color'
        });

        // Assert
        expect(caption).toBeGreaterThanOrEqual(0.85);
        expect(description).toBeGreaterThanOrEqual(0.85);
    });
});
