/**
 * CI guard: no lead funnel may be constructed without its ops alert
 * (H-62 / H-148).
 *
 * ## Why a guard and not a behaviour test
 *
 * The commerce alert was not missing code — the code was there, complete, with
 * a `TODO` beside it. What was missing was the ARGUMENT, at five separate
 * construction sites, none of which looked wrong on its own: `new
 * CommerceLeadService({ logger: apiLogger })` type-checks, runs, and quietly
 * takes the branch where nobody is told. That is a defect of N call sites, and
 * a behaviour test only ever covers the one call site somebody remembered.
 *
 * So the assertion is made over the source: every construction of a
 * lead-owning service in `apps/api` must pass its notifier. A future route
 * that copy-pastes the one-argument form fails here, before it can ship a
 * funnel with no doorbell.
 *
 * The parser is verified before it is trusted: a regex that silently matched
 * nothing would turn this file green while proving nothing at all.
 *
 * @module test/lib/lead-intake-wiring.guard.test
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', 'src');

/** Every `.ts` file under `apps/api/src`, recursively. */
function collectSourceFiles(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            collectSourceFiles(full, found);
        } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
            found.push(full);
        }
    }
    return found;
}

/**
 * Finds every `new <ServiceName>(` construction and captures its argument list.
 *
 * Brace/paren matching rather than a regex for the arguments themselves: the
 * calls span multiple lines and nest object literals and further calls, which
 * a non-greedy regex gets wrong in both directions.
 */
function findConstructions(params: {
    readonly source: string;
    readonly className: string;
}): readonly string[] {
    const { source, className } = params;
    const needle = `new ${className}(`;
    const calls: string[] = [];

    let index = source.indexOf(needle);
    while (index !== -1) {
        let depth = 0;
        let cursor = index + needle.length - 1;
        const start = cursor + 1;

        for (; cursor < source.length; cursor++) {
            const char = source[cursor];
            if (char === '(') {
                depth += 1;
            } else if (char === ')') {
                depth -= 1;
                if (depth === 0) {
                    break;
                }
            }
        }

        calls.push(source.slice(start, cursor));
        index = source.indexOf(needle, cursor);
    }

    return calls;
}

/** Splits a captured argument list into top-level arguments. */
function splitTopLevelArgs(args: string): readonly string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of args) {
        if (char === '(' || char === '{' || char === '[') {
            depth += 1;
        } else if (char === ')' || char === '}' || char === ']') {
            depth -= 1;
        }

        if (char === ',' && depth === 0) {
            parts.push(current.trim());
            current = '';
            continue;
        }

        current += char;
    }

    if (current.trim().length > 0) {
        parts.push(current.trim());
    }

    return parts;
}

describe('lead funnel wiring guard (H-62 / H-148)', () => {
    const files = collectSourceFiles(SRC).map((path) => ({
        path,
        source: readFileSync(path, 'utf8')
    }));

    describe('the scan is trustworthy before its verdict is', () => {
        it('walks a real source tree', () => {
            // A broken walk would leave every assertion below vacuously true.
            expect(files.length).toBeGreaterThan(200);
        });

        it('locates the constructions it is meant to police', () => {
            const commerce = files.flatMap(({ source }) =>
                findConstructions({ source, className: 'CommerceLeadService' })
            );
            const alliance = files.flatMap(({ source }) =>
                findConstructions({ source, className: 'AllianceLeadService' })
            );

            expect(commerce.length).toBeGreaterThan(0);
            expect(alliance.length).toBeGreaterThan(0);
        });
    });

    it('every CommerceLeadService is built with its notifier', () => {
        const offenders = files
            .filter(({ path }) => !path.endsWith('lead-intake-ports.ts'))
            .flatMap(({ path, source }) =>
                findConstructions({ source, className: 'CommerceLeadService' })
                    .filter((args) => splitTopLevelArgs(args).length < 2)
                    .map(() => path)
            );

        expect(
            offenders,
            'A CommerceLeadService built with only its config takes the branch where ' +
                'nobody is told a lead arrived. Pass createCommerceLeadNotificationPort() ' +
                'as the second argument.'
        ).toEqual([]);
    });

    it('the public alliance intake route builds its service with the intake port', () => {
        const route = files.find(({ path }) =>
            path.endsWith(join('routes', 'alliance', 'public', 'create-lead.ts'))
        );

        expect(route, 'the public alliance intake route moved or was renamed').toBeDefined();

        const calls = findConstructions({
            source: route?.source ?? '',
            className: 'AllianceLeadService'
        });

        expect(calls.length).toBe(1);
        // The intake notifier is the FOURTH constructor argument. Asserting the
        // count alone would pass on a service wired with a claim inviter and a
        // decision notifier and no doorbell at all — which is precisely the
        // state this route was in.
        const args = splitTopLevelArgs(calls[0] ?? '');
        expect(args.length).toBe(4);
        expect(args[3]).toContain('createAllianceLeadIntakeNotifyPort');
    });
});
