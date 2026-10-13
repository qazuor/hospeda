import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * HOS-1603, AC:B11:6: every cancellation of ours registers its decision. The sweep's retry
 * population is the set of `subscription.provider_cancellation_decided` events, so a call
 * site that sends `provider.cancel(` without recording one leaves a terminal row whose
 * preapproval nobody re-reads. "N call sites forgot the gate" asks for a guard, not N tests.
 */
const REPO_ROOT = resolve(import.meta.dirname, '../../../../../..');
const BILLING_DIR = join(REPO_ROOT, 'packages/service-core/src/services/billing');

/** Files allowed to cancel without recording, each with its reason. */
const EXEMPT: Readonly<Record<string, string>> = {
    'reconciliation/cancel-our-authorization.ts': 'the helper itself; its callers register',
    'reconciliation/sweep/our-cancellation-retry.ts': 'retries a decision already registered',
    'reconciliation/creations/creations-sweep.service.ts':
        'cancels duplicate creations that never became our row, AC:B11:23',
    'subscription/start-subscription.service.ts':
        'S1 re-cancels the preapproval of a CHARGE_DECLINED row whose S16 already registered',
    'subscription/suspend-for-arrears.service.ts':
        'S6 leaves the row SUSPENDED, live: not one of the eleven rows of salvedad 4, B11.md:372'
};

const CANCEL_CALL = /\b(?:provider\.cancel|cancelOurAuthorization)\(/;
const RECORD_CALL = /\brecordProviderCancellationDecided\(/;

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

const sources = sourceFiles(BILLING_DIR).map((file) => ({
    path: relative(BILLING_DIR, file).split('\\').join('/'),
    code: stripComments(readFileSync(file, 'utf8'))
}));
const callers = sources.filter(({ code }) => CANCEL_CALL.test(code));

describe('HOS-1603 AC:B11:6: every provider cancellation of ours registers its decision', () => {
    it('(a) every file that cancels records the decision or is exempt with its reason', () => {
        const offenders = callers
            .filter(({ path, code }) => !RECORD_CALL.test(code) && !(path in EXEMPT))
            .map(({ path }) => path);
        expect(offenders).toEqual([]);
    });

    it('(b) is not vacuous: the known call sites are scanned and the four registrants record', () => {
        expect(callers.length).toBeGreaterThanOrEqual(5);
        const registrants = callers
            .filter(({ code }) => RECORD_CALL.test(code))
            .map(({ path }) => path);
        expect(registrants).toEqual(
            expect.arrayContaining([
                'subscription/expire-authorization-windows.service.ts',
                'subscription/decline-first-charge.service.ts',
                'subscription/cancel-inherited-tourist-vip.service.ts',
                'reconciliation/handle-unknown-authorization.service.ts'
            ])
        );
    });

    it('(c) no EXEMPT entry is stale: each file still exists and still cancels', () => {
        const callerPaths = new Set(callers.map(({ path }) => path));
        for (const [path, reason] of Object.entries(EXEMPT)) {
            expect(reason.length, path).toBeGreaterThan(0);
            expect(callerPaths.has(path), path).toBe(true);
        }
    });

    it('(d) detects a cancel call in code but ignores the same text in a comment', () => {
        const call = 'await ports.provider.cancel({ authorizationId })';
        expect(CANCEL_CALL.test(stripComments(call))).toBe(true);
        expect(CANCEL_CALL.test(stripComments(`// ${call}`))).toBe(false);
        expect(CANCEL_CALL.test(stripComments(`/* ${call} */`))).toBe(false);
    });
});
