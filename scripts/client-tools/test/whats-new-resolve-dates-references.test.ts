import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    intersectPendingIds,
    parseReferenceFiles
} from '../src/commands/whats-new/resolve-dates-cli.ts';
import {
    collectPendingMarkerIds,
    resolvePublishedAtMarkers
} from '../src/commands/whats-new/resolve-dates.ts';

/**
 * Regression suite for the 2026-09-30/10-01 incident: every Dependabot
 * security merge to `main` re-ran the resolver over markers `staging` had
 * already dated (#3386), opening five redundant PRs (#3432, #3435, #3439,
 * #3441, #3442) that would have overwritten real dates with hotfix times.
 */

const MERGED_AT = '2026-10-01T05:00:00Z';

/** Builds a catalog whose entries carry the given `publishedAt` per id, newest first. */
function catalog({
    entries
}: {
    readonly entries: readonly (readonly [id: string, publishedAt: string])[];
}): string {
    const body = entries
        .map(([id, publishedAt]) => `    {\n        id: '${id}',\n        publishedAt: '${publishedAt}'\n    }`)
        .join(',\n');
    return `/** publishedAt: 'on-promotion' in prose is never an entry. */\nexport const whatsNewEntries = [\n${body}\n];\n`;
}

const MARKER = 'on-promotion';

describe('collectPendingMarkerIds', () => {
    it('returns only the ids still carrying the marker, ignoring the docblock', () => {
        // Arrange
        const content = catalog({
            entries: [
                ['new-a', MARKER],
                ['dated-b', '2026-09-23T15:25:19Z'],
                ['new-c', MARKER]
            ]
        });

        // Act
        const ids = collectPendingMarkerIds({ content });

        // Assert
        expect([...ids]).toStrictEqual(['new-a', 'new-c']);
    });
});

describe('resolvePublishedAtMarkers with onlyIds', () => {
    it('resolves NOTHING on a hotfix push when staging already dated every marker main still has', () => {
        // Arrange — main lags staging: its markers were dated on staging by #3386.
        const main = catalog({ entries: [['old-a', MARKER], ['old-b', MARKER]] });
        const staging = catalog({
            entries: [
                ['old-a', '2026-09-23T15:25:19Z'],
                ['old-b', '2026-09-23T14:25:19Z']
            ]
        });
        const onlyIds = intersectPendingIds({ referenceContents: [staging] });

        // Act
        const result = resolvePublishedAtMarkers({ content: main, mergedAt: MERGED_AT, onlyIds });

        // Assert
        expect(result.resolvedCount).toBe(0);
        expect(result.updatedContent).toBe(main);
        expect(result.skippedIds).toStrictEqual(['old-a', 'old-b']);
    });

    it('on a real promotion resolves only the new markers, starting at the merge time with no gap for skipped ones', () => {
        // Arrange — `new-x` sits between two already-dated entries.
        const main = catalog({
            entries: [
                ['new-w', MARKER],
                ['old-a', MARKER],
                ['new-x', MARKER]
            ]
        });
        const staging = catalog({
            entries: [
                ['new-w', MARKER],
                ['old-a', '2026-09-23T15:25:19Z'],
                ['new-x', MARKER]
            ]
        });
        const onlyIds = intersectPendingIds({ referenceContents: [staging] });

        // Act
        const result = resolvePublishedAtMarkers({ content: main, mergedAt: MERGED_AT, onlyIds });

        // Assert
        expect(result.resolvedIds).toStrictEqual(['new-w', 'new-x']);
        expect(result.skippedIds).toStrictEqual(['old-a']);
        expect(result.updatedContent).toContain("id: 'new-w',\n        publishedAt: '2026-10-01T05:00:00Z'");
        expect(result.updatedContent).toContain("id: 'new-x',\n        publishedAt: '2026-10-01T04:00:00Z'");
        expect(result.updatedContent).toContain("id: 'old-a',\n        publishedAt: 'on-promotion'");
    });

    it('skips a marker an open resolve-dates PR is already dating, even if staging still has it pending', () => {
        // Arrange — second push to main before the first resolve PR merged (#3384/#3385).
        const main = catalog({ entries: [['new-w', MARKER]] });
        const staging = catalog({ entries: [['new-w', MARKER]] });
        const openPr = catalog({ entries: [['new-w', '2026-09-30T17:31:18Z']] });
        const onlyIds = intersectPendingIds({ referenceContents: [staging, openPr] });

        // Act
        const result = resolvePublishedAtMarkers({ content: main, mergedAt: MERGED_AT, onlyIds });

        // Assert
        expect(result.resolvedCount).toBe(0);
        expect(result.skippedIds).toStrictEqual(['new-w']);
    });

    it('skips a marker whose entry no longer exists on staging', () => {
        // Arrange — staging dropped the entry (like the 33 the owner rejected).
        const main = catalog({ entries: [['dropped', MARKER]] });
        const staging = catalog({ entries: [['other', '2026-09-01T00:00:00Z']] });
        const onlyIds = intersectPendingIds({ referenceContents: [staging] });

        // Act
        const result = resolvePublishedAtMarkers({ content: main, mergedAt: MERGED_AT, onlyIds });

        // Assert
        expect(result.resolvedCount).toBe(0);
        expect(result.skippedIds).toStrictEqual(['dropped']);
    });

    it('skips a marker with no readable id when filtering, since it cannot be matched', () => {
        // Arrange
        const content = "export const whatsNewEntries = [\n    { publishedAt: 'on-promotion' }\n];\n";

        // Act
        const result = resolvePublishedAtMarkers({
            content,
            mergedAt: MERGED_AT,
            onlyIds: new Set(['anything'])
        });

        // Assert
        expect(result.resolvedCount).toBe(0);
        expect(result.skippedIds).toStrictEqual(['(unknown id)']);
    });

    it('resolves every marker and skips none when onlyIds is omitted (local manual run)', () => {
        // Arrange
        const content = catalog({ entries: [['a', MARKER], ['b', MARKER]] });

        // Act
        const result = resolvePublishedAtMarkers({ content, mergedAt: MERGED_AT });

        // Assert
        expect(result.resolvedIds).toStrictEqual(['a', 'b']);
        expect(result.skippedIds).toStrictEqual([]);
    });
});

