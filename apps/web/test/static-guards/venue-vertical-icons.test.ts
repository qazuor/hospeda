import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const verticalIconSources = [
    '../../src/pages/[lang]/planes/comer-y-salir/precios/index.astro',
    '../../src/pages/[lang]/publicar/comer-y-salir/index.astro',
    '../../src/lib/billing/audience-card-content.ts',
    '../../src/pages/[lang]/beneficios/index.astro',
    '../../src/components/billing/comparison-row-icons.ts'
] as const;

describe('venue vertical icon assignments', () => {
    it('uses VenueIcon and never ForkKnifeIcon for each vertical surface', () => {
        for (const relativePath of verticalIconSources) {
            const source = readFileSync(resolve(__dirname, relativePath), 'utf8');
            const iconImports = source.match(
                /import\s*\{[^}]+\}\s*from\s*['"]@repo\/icons['"]/s
            )?.[0];

            expect(iconImports, relativePath).toContain('VenueIcon');
            expect(iconImports, relativePath).not.toContain('ForkKnifeIcon');
        }
    });
});
