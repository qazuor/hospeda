/**
 * HOS-2410 (`docs/guards.md` §4.2, §4.4) — `pnpm help:review`, the only writer
 * of the help lock and of `reviewedAt`, and the anchor hasher it shares with
 * guard (c).
 */

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PORTAL_PAGES_DIR } from '../check-portal-routes';
import { createAnchorHasher } from '../help-anchor-hash';
import { HELP_LOCK_PATH } from '../help-lock';
import { listHelpReviews, reviewHelpArticles } from '../help-review';
import {
    articlePath,
    check,
    cleanTempDirs,
    LATER_DAY,
    predicatesOf,
    put,
    reviewAll,
    sources,
    syntheticRoot
} from './helpers/help-lock-fixture';

afterEach(cleanTempDirs);

/** Two malformed locks built from a valid one: merge conflict markers, and a line failing the schema. */
function malformedLocks(valid: string): ReadonlyArray<readonly [string, string]> {
    const lines = valid.trimEnd().split('\n');
    const conflict = [
        lines[0],
        lines[1],
        '<<<<<<< HEAD',
        lines[2],
        '=======',
        lines[2]?.replace(/"reviewedAt":"[^"]+"/, '"reviewedAt":"2026-11-18"'),
        '>>>>>>> other',
        ...lines.slice(3)
    ].join('\n');
    const schema = valid.replace(/"hash":"[a-f0-9]{64}"/, '"hash":"nope"');
    return [
        ['conflict markers', `${conflict}\n`],
        ['a line failing the schema', schema]
    ];
}

describe('pnpm help:review on a malformed lock (regression)', () => {
    it('refuses to review and leaves the lock and the article untouched', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockFile = path.join(root, HELP_LOCK_PATH);
        for (const [label, text] of malformedLocks(readFileSync(lockFile, 'utf8'))) {
            writeFileSync(lockFile, text);
            const articleBefore = readFileSync(articlePath(root, 'a'), 'utf8');

            // Act
            const result = reviewHelpArticles({
                root,
                ids: ['a'],
                now: LATER_DAY,
                sources: sources()
            });

            // Assert
            expect(result.exitCode, label).toBe(1);
            expect(result.output, label).toContain('does not parse, so it was not touched');
            expect(readFileSync(lockFile, 'utf8'), label).toBe(text);
            expect(readFileSync(articlePath(root, 'a'), 'utf8'), label).toBe(articleBefore);
        }
    });

    it('--list exits 1 and reports the parse error', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const [[, conflict], [, schema]] = malformedLocks(readFileSync(lockFile, 'utf8')) as [
            readonly [string, string],
            readonly [string, string]
        ];

        // Act
        writeFileSync(lockFile, conflict);
        const conflicted = listHelpReviews({ root, sources: sources() });
        writeFileSync(lockFile, schema);
        const invalid = listHelpReviews({ root, sources: sources() });

        // Assert
        expect(conflicted.exitCode).toBe(1);
        expect(conflicted.output).toContain('is not valid JSON');
        expect(invalid.exitCode).toBe(1);
        expect(invalid.output).toMatch(/lock entry 0: hash/);
    });
});

describe('pnpm help:review', () => {
    it('refuses an unknown id and writes nothing', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockBefore = readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8');

        // Act
        const result = reviewHelpArticles({
            root,
            ids: ['a', 'nope'],
            now: LATER_DAY,
            sources: sources()
        });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('unknown article id(s): nope');
        expect(readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8')).toBe(lockBefore);
        expect(readFileSync(articlePath(root, 'a'), 'utf8')).toContain('reviewedAt: "2026-11-17"');
    });

    it('rewrites only the reviewed article: its line, its date, nothing else', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        appendFileSync(path.join(root, PORTAL_PAGES_DIR, 'mi-cuenta/suscripcion.astro'), 'x\n');
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const linesBefore = readFileSync(lockFile, 'utf8').split('\n');
        const cBefore = readFileSync(articlePath(root, 'c'), 'utf8');

        // Act
        const result = reviewHelpArticles({ root, ids: ['a'], now: LATER_DAY, sources: sources() });

        // Assert
        const linesAfter = readFileSync(lockFile, 'utf8').split('\n');
        expect(result.exitCode).toBe(0);
        expect(linesAfter[1]).not.toBe(linesBefore[1]);
        expect(linesAfter.slice(2)).toEqual(linesBefore.slice(2));
        expect(readFileSync(articlePath(root, 'c'), 'utf8')).toBe(cBefore);
        expect(predicatesOf(check(root))).toEqual(['c2']);
    });

    it('writes nothing when the catalog does not build', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const file = articlePath(root, 'b');
        writeFileSync(
            file,
            readFileSync(file, 'utf8').replace('related: ["a","c"]', 'related: ["a","nope"]')
        );
        const lockBefore = readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8');

        // Act
        const result = reviewHelpArticles({ root, ids: ['a'], now: LATER_DAY, sources: sources() });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain('help:review wrote nothing');
        expect(readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8')).toBe(lockBefore);
    });

    it('--list names the articles to re-read and writes nothing', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockBefore = readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8');
        const rows = new Map(sources().keyRows);
        rows.set('entitlement:manage_venue_menu', [
            'manage_venue_menu',
            'vertical',
            'SUM',
            'NONE',
            'COMMERCIAL'
        ]);

        // Act
        const clean = listHelpReviews({ root, sources: sources() });
        const dirty = listHelpReviews({ root, sources: sources({ keyRows: rows }) });

        // Assert
        expect(clean).toEqual({
            exitCode: 0,
            output: 'help:review: every article matches the lock.'
        });
        expect(dirty.exitCode).toBe(0);
        expect(dirty.output).toContain('a: entitlement:manage_venue_menu (changed)');
        expect(dirty.output).toContain('b: entitlement:manage_venue_menu (changed)');
        expect(dirty.output).not.toContain('c:');
        expect(readFileSync(path.join(root, HELP_LOCK_PATH), 'utf8')).toBe(lockBefore);
    });
});

