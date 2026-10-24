import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
    resolve(process.cwd(), 'src/components/maps/MapCardsSidebar.module.css'),
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
