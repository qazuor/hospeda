/**
 * Static guard: the write pipeline cannot refuse a foreign row in a way that
 * confirms the id exists (HOS-706).
 *
 * HOS-600 closed twelve READ-path disclosures and deliberately left this family
 * open, because closing it changes behaviour for every owner-scoped entity at
 * once and that was an owner decision rather than a contract repair. The owner
 * took it: `_canUpdate` / `_canSoftDelete` / `_canHardDelete` / `_canRestore` /
 * `_canUpdateVisibility` now answer the SAME 404 as a row that does not exist,
 * whenever the refused caller does not own the row.
 *
 * Fifteen entities carry a write-path owner column, so this is a guard rather
 * than fifteen patches — and unlike HOS-600's route-shaped guard, this one has
 * to police `packages/service-core`, where the refusal is actually built. The
 * two guards are siblings, not duplicates: no pattern over `apps/api/src/routes`
 * can see a service-layer permission helper (HOS-600 says so in its own header).
 *
 * Two assertions, deliberately different in kind, because they fail to different
 * mutations:
 *
 *   1. WIRING — the injected permission check may only be invoked inside
 *      `_assertWritePermission`, and that method must run the failure through
 *      `maskForeignRowRefusal`. Removing the try/catch and calling the hook
 *      directly (the pre-HOS-706 code) fails here.
 *
 *   2. BYPASS — a file that fetches a row through `_getAndValidateEntity` may
 *      not then invoke a write-path hook directly, outside the mask. That is the
 *      shape `updateVisibility` had: it passed a NO-OP check to the fetcher and
 *      ran the real gate a few lines below, so a status-shaped reading of the
 *      pipeline ("everything goes through `_getAndValidateEntity`") was true and
 *      the leak was still open.
 *
 * Anchoring note: neither assertion looks for the literal `403` or
 * `'FORBIDDEN'`. A refusal can be built from a constant, a variable or a
 * re-thrown error, so a status-literal anchor is trivially escaped. Both anchor
 * on the tokens the pipeline cannot do without — the name of the hook it calls
 * and the name of the helper that masks it — and both are backed by instrument
 * checks so a rename cannot turn the guard green while policing nothing.
 *
 * Comments are stripped before evaluation: this file's own prose, and the
 * explanatory comments in `base.crud.write.ts`, name the very identifiers being
 * searched for.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const BASE_DIR = join(__dirname, '../../src/base');

/** Every file in the base pipeline this guard reasons about. */
const BASE_FILES = [
    'base.service.ts',
    'base.crud.write.ts',
    'base.crud.read.ts',
    'base.crud.admin.ts',
    'base.crud.permissions.ts',
    'base.crud.related.service.ts',
    'base.crud.service.ts'
] as const;

/** Strips comments so prose naming these identifiers cannot trip a match. */
function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
}

function readBaseFile(name: string): string {
    return stripComments(readFileSync(join(BASE_DIR, name), 'utf8'));
}

/**
 * Returns `[start, end)` of the balanced span that opens at `openIndex`.
 *
 * Used for both `{...}` method bodies and `(...)` call arguments, so one matcher
 * covers "is this call inside that method" and "is this call inside that
 * argument list".
 */
function balancedSpan(
    source: string,
    openIndex: number,
    open: string,
    close: string
): [number, number] {
    let depth = 0;
    for (let i = openIndex; i < source.length; i++) {
        if (source[i] === open) depth++;
        else if (source[i] === close) {
            depth--;
            if (depth === 0) return [openIndex, i + 1];
        }
    }
    return [openIndex, source.length];
}

/**
 * The span of a method's body, located by its declaration name.
 *
 * The body is found AFTER the parameter list closes, not at the first `{`:
 * both methods here take a destructured object parameter, so the first brace
 * belongs to the signature and slicing from it would return the parameter
 * names instead of the code.
 */
function methodBodySpan(source: string, methodName: string): [number, number] {
    const declaration = source.indexOf(`${methodName}`);
    if (declaration < 0) return [-1, -1];
    const paren = source.indexOf('(', declaration);
    if (paren < 0) return [-1, -1];
    const [, parenEnd] = balancedSpan(source, paren, '(', ')');
    const brace = source.indexOf('{', parenEnd);
    if (brace < 0) return [-1, -1];
    return balancedSpan(source, brace, '{', '}');
}

