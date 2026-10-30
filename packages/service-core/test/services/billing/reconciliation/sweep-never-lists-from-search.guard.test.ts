import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { CAPABILITY_METHODS } from '@repo/payments';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(import.meta.dirname, '../../../../../..');
const SWEEP_DIR = join(
    REPO_ROOT,
    'packages/service-core/src/services/billing/reconciliation/sweep'
);
const JOB = join(REPO_ROOT, 'apps/api/src/cron/jobs/billing-reconciliation-sweep.job.ts');

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const file = join(dir, name);
        return statSync(file).isDirectory()
            ? sourceFiles(file)
            : name.endsWith('.ts')
              ? [file]
              : [];
    });
}

/** Removes line and block comments while preserving quoted strings and template contents. */
function stripComments(source: string): string {
    let result = '';
    let state: 'code' | 'single' | 'double' | 'template' | 'line' | 'block' = 'code';
    for (let i = 0; i < source.length; i++) {
        const char = source[i]!;
        const next = source[i + 1];
        if (state === 'line') {
            if (char === '\n') {
                result += char;
                state = 'code';
            }
            continue;
        }
        if (state === 'block') {
            if (char === '*' && next === '/') {
                state = 'code';
                i++;
            }
            continue;
        }
        if (state !== 'code') {
            result += char;
            if (char === '\\') {
                result += next ?? '';
                i++;
                continue;
            }
            if (
                (state === 'single' && char === "'") ||
                (state === 'double' && char === '"') ||
                (state === 'template' && char === '`')
            )
                state = 'code';
            continue;
        }
        if (char === '/' && next === '/') {
            state = 'line';
            i++;
            continue;
        }
        if (char === '/' && next === '*') {
            state = 'block';
            i++;
            continue;
        }
        if (char === "'") state = 'single';
        else if (char === '"') state = 'double';
        else if (char === '`') state = 'template';
        result += char;
    }
    return result;
}

// readOrder is a read by id like readCharge (HOS-1605), not a search.
const searchMethods = CAPABILITY_METHODS.read.filter(
    (name) => name !== 'readAuthorization' && name !== 'readCharge' && name !== 'readOrder'
);

/**
 * AC:B11:13 + EX-57 (HOS-1605): the paid-orders check lists its instances from our
 * base and only LOCATES an instance's order by its request id; the decision is the
 * re-read by id (readOrder). The search is allowed there and nowhere else.
 */
const SEARCH_ALLOWED_IN: Readonly<Record<string, string>> = {
    searchOrders: join(SWEEP_DIR, 'paid-orders-check.ts')
};

describe('TEST:B11:1 ningún barrido lista desde el buscador', () => {
    it('derives all search methods from the read capability and excludes them from the sweep sources', () => {
        expect(searchMethods).toContain('searchAuthorizations');
        expect(searchMethods.length).toBeGreaterThan(0);
        const files = [...sourceFiles(SWEEP_DIR), JOB];
        expect(files.length).toBeGreaterThanOrEqual(3);
        const sources = files.map((file) => ({
            file,
            source: stripComments(readFileSync(file, 'utf8'))
        }));
        expect(sources.some(({ source }) => source.includes('readAuthorization'))).toBe(true);
        for (const method of searchMethods) {
            for (const { file, source } of sources) {
                if (SEARCH_ALLOWED_IN[method] === file) continue;
                expect(source, `${method} in ${file}`).not.toMatch(new RegExp(`\\b${method}\\b`));
            }
        }
    });

    it('detects a search call in code but ignores the same text in a comment', () => {
        const call = 'provider.searchAuthorizations({})';
        const detect = (source: string) =>
            searchMethods.some((method) =>
                new RegExp(`\\b${method}\\b`).test(stripComments(source))
            );
        expect(detect(call)).toBe(true);
        expect(detect(`// ${call}`)).toBe(false);
    });
});