describe('intersectPendingIds', () => {
    it('throws on zero references instead of returning an empty allow-list', () => {
        expect(() => intersectPendingIds({ referenceContents: [] })).toThrow();
    });
});

describe('parseReferenceFiles', () => {
    it('returns undefined when the variable is unset', () => {
        expect(parseReferenceFiles({ envValue: undefined })).toBeUndefined();
    });

    it('splits on newlines and drops blank lines', () => {
        expect(parseReferenceFiles({ envValue: '/a/staging.ts\n\n  /b/pr.ts  \n' })).toStrictEqual([
            '/a/staging.ts',
            '/b/pr.ts'
        ]);
    });

    it('throws when set but naming no file, so a broken workflow step fails closed', () => {
        expect(() => parseReferenceFiles({ envValue: '  \n ' })).toThrow();
    });
});

describe('resolve-dates CLI with REFERENCE_FILES', () => {
    const cli = join(import.meta.dir, '../src/commands/whats-new/resolve-dates-cli.ts');

    function run({ env }: { readonly env: Record<string, string> }) {
        return Bun.spawnSync(['bun', 'run', cli], {
            env: { PATH: process.env.PATH ?? '', ...env },
            stdout: 'pipe',
            stderr: 'pipe'
        });
    }

    it('leaves the catalog untouched when staging already dated every marker', () => {
        // Arrange
        const dir = mkdtempSync(join(tmpdir(), 'whats-new-refs-'));
        const mainFile = join(dir, 'main.ts');
        const stagingFile = join(dir, 'staging.ts');
        const main = catalog({ entries: [['old-a', MARKER]] });
        writeFileSync(mainFile, main);
        writeFileSync(stagingFile, catalog({ entries: [['old-a', '2026-09-23T15:25:19Z']] }));

        // Act
        const result = run({
            env: { MERGED_AT, WHATS_NEW_FILE: mainFile, REFERENCE_FILES: stagingFile }
        });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout.toString()).toContain('resolved_count=0');
        expect(readFileSync(mainFile, 'utf8')).toBe(main);
    });

    it('fails, without touching the catalog, when a reference file is missing', () => {
        // Arrange
        const dir = mkdtempSync(join(tmpdir(), 'whats-new-refs-'));
        const mainFile = join(dir, 'main.ts');
        const main = catalog({ entries: [['new-a', MARKER]] });
        writeFileSync(mainFile, main);

        // Act
        const result = run({
            env: { MERGED_AT, WHATS_NEW_FILE: mainFile, REFERENCE_FILES: join(dir, 'missing.ts') }
        });

        // Assert
        expect(result.exitCode).not.toBe(0);
        expect(readFileSync(mainFile, 'utf8')).toBe(main);
    });
});
