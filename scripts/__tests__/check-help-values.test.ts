/**
 * HOS-2410 (`docs/guards.md` §6, AC-33, AC-34) — guard (d) of the help
 * catalog, values, by mutation: each test feeds one known-bad text and asserts
 * the predicate that fires. The real repo must be green, and the `get_help`
 * text frozen by AC-15 must stay as it is.
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { HelpContentFile } from '../../packages/help/src/generator/index';
import { greenCatalog } from '../../packages/help/test/fixtures/article-source';
import { HELP_CONTENT_PATH } from '../check-help-catalog';
import {
    checkHelpValues,
    foldHelpText,
    PLAN_TIER_WORDS,
    PREDICATE_MESSAGES,
    run,
    valueFindings
} from '../check-help-values';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const MIGRATIONS_DIR = 'packages/db/src/migrations';
const AC15_FIXTURE = 'apps/api/test/mcp/tools/help/fixtures/get-help-pre-migration.json';

const tempDirs: string[] = [];

afterEach(() => {
    for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** A synthetic repo holding the given content; returns its root. */
function syntheticRoot(files: readonly HelpContentFile[]): string {
    const root = mkdtempSync(path.join(tmpdir(), 'help-values-'));
    tempDirs.push(root);
    const contentDir = path.join(root, HELP_CONTENT_PATH);
    mkdirSync(contentDir, { recursive: true });
    for (const file of files) {
        mkdirSync(path.dirname(path.join(contentDir, file.path)), { recursive: true });
        writeFileSync(path.join(contentDir, file.path), file.source);
    }
    return root;
}

/** The predicates one text fires. */
function firedBy(text: string): string[] {
    return valueFindings({ text }).map((finding) => finding.predicate);
}

/**
 * Per sellable plan (`role` NULL) of the `INSERT INTO "plan"` rows, the words
 * that tell it apart from the other sellable plans of its vertical, folded.
 */
