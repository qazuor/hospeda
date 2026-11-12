import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', '..', '..', 'src');

/** Removes comments so dead wiring cannot satisfy the guard. */
function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('HOS-1718 listing featured sync composition is wired', () => {
    it('index.ts calls subscribeListingFeaturedSync outside comments', () => {
        // Arrange
        const source = withoutComments(readFileSync(join(SRC, 'index.ts'), 'utf8'));
        // Act
        const wired = /(?<![\w$])subscribeListingFeaturedSync\s*\(/.test(source);
        // Assert
        expect(wired).toBe(true);
    });

    it('reconciler-ports.ts declares featured', () => {
        // Arrange
        const source = readFileSync(
            join(SRC, 'utils', 'listing-publication', 'reconciler-ports.ts'),
            'utf8'
        );
        // Act
        const wired = /\bfeatured\s*:\s*\{\s*reader:\s*planCatalogModel/.test(source);
        // Assert
        expect(wired).toBe(true);
    });
});
