/**
 * HOS-2410 (`docs/guards.md` §4, AC-31, AC-32, AC-34) — guard (c) of the help
 * catalog, change coupling, by mutation. Each test starts from a green
 * synthetic repo (lock written by `help:review` itself) and changes ONE thing,
 * then asserts the predicate that must fail.
 */

import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { HELP_CONTENT_PATH } from '../check-help-catalog';
import { PREDICATE_MESSAGES, run } from '../check-help-lock';
import { PORTAL_PAGES_DIR } from '../check-portal-routes';
import { formatHelpLock, HELP_LOCK_PATH, parseHelpLock } from '../help-lock';
import { reviewHelpArticles } from '../help-review';
import {
    articlePath,
    check,
    cleanTempDirs,
    LATER_DAY,
    predicatesOf,
    REVIEW_DAY,
    reviewAll,
    sources,
    syntheticRoot
} from './helpers/help-lock-fixture';

afterEach(cleanTempDirs);

describe('check-help-lock on the real repo', () => {
    it('is green', () => {
        // Act
        const result = run();

        // Assert
        expect(result.output).toMatch(/^OK GUARD:help-lock: \d+ articles/);
        expect(result.exitCode).toBe(0);
    });

    it('keeps the committed lock in its one-entry-per-line layout', () => {
        // Arrange
        const text = readFileSync(
            path.resolve(import.meta.dirname, '../..', HELP_LOCK_PATH),
            'utf8'
        );

        // Act
        const { entries, problems } = parseHelpLock({ text });

        // Assert
        expect(problems).toEqual([]);
        expect(formatHelpLock({ entries })).toBe(text);
    });
});

describe('checkHelpLock on a synthetic repo', () => {
    it('is green after help:review', () => {
        // Arrange
        const root = syntheticRoot();

        // Act
        const review = reviewAll(root);
        const result = check(root);

        // Assert
        expect(review.exitCode).toBe(0);
        expect(result).toEqual({ violations: [], articleCount: 3 });
    });

    it('fails c2 when an anchored page changes, listing the anchor; help:review fixes it (AC-31)', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        appendFileSync(
            path.join(root, PORTAL_PAGES_DIR, 'mi-cuenta/suscripcion.astro'),
            '<p>new</p>\n'
        );

        // Act
        const before = check(root);
        const review = reviewAll(root, LATER_DAY);
        const after = check(root);

        // Assert
        expect(predicatesOf(before)).toEqual(['c2']);
        expect(before.violations).toHaveLength(3);
        expect(before.violations[0]?.detail).toContain('page:mi-cuenta/suscripcion (changed)');
        expect(before.violations[0]?.detail).toContain('pnpm help:review a');
        expect(review.exitCode).toBe(0);
        expect(after.violations).toEqual([]);
        expect(readFileSync(articlePath(root, 'a'), 'utf8')).toContain('reviewedAt: "2026-11-19"');
    });

    it('fails c2 for EVERY article covering a changed entitlement row, and only those', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const rows = new Map(sources().keyRows);
        rows.set('entitlement:manage_venue_menu', [
            'manage_venue_menu',
            'global',
            'MAX',
            'NONE',
            'COMMERCIAL'
        ]);

        // Act
        const result = check(root, { keyRows: rows });

        // Assert
        expect(predicatesOf(result)).toEqual(['c2']);
        expect(result.violations.map((violation) => violation.articleId).sort()).toEqual([
            'a',
            'b'
        ]);
    });

    it('fails c2 when an anchor is added to the article without a review', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const file = articlePath(root, 'c');
        writeFileSync(
            file,
            readFileSync(file, 'utf8').replace(
                'covers: ["page:mi-cuenta/suscripcion"]',
                'covers: ["page:mi-cuenta/suscripcion","tool:get_help"]'
            )
        );

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c2']);
        expect(result.violations[0]?.detail).toContain('tool:get_help (new in the article)');
    });

    it('fails c2 on a forged entry hash', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const { entries } = parseHelpLock({ text: readFileSync(lockFile, 'utf8') });
        writeFileSync(
            lockFile,
            formatHelpLock({
                entries: entries.map((entry) =>
                    entry.id === 'a' ? { ...entry, hash: '0'.repeat(64) } : entry
                )
            })
        );

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c2']);
        expect(result.violations[0]?.detail).toContain('entry hash');
    });

    it('fails c3 when reviewedAt changes in the frontmatter only (AC-32)', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const file = articlePath(root, 'b');
        writeFileSync(
            file,
            readFileSync(file, 'utf8').replace(
                'reviewedAt: "2026-11-17"',
                'reviewedAt: "2026-11-18"'
            )
        );

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c3']);
        expect(result.violations[0]?.articleId).toBe('b');
    });

    it('fails c1 on an article with no lock entry and on a lock entry with no article', () => {
        // Arrange
        const root = syntheticRoot();
        reviewHelpArticles({ root, ids: ['a', 'b'], now: REVIEW_DAY, sources: sources() });
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const { entries } = parseHelpLock({ text: readFileSync(lockFile, 'utf8') });
        const ghost = { ...(entries[0] as (typeof entries)[number]), id: 'zz' };
        writeFileSync(lockFile, formatHelpLock({ entries: [...entries, ghost] }));

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c1']);
        expect(result.violations.map((violation) => violation.detail).join('\n')).toMatch(
            /c has no lock entry[\s\S]*lock entry zz has no article/
        );
    });

    it('fails c1 on an out-of-order lock', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        const lockFile = path.join(root, HELP_LOCK_PATH);
        const lines = readFileSync(lockFile, 'utf8').trim().split('\n');
        const body = lines.slice(1, -1).map((line) => line.replace(/,$/, ''));
        writeFileSync(lockFile, `[\n${[...body].reverse().join(',\n')}\n]\n`);

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c1']);
    });

    it('fails c4 on an empty lock while the catalog has articles (AC-34)', () => {
        // Arrange
        const root = syntheticRoot();

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toContain('c4');
        expect(run({ root, sources: sources() }).output).toContain(PREDICATE_MESSAGES.c4);
    });

    it('fails c4 on an empty catalog with an empty lock (AC-34)', () => {
        // Arrange
        const root = syntheticRoot({ files: [] });

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c4']);
        expect(result.violations[0]?.detail).toContain('no article under');
        expect(run({ root, sources: sources() }).exitCode).toBe(1);
    });

    it('fails c4 on an empty catalog even when the lock has entries', () => {
        // Arrange
        const root = syntheticRoot();
        reviewAll(root);
        rmSync(path.join(root, HELP_CONTENT_PATH), { recursive: true });
        mkdirSync(path.join(root, HELP_CONTENT_PATH), { recursive: true });

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toContain('c4');
    });

    it('fails c4 when the content does not parse', () => {
        // Arrange
        const root = syntheticRoot({ files: [{ path: 'es/host/a.md', source: 'nope' }] });

        // Act
        const result = check(root);

        // Assert
        expect(predicatesOf(result)).toEqual(['c4']);
    });
});
