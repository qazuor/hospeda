import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    new URL('../../../src/components/maps/MapCardsSidebar.module.css', import.meta.url),
    'utf8'
);

describe('MapCardsSidebar dock trigger styles', () => {
    it('keeps the desktop fixed fallback and makes the mobile dock trigger static', () => {
        expect(css).toMatch(/\.sheetTrigger\s*\{[^}]*position:\s*fixed/);
        const mobile = css.match(/@media \(max-width: 767px\)\s*\{([\s\S]*?)(?=\n\})/);
        expect(mobile?.[1]).toMatch(/\.sheetTrigger\s*\{[^}]*display:\s*none/s);
        expect(mobile?.[1]).toMatch(
            /:global\(\[data-mobile-dock\]\) \.sheetTrigger\s*\{[^}]*position:\s*static/s
        );
    });
});
