import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveHistory, ledgerFingerprint, run } from '../check-venue-retired-word.js';

const ROOT = process.cwd();
const oldWord = ['gastro', 'nomy'].join('');
const oldVisible = ['Gastronom', 'ía'].join('');
const emptyExceptions = {
    a: { files: {}, keys: {} },
    b: { files: {}, keys: {} },
    c: { files: {}, markers: {} },
    d: { files: {} },
    e: { markers: {} }
};

function fixture(
    files: Readonly<Record<string, string>>,
    options: {
        readonly exemptions?: typeof emptyExceptions;
        readonly historyCount?: number;
        readonly historyWordFiles?: number;
    } = {}
) {
    const root = mkdtempSync(join(tmpdir(), 'hospeda-r1-'));
    const exemptions = options.exemptions ?? emptyExceptions;
    const config = {
        $comment: 'fixture',
        exemptions,
        historyCount: options.historyCount ?? 0,
        historyWordFiles: options.historyWordFiles ?? 0,
        ledgerFingerprint: ledgerFingerprint(exemptions)
    };
    const configPath = join(root, 'scripts/guards/venue-retired-word.json');
    mkdirSync(join(root, 'scripts/guards'), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config));
    const paths = Object.keys(files);
    const result = run({ root, files: paths, readFile: (path) => files[path] ?? '' });
    return { result, config, root, files };
}