describe('createAnchorHasher', () => {
    it('hashes each anchor kind from its narrow input, and refuses what names nothing', () => {
        // Arrange
        const root = syntheticRoot();
        put(root, 'apps/web/src/components/X.tsx', 'x\n');
        const base = createAnchorHasher({ root, sources: sources() });
        const anchors = [
            'page:mi-cuenta/suscripcion',
            'section:accommodation.fotos',
            'section:accommodation.preguntas-ia',
            'entitlement:manage_venue_menu',
            'limit:max_photos_per_accommodation',
            'enum:PublicationStatus.MODERATED',
            'tool:get_help',
            'activation:venue',
            'activation:partner',
            'file:apps/web/src/components/X.tsx'
        ];

        // Act
        const results = anchors.map((anchor) => base(anchor));

        // Assert
        expect(results.every((result) => result.ok)).toBe(true);
        expect(new Set(results.map((result) => (result.ok ? result.hash : ''))).size).toBe(
            anchors.length
        );
        for (const anchor of [
            'page:mi-cuenta/nope',
            'section:accommodation.nope',
            'tool:nope',
            'limit:nope',
            'enum:PublicationStatus.NOPE',
            'activation:tourist',
            'file:nope.ts'
        ]) {
            expect(base(anchor).ok).toBe(false);
        }
    });

    it('moves a section hash when its catalog entry changes, and an enum hash when a value is added', () => {
        // Arrange
        const root = syntheticRoot();
        const hashBefore = createAnchorHasher({ root, sources: sources() });
        const hashAfter = createAnchorHasher({
            root,
            sources: sources({
                sectionCatalog: new Map([
                    ['accommodation.photos', { id: 'photos', fields: ['photos', 'video'] }]
                ]),
                enums: { PublicationStatus: new Set(['MODERATED', 'PUBLISHED', 'ARCHIVED']) }
            })
        });

        // Act + Assert
        expect(hashAfter('section:accommodation.fotos')).not.toEqual(
            hashBefore('section:accommodation.fotos')
        );
        expect(hashAfter('section:accommodation.preguntas-ia')).toEqual(
            hashBefore('section:accommodation.preguntas-ia')
        );
        expect(hashAfter('enum:PublicationStatus.MODERATED')).not.toEqual(
            hashBefore('enum:PublicationStatus.MODERATED')
        );
        expect(hashAfter('page:mi-cuenta/suscripcion')).toEqual(
            hashBefore('page:mi-cuenta/suscripcion')
        );
    });

    it('keeps a section hash when only its menu order changes (owner decision 2026-11-21)', () => {
        // Arrange
        const root = syntheticRoot();
        const entry = { id: 'photos', order: 3, fields: ['photos'], entitlementKey: 'x' };
        const hashOf = (value: Record<string, unknown>) =>
            createAnchorHasher({
                root,
                sources: sources({ sectionCatalog: new Map([['accommodation.photos', value]]) })
            })('section:accommodation.fotos');
        const base = hashOf(entry);

        // Act
        const reordered = hashOf({ ...entry, order: 7 });
        const withoutOrder = hashOf({ id: 'photos', fields: ['photos'], entitlementKey: 'x' });
        const otherFields = hashOf({ ...entry, fields: ['photos', 'video'] });
        const otherKey = hashOf({ ...entry, entitlementKey: 'y' });

        // Assert
        expect(base.ok).toBe(true);
        expect(reordered).toEqual(base);
        expect(withoutOrder).toEqual(base);
        expect(otherFields).not.toEqual(base);
        expect(otherKey).not.toEqual(base);
    });
});
