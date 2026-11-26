import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { describe, expect, it } from 'vitest';
import fixture from '../src/data/user/example/006-user-laura-vega.json';

describe('Laura Vega editorial bio', () => {
    it('ships the same public bio in the fresh seed and the guarded backfill', () => {
        const migrationUrl = new URL(
            '../src/data-migrations/0199-hos2654-laura-vega-editorial-bio.ts',
            import.meta.url
        );

        const migration = readFileSync(migrationUrl, 'utf8');

        expect(migration).toContain(`name: '${basename(migrationUrl.pathname, '.ts')}'`);
        expect(fixture.profile.bio).toContain('termas de Federación');
        expect(migration).toContain(fixture.profile.bio);
        expect(migration).toContain("eq(users.slug, 'laura-vega')");
        expect(migration).toContain(`->>'bio' = \${oldBio}`);
    });
});