/** Every span occupied by an `_assertWritePermission( ... )` call expression. */
function maskedCallSpans(source: string): Array<[number, number]> {
    const spans: Array<[number, number]> = [];
    const call = /this\._assertWritePermission\s*\(/g;
    for (const match of source.matchAll(call)) {
        const paren = source.indexOf('(', match.index ?? 0);
        spans.push(balancedSpan(source, paren, '(', ')'));
    }
    return spans;
}

const inAnySpan = (index: number, spans: Array<[number, number]>): boolean =>
    spans.some(([start, end]) => index >= start && index < end);

/**
 * An INVOCATION of the permission callback the fetcher is handed.
 *
 * Both spellings matter: `permissionCheck` is the parameter name on
 * `_getAndValidateEntity`, `check` is the one on `_assertWritePermission`.
 * `check:` (the property that PASSES it) is not a call and does not match.
 */
const CHECK_INVOCATION = /\b(?:permissionCheck|check)\s*\(/g;

/** A DIRECT invocation of a write-path permission hook (never `.bind(this)`). */
const WRITE_HOOK_INVOCATION =
    /this\._can(?:Update|SoftDelete|HardDelete|Restore|Delete|UpdateVisibility)\s*\(/g;

/** The file fetched a row through the shared write-path fetcher. */
const FETCHES_ROW = /_getAndValidateEntity[<(]/;

describe('write-path existence disclosure — static guards', () => {
    it('reads a non-empty base pipeline', () => {
        // Instrument check. A wrong path would make every assertion below
        // vacuously true and report the same "all clear" as a real pass.
        for (const name of BASE_FILES) {
            expect(readBaseFile(name).length).toBeGreaterThan(200);
        }
    });

    it('still finds the pipeline members it is meant to police', () => {
        // Second instrument check, on the PREDICATES rather than the file list.
        // A rename of `_assertWritePermission` or `_getAndValidateEntity` would
        // otherwise leave both assertions matching nothing at all.
        const baseService = readBaseFile('base.service.ts');
        const [start] = methodBodySpan(baseService, '_assertWritePermission');
        expect(start).toBeGreaterThan(-1);

        const fetchers = BASE_FILES.filter((name) => FETCHES_ROW.test(readBaseFile(name)));
        expect(fetchers).toContain('base.crud.write.ts');

        // And on the regexes themselves, against a sample of the exact defect
        // each one exists to catch.
        expect('await Promise.resolve(permissionCheck(actor, entity));').toMatch(CHECK_INVOCATION);
        expect('await this._canUpdateVisibility(a, e, v);').toMatch(WRITE_HOOK_INVOCATION);
        expect('this._canUpdate.bind(this),').not.toMatch(WRITE_HOOK_INVOCATION);
    });

    it('never invokes the injected permission check outside the mask', () => {
        const source = readBaseFile('base.service.ts');
        const [maskStart, maskEnd] = methodBodySpan(source, '_assertWritePermission');

        // The mask must actually mask. Without this, the assertion below would
        // pass on an `_assertWritePermission` that simply re-throws.
        expect(source.slice(maskStart, maskEnd)).toContain('maskForeignRowRefusal(');

        const unmasked = [...source.matchAll(CHECK_INVOCATION)]
            .map((match) => match.index ?? 0)
            .filter((index) => index < maskStart || index >= maskEnd)
            .map((index) => source.slice(index, index + 60).split('\n')[0]);

        expect(unmasked).toEqual([]);
    });

    it('no fetch-then-check file calls a write-path hook outside the mask', () => {
        const offenders: string[] = [];

        for (const name of BASE_FILES) {
            const source = readBaseFile(name);
            if (!FETCHES_ROW.test(source)) {
                // The file never fetches a row, so a hook call in it cannot be
                // the "row exists, and here is a 403 proving it" shape.
                continue;
            }
            const masked = maskedCallSpans(source);
            for (const match of source.matchAll(WRITE_HOOK_INVOCATION)) {
                if (!inAnySpan(match.index ?? 0, masked)) {
                    offenders.push(
                        `${name}: ${source.slice(match.index ?? 0, (match.index ?? 0) + 50).split('\n')[0]}`
                    );
                }
            }
        }

        expect(offenders).toEqual([]);
    });
});
