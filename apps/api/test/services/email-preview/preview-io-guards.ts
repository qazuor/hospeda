/**
 * Test helpers that prove an email preview performed no I/O (HOS-2519 AC-4.6).
 *
 * Two independent signals, because either alone has a hole:
 * - the real database-backed collaborators (`issuePartnerClaimSecret`,
 *   `readListingNames`, `readReconciliationSubjects`) are replaced by throwing
 *   spies in each test file's `vi.mock`, so wiring the default instead of the
 *   preview fake fails loudly and is recorded;
 * - every `vi.fn` of the global `@repo/db` mock must record zero calls.
 *
 * @module test/services/email-preview/preview-io-guards
 */

import * as db from '@repo/db';
import { type MockInstance, vi } from 'vitest';
import { readListingNames } from '../../../src/utils/listing-publication/listing-names-reader.js';
import { issuePartnerClaimSecret } from '../../../src/utils/partner-application/partner-claim-secret.js';
import { readReconciliationSubjects } from '../../../src/utils/reconciliation-summary/reconciliation-subjects-reader.js';

/** Error the throwing spies raise, so a failing render names the cause. */
export const REAL_IO_COLLABORATOR_ERROR =
    'A real database-backed collaborator ran during an email preview';

/** Every `vi.fn` exported by the `@repo/db` mock, top level and one level into models. */
function dbMocks(): readonly { readonly name: string; readonly mock: MockInstance }[] {
    const found: { name: string; mock: MockInstance }[] = [];
    for (const [name, value] of Object.entries(db as Record<string, unknown>)) {
        if (vi.isMockFunction(value)) {
            found.push({ name, mock: value });
        } else if (value && typeof value === 'object') {
            for (const [method, inner] of Object.entries(value as Record<string, unknown>)) {
                if (vi.isMockFunction(inner))
                    found.push({ name: `${name}.${method}`, mock: inner });
            }
        }
    }
    return found;
}

/**
 * Names of every I/O spy that recorded a call: the real collaborators and the
 * `@repo/db` mock functions. Empty means the preview did no I/O.
 *
 * @returns The names of the called spies.
 */
export function calledIoSpies(): readonly string[] {
    const realCollaborators: readonly { readonly name: string; readonly fn: unknown }[] = [
        { name: 'issuePartnerClaimSecret', fn: issuePartnerClaimSecret },
        { name: 'readListingNames', fn: readListingNames },
        { name: 'readReconciliationSubjects', fn: readReconciliationSubjects }
    ];
    const called = realCollaborators
        .filter(({ fn }) => vi.isMockFunction(fn) && fn.mock.calls.length > 0)
        .map(({ name }) => name);
    return [
        ...called,
        ...dbMocks()
            .filter(({ mock }) => mock.mock.calls.length > 0)
            .map(({ name }) => `@repo/db.${name}`)
    ];
}

/**
 * Asserts the guard is armed: the real collaborators are spies and the
 * `@repo/db` mock exposes functions to watch.
 *
 * @returns Whether every real collaborator is a spy and the db mock is non-empty.
 */
export function ioGuardsAreArmed(): boolean {
    return (
        vi.isMockFunction(issuePartnerClaimSecret) &&
        vi.isMockFunction(readListingNames) &&
        vi.isMockFunction(readReconciliationSubjects) &&
        dbMocks().length > 0
    );
}
