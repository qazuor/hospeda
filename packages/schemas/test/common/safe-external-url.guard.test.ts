/**
 * @file safe-external-url.guard.test.ts
 * @description Static guard (HOS-703): the http/https scheme allow-list has ONE
 * declaration in this package, `common/safe-external-url.schema.ts`. Any other
 * `protocol:` regex or `startsWith('https')` is a second copy that drifts from
 * the one `apps/web` also reads.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../src');
const SOURCE_OF_TRUTH = 'common/safe-external-url.schema.ts';

/** A hand-written scheme regex handed to Zod's `protocol` option. */
const PROTOCOL_LITERAL = /protocol:\s*\/\^?\(?https?/;

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            return entry === '__tests__' ? [] : walk(full);
        }
        return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : [];
    });
}

describe('scheme allow-list has a single declaration (HOS-703)', () => {
    it('no schema file hand-writes an http/https protocol regex', () => {
        const offenders = walk(SRC)
            .map((file) => relative(SRC, file).split(sep).join('/'))
            .filter((file) => file !== SOURCE_OF_TRUTH)
            .filter((file) => PROTOCOL_LITERAL.test(readFileSync(join(SRC, file), 'utf8')));

        expect(
            offenders,
            'Use safeExternalUrl() / SAFE_EXTERNAL_URL_PROTOCOL from common/safe-external-url.schema.ts.'
        ).toEqual([]);
    });

    it('the source of truth exists and declares the list', () => {
        const source = readFileSync(join(SRC, SOURCE_OF_TRUTH), 'utf8');
        expect(source).toContain("SAFE_EXTERNAL_URL_SCHEMES = ['http', 'https']");
    });
});