function sellablePlanTierWords({ sql }: { readonly sql: string }): Map<string, string[]> {
    const byVertical = new Map<string, string[][]>();
    for (const block of sql.matchAll(/INSERT INTO "plan"[^;]*;/g)) {
        for (const row of block[0].matchAll(
            /\('[^']*',\s*'([^']*)',\s*'[^']*',\s*'([^']*)',\s*\d+,\s*NULL\)/g
        )) {
            const words = foldHelpText({ text: row[2] ?? '' })
                .split(/\s+/)
                .filter(Boolean);
            byVertical.set(row[1] ?? '', [...(byVertical.get(row[1] ?? '') ?? []), words]);
        }
    }
    const result = new Map<string, string[]>();
    for (const [vertical, names] of byVertical) {
        const shared =
            names.length > 1
                ? names.reduce((acc, words) => acc.filter((word) => words.includes(word)))
                : [];
        for (const words of names) {
            result.set(
                `${vertical}: ${words.join(' ')}`,
                words.filter((word) => !shared.includes(word))
            );
        }
    }
    return result;
}

/** The tier words of sellable plans that {@link PLAN_TIER_WORDS} misses. */
function missingTierWords({
    sql,
    words
}: {
    readonly sql: string;
    readonly words: readonly string[];
}) {
    return [...sellablePlanTierWords({ sql })].flatMap(([plan, tierWords]) =>
        tierWords.filter((word) => !words.includes(word)).map((word) => `${plan} → ${word}`)
    );
}

describe('check-help-values on the real repo', () => {
    it('is green', () => {
        // Act
        const result = run();

        // Assert
        expect(result.output).toMatch(/^OK GUARD:help-values: \d+ articles/);
        expect(result.exitCode).toBe(0);
    });

    it('leaves the get_help text frozen by AC-15 untouched (it still holds the allowed constants)', () => {
        // Arrange
        const fixture = readFileSync(path.join(REPO_ROOT, AC15_FIXTURE), 'utf8');

        // Assert
        expect(fixture).toContain('descripción (mínimo 20)');
        expect(fixture).toContain('hasta 10 MB');
    });

    it('PLAN_TIER_WORDS holds the tier word of every sellable plan in the migrations (d2 companion)', () => {
        // Arrange
        const sql = readdirSync(path.join(REPO_ROOT, MIGRATIONS_DIR))
            .filter((name) => name.endsWith('.sql'))
            .map((name) => readFileSync(path.join(REPO_ROOT, MIGRATIONS_DIR, name), 'utf8'))
            .join('\n');

        // Act
        const plans = sellablePlanTierWords({ sql });

        // Assert: non-vacuous, then complete.
        expect(plans.size).toBeGreaterThan(0);
        expect(missingTierWords({ sql, words: PLAN_TIER_WORDS })).toEqual([]);
    });

    it('the d2 companion catches a missing tier word', () => {
        // Arrange
        const sql = `INSERT INTO "plan" ("id", "vertical", "slug", "name", "pricing_order", "role") VALUES
    ('1', 'venue', 'v-a', 'Comer y salir Básico', 1, NULL),
    ('2', 'venue', 'v-b', 'Comer y salir Diamante', 2, NULL),
    ('3', 'venue', 'trial', 'Comer y salir Trial', 0, 'trial');`;

        // Act + Assert
        expect(missingTierWords({ sql, words: PLAN_TIER_WORDS })).toEqual([
            'venue: comer y salir diamante → diamante'
        ]);
    });
});

describe('valueFindings (AC-33)', () => {
    it.each([
        ['hasta 20 fotos', ['d3']],
        ['$ 15.000', ['d1']],
        ['el plan Premium', ['d2']],
        ['15000 pesos por mes', ['d1', 'd3']],
        ['USD 10', ['d1']],
        ['U$S 5', ['d1']],
        ['un dólar', []],
        ['el plan BÁSICO', ['d2']],
        ['Profesional', ['d2']],
        ['durante 30 días', ['d3']],
        ['un tope de 5', ['d3']],
        ['un máximo de 3', ['d3']],
        ['mínimo 2', ['d3']],
        ['20 publicaciones activas', ['d3']],
        ['subí 4 de tus fotos', ['d3']],
        ['Cuesta 15USD', ['d1']],
        ['USD15', ['d1']],
        ['ARS15000 por mes', ['d1', 'd3']],
        ['15pesos', ['d1']],
        ['10 US$', ['d1']],
        ['durante 3 meses', ['d3']],
        ['cargá 20fotos', ['d3']]
    ])('"%s" fires %j', (text, expected) => {
        expect(firedBy(text)).toEqual(expected);
    });

    it.each([
        'hasta 10 MB',
        'pesar hasta 10MB',
        'resumen (mínimo 10 caracteres)',
        'imágenes de 1200 px',
        'paso 2 de la guía',
        'el año 2026 trae novedades',
        'Subí {{limit:max_photos_per_accommodation}} fotos',
        'Mirá {{link:plans:venue|el plan Premium a $ 15.000}}',
        'subí 4 de tus mejores fotos',
        'el formato MP3',
        'los marsupiales 15'
    ])('"%s" passes', (text) => {
        expect(firedBy(text)).toEqual([]);
    });
});

describe('checkHelpValues on a synthetic repo', () => {
    it('is green on a clean catalog', () => {
        // Act
        const result = checkHelpValues({
            root: syntheticRoot(greenCatalog()),
            frozenConstants: []
        });

        // Assert
        expect(result).toEqual({ violations: [], articleCount: 3 });
    });

    it('scans title, summary, keywords and every section, naming the article and field', () => {
        // Arrange
        const files = greenCatalog({
            a: { frontmatter: { title: 'Plan Gold' } },
            b: { frontmatter: { keywords: ['20 fotos'] } },
            c: { steps: ['Pagá $ 100.', 'Listo.'] }
        });

        // Act
        const result = checkHelpValues({ root: syntheticRoot(files), frozenConstants: [] });

        // Assert
        expect(result.violations).toEqual([
            { predicate: 'd2', detail: 'es/a title: "gold"' },
            { predicate: 'd3', detail: 'es/b keywords[0]: "20 fotos"' },
            { predicate: 'd1', detail: 'es/c howTo.steps[0]: "$ 100"' }
        ]);
    });

    it('allows a frozen constant only in its own article, and fails when the allowance is stale', () => {
        // Arrange
        const frozen = [{ articleId: 'a', phrase: 'descripcion (minimo 20)', reason: 'test' }];
        const text = 'Nombre y descripción (mínimo 20).';
        const files = greenCatalog({ a: { expect: text }, b: { expect: text } });

        // Act
        const result = checkHelpValues({ root: syntheticRoot(files), frozenConstants: frozen });
        const stale = checkHelpValues({
            root: syntheticRoot(greenCatalog()),
            frozenConstants: frozen
        });

        // Assert
        expect(result.violations).toEqual([
            { predicate: 'd3', detail: 'es/b expect: "y descripcion minimo 20"' }
        ]);
        expect(stale.violations.map((violation) => violation.predicate)).toEqual(['d3']);
        expect(stale.violations[0]?.detail).toContain('no longer matches');
    });

    it('fails d4 on an empty content dir (AC-34)', () => {
        // Act
        const result = run({ root: syntheticRoot([]) });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.output).toContain(PREDICATE_MESSAGES.d4);
    });

    it('fails d4 when the content does not parse', () => {
        // Act
        const result = checkHelpValues({
            root: syntheticRoot([{ path: 'es/host/a.md', source: 'x' }])
        });

        // Assert
        expect(result.violations.map((violation) => violation.predicate)).toEqual(['d4']);
    });
});