describe('G-FAC-R1 retired venue word', () => {
    it('accepts a clean injected tree', () => {
        const { result } = fixture({
            'packages/service-core/src/venue.ts': 'export const venue = true;'
        });
        expect(result.exitCode).toBe(0);
        expect(result.violations).toEqual([]);
    });

    it('rejects rule 1 identifiers', () => {
        const { result } = fixture({
            'packages/service-core/src/services/venue/venue.service.ts': `const value = '${oldWord}';`
        });
        expect(result.violations.map(({ rule }) => rule)).toContain(1);
    });

    it('rejects rule 2 retired routes', () => {
        const route = `/${'es'}/${['gastro', 'nomia'].join('')}/listing`;
        const { result } = fixture({ 'apps/web/src/component.tsx': `const path = '${route}';` });
        expect(result.violations.map(({ rule }) => rule)).toContain(2);
    });

    it('rejects rule 3 old cache prefixes and suffixes', () => {
        const { result } = fixture({
            'packages/cache-tags/src/tag.ts': `const tag = '${['gastro', '-slug'].join('')}';`
        });
        expect(result.violations.map(({ rule }) => rule)).toContain(3);
    });

    it('rejects rule 4 retired restaurant routes and addon titles', () => {
        const { result } = fixture({
            'apps/web/src/routes.ts': "const path = '/publicar-restaurante/';"
        });
        expect(result.violations.map(({ rule }) => rule)).toContain(4);
    });

    it('parses locale JSON values for rule 5', () => {
        const source = JSON.stringify({ nav: { probe: oldVisible } });
        const { result } = fixture({ 'packages/i18n/src/locales/es/nav.json': source });
        expect(result.violations.map(({ rule }) => rule)).toContain(5);
    });

    it('rejects a sixth named exemption', () => {
        const exemptions = { ...emptyExceptions, f: { files: {} } } as typeof emptyExceptions;
        const { result } = fixture(
            { 'packages/service-core/src/venue.ts': 'export const venue = true;' },
            { exemptions }
        );
        expect(result.violations.some(({ text }) => text.includes('exactly five'))).toBe(true);
    });

    it('rejects an uncounted legacy marker', () => {
        const source = `const folder = '${oldWord}s'; // legacy-name-allowed: historical object folder`;
        const { result } = fixture({ 'apps/api/src/delete.ts': source });
        expect(result.violations.some(({ text }) => text.includes('marker list expected'))).toBe(
            true
        );
    });

    it('rejects removal of the Cloudinary marker from the counted regex occurrence', () => {
        const exemptions = {
            ...emptyExceptions,
            e: { markers: { 'apps/api/src/routes/media/protected/delete-entity.ts': 2 } }
        };
        const source = `const first = '${oldWord}s'; // legacy-name-allowed: historical folder\nconst second = '${oldWord}s';`;
        const { result } = fixture(
            { 'apps/api/src/routes/media/protected/delete-entity.ts': source },
            { exemptions }
        );
        expect(
            result.violations.some(({ text }) => text.includes('marker count expected 2, found 1'))
        ).toBe(true);
        expect(result.violations.some(({ rule }) => rule === 1)).toBe(true);
    });

    it('rejects a marker with no occurrence on its line', () => {
        const exemptions = {
            ...emptyExceptions,
            e: { markers: { 'apps/api/src/delete.ts': 1 } }
        };
        const { result } = fixture(
            { 'apps/api/src/delete.ts': '// legacy-name-allowed: marker without a legacy token' },
            { exemptions }
        );
        expect(result.violations.some(({ text }) => text.includes('no occurrence'))).toBe(true);
    });

    it('rejects a cache tag built from the old seed key', () => {
        const { result } = fixture({
            'packages/seed/src/venue.ts': `const seedKey = '${oldWord}:' + id;`
        });
        expect(result.violations.some(({ rule }) => rule === 1)).toBe(true);
    });

    it('rejects the old nav value by parsing JSON', () => {
        const source = JSON.stringify({ [oldWord]: oldVisible });
        const { result } = fixture({ 'packages/i18n/src/locales/es/nav.json': source });
        expect(result.violations.some(({ rule }) => rule === 5)).toBe(true);
    });

    it('rejects a theme file removed from its counted exception list', () => {
        const exemptions = {
            ...emptyExceptions,
            a: { files: { 'apps/web/src/lib/facet-slugs.ts': 1 }, keys: {} }
        };
        const file = 'apps/web/src/lib/facet-slugs.ts';
        const { result, config, root, files } = fixture(
            { [file]: `const slug = '${oldWord}';` },
            { exemptions }
        );
        expect(result.exitCode).toBe(0);
        const editedConfig = {
            ...config,
            exemptions: { ...config.exemptions, a: { files: {}, keys: {} } }
        };
        writeFileSync(
            join(root, 'scripts/guards/venue-retired-word.json'),
            JSON.stringify(editedConfig)
        );
        const afterRemoval = run({
            root,
            files: Object.keys(files),
            readFile: (path) => files[path] ?? ''
        });
        expect(afterRemoval.violations.some(({ text }) => text.includes('closed exemption'))).toBe(
            true
        );
    });

    it('rejects changing the counted destination rating dimension', () => {
        const path = 'apps/web/src/components/destination/destination-rating.ts';
        const exemptions = {
            ...emptyExceptions,
            a: { files: { [path]: 1 }, keys: {} }
        };
        const { result } = fixture(
            { [path]: 'const ratingDimensions = { venue: 1 };' },
            { exemptions }
        );
        expect(
            result.violations.some(({ text }) =>
                text.includes('exemption a count expected 1, found 0')
            )
        ).toBe(true);
    });

    it('rejects the home tile identifier', () => {
        const { result } = fixture({
            'apps/web/src/home.ts': `home.categoryTiles.tiles.${oldWord} = true;`
        });
        expect(result.violations.some(({ rule }) => rule === 1)).toBe(true);
    });

    it('checks value literals in edited migration SQL but permits quoted SQL identifiers', () => {
        const bad = fixture({
            'packages/db/src/migrations/0129_catalog.sql': `CHECK (vertical <> '${oldWord}')`
        });
        expect(bad.result.violations.some(({ rule }) => rule === 6)).toBe(true);
        const oldTable = ['gastro', 'nomies'].join('');
        const oldColumn = ['gastro', 'nomy_id'].join('');
        const good = fixture({
            'packages/db/src/migrations/0132_historical.sql': `ALTER TABLE "${oldTable}" RENAME COLUMN "${oldColumn}" TO "venue_id";`
        });
        expect(good.result.violations.some(({ rule }) => rule === 6)).toBe(false);
        const rename = fixture({
            'packages/db/src/migrations/0180_venue_rename.sql': `ALTER TABLE "${oldTable}" RENAME TO "venues";`
        });
        expect(rename.result.violations).toEqual([]);
    });

    it('derives cutover history through a local support import and leaves ordinary tests in scan', () => {
        const migrationTest = 'packages/db/test/integration/cut-migration-over-data.test.ts';
        const support = 'packages/db/test/integration/support/cut-migration.ts';
        const testSource = `import { applyCut } from './support/cut-migration.js'; const entityType = '${oldWord}';`;
        const supportSource = `const journal = loadJournal(); for (const entry of journal.${'entries'}.filter((item) => item.idx < cutIndex)) await apply(entry.tag);`;
        const files = {
            [migrationTest]: testSource,
            [support]: supportSource,
            'packages/db/test/integration/check-seed-dual-write.test.ts': `const fixture = 'packages/seed/src/data-migrations/0001-test'; const x = '${oldWord}';`
        };
        const { result } = fixture(files, { historyCount: 1, historyWordFiles: 1 });
        expect(result.history).toEqual([migrationTest]);
        expect(
            result.violations.some(
                ({ file, rule }) => file.endsWith('check-seed-dual-write.test.ts') && rule === 1
            )
        ).toBe(true);
        const withoutImport = fixture({
            [migrationTest]: `const entityType = '${oldWord}';`,
            [support]: supportSource
        });
        expect(withoutImport.result.history).toEqual([]);
        expect(
            withoutImport.result.violations.some(
                ({ file, rule }) => file === migrationTest && rule === 1
            )
        ).toBe(true);
    });

    it('derives the real history list and fixes its measured counts', () => {
        const files = execFileSync('git', ['ls-files', '-z'], {
            cwd: ROOT,
            maxBuffer: 32 * 1024 * 1024
        })
            .toString()
            .split('\0')
            .filter(Boolean);
        const history = deriveHistory(ROOT, files, (file) =>
            readFileSync(join(ROOT, file), 'utf8')
        );
        const historyWord = history.filter((file) =>
            /gastronom(?:y|ies)|Gastronom(?:y|ies)|GASTRONOM(?:Y|IES)|gastro-/.test(
                readFileSync(join(ROOT, file), 'utf8')
            )
        );
        expect(history.length).toBe(85);
        expect(historyWord.length).toBe(14);
        expect(history).toContain('packages/db/test/integration/cut-migration-over-data.test.ts');
        expect(history).toContain(
            'packages/seed/test/data-migrations/whats-new-seen-ids-rename.integration.test.ts'
        );
        expect(history).toContain('packages/seed/test/venue-cuisine-features.test.ts');
        expect(history).not.toContain('scripts/__tests__/check-seed-dual-write.test.ts');
        expect(history).not.toContain(
            'packages/db/test/integration/legacy-schema-migration-from-empty.test.ts'
        );
    });

    it('wires the guard in package scripts, check:guards, and CI', () => {
        const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
            scripts: Record<string, string>;
        };
        const workflow = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
        expect(packageJson.scripts['check:venue-retired-word']).toBe(
            'tsx scripts/check-venue-retired-word.ts'
        );
        expect(packageJson.scripts['check:guards']).toContain('pnpm check:venue-retired-word');
        expect(workflow).toContain('run: pnpm check:venue-retired-word');
    });
});
