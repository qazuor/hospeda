import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../../../../..');
const HOOK_SOURCES = [
    'packages/service-core/src/services/billing/subscription/suspend-for-arrears.service.ts',
    'packages/service-core/src/services/billing/subscription/reactivate-suspended.service.ts',
    'packages/service-core/src/services/billing/notice/mirror-our-cancellation-on-active.ts',
    'packages/service-core/src/services/billing/subscription/end-scheduled-services.service.ts',
    'packages/service-core/src/services/billing/subscription/cancel-active-subscription.service.ts'
];
const ROOT_SOURCES = [
    'apps/api/src/routes/webhooks/mercadopago-ports.ts',
    'apps/api/src/cron/jobs/billing-reconciliation-sweep.job.ts',
    'apps/api/src/cron/jobs/subscription-window-expiry.job.ts'
];

/** Removes comments while retaining source code and newlines for static hook checks. */
function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\/|(^|\s)\/\/.*$/gm, '$1');
}

/** Checks required calls and their source ordering. */
function missingHooks(source: string): string[] {
    const code = withoutComments(source);
    const missing: string[] = [];
    if (code.includes('suspendForArrears(')) {
        const write = code.indexOf('writeArrearsSuspension(');
        const pause = code.indexOf('pauseComplementsS32(');
        if (write < 0 || pause <= write)
            missing.push('S6 pause must follow writeArrearsSuspension');
    }
    if (code.includes('cancelActiveSubscription(')) {
        const s11 = code.slice(code.indexOf('cancelActiveSubscription('));
        const write = s11.indexOf('writeS11Cancellation(');
        const cancel = s11.indexOf('cancelComplementsByS11Rule(');
        if (cancel < 0) missing.push('S11 hook');
        else if (write < 0 || cancel <= write)
            missing.push('S11 complement hook must follow writeS11Cancellation');
    }
    if (code.includes('reactivateSuspendedOnCreditedPayment(')) {
        if (!code.includes('resumeComplementsS33(')) missing.push('S7 resume hook');
        if (!code.includes('cancelComplementsByS11Rule(')) missing.push('S7 S11 hook');
    }
    if (
        code.includes('mirrorOurCancellationOnActive(') &&
        !code.includes('cancelComplementsByS11Rule(')
    )
        missing.push('mirror S11 hook');
    if (code.includes('endScheduledServices(')) {
        if (!code.includes('pauseComplementsS32(')) missing.push('S12 S32 hook');
        if (!code.includes("'PRINCIPAL_LEFT_LIVE_ROWS'")) missing.push('S12 trigger');
    }
    return missing;
}

describe('HOS-1562 complement composition hooks', () => {
    it('keeps all domain hooks in their transition functions and in the required order', () => {
        const sources = HOOK_SOURCES.map((path) =>
            withoutComments(readFileSync(join(ROOT, path), 'utf8'))
        );
        const failures = sources.flatMap((source) => missingHooks(source));
        expect(failures).toEqual([]);
        expect(
            sources
                .join('\n')
                .match(
                    /\b(?:pauseComplementsS32|resumeComplementsS33|cancelComplementsByS11Rule)\(/g
                )
        ).toHaveLength(6);
    });

    it('requires the real API composition helper at every S6/S7/mirror root', () => {
        const roots = ROOT_SOURCES.map((path) =>
            withoutComments(readFileSync(join(ROOT, path), 'utf8'))
        );
        expect(roots).toHaveLength(3);
        for (const source of roots) expect(source).toContain('buildComplementPolicyPorts');
    });

    it('is non-vacuous: removing a hook is detected', () => {
        expect(
            missingHooks('async function suspendForArrears() { await writeArrearsSuspension(); }')
        ).toContain('S6 pause must follow writeArrearsSuspension');
        expect(
            missingHooks(
                'async function cancelActiveSubscription() { await writeS11Cancellation(); }'
            )
        ).toContain('S11 hook');
        expect(
            missingHooks(
                'async function cancelActiveSubscription() { await cancelComplementsByS11Rule(); await writeS11Cancellation(); }'
            )
        ).toContain('S11 complement hook must follow writeS11Cancellation');
    });
});
