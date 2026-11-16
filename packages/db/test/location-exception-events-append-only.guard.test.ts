import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `location_exception_event` is the audit trail of the location exceptions
 * (HOS-2192). It is append-only: the only write that may exist is an INSERT, in
 * the model. Nothing updates or deletes a row, in raw SQL or through Drizzle.
 */
const ROOTS = [
    join(__dirname, '../src'),
    join(__dirname, '../../service-core/src'),
    join(__dirname, '../../../apps/api/src')
];
const MIGRATION_DIR = 'migrations/';

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path);
        return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    });
}

/** The Drizzle and raw-SQL spellings of a mutation of the events table. */
const MUTATIONS: readonly RegExp[] = [
    /\.(?:update|delete)\s*\(\s*locationExceptionEvents\b/,
    /\bUPDATE\s+"?location_exception_event"?\b/i,
    /\bDELETE\s+FROM\s+"?location_exception_event"?\b/i,
    /\bTRUNCATE\b[^;`]*\blocation_exception_event\b/i
];

describe('location_exception_event is append-only', () => {
    it('is never updated or deleted by production code', () => {
        const violations: string[] = [];
        for (const root of ROOTS) {
            for (const path of sourceFiles(root)) {
                const name = relative(root, path).replaceAll('\\', '/');
                if (name.startsWith(MIGRATION_DIR)) continue;
                const content = readFileSync(path, 'utf8');
                if (MUTATIONS.some((pattern) => pattern.test(content))) violations.push(path);
            }
        }
        expect(violations).toEqual([]);
    });

    it('is inserted by the model, so the scan is looking at the right code', () => {
        const model = readFileSync(
            join(__dirname, '../src/models/listing/listing-location-exception.model.ts'),
            'utf8'
        );
        expect(model).toMatch(/\.insert\(locationExceptionEvents\)/);
    });
});
