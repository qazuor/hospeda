/**
 * Static guard: every add-on notification dispatch carries its deep-link
 * fields (HOS-722).
 *
 * ## Why a static guard rather than N behavioural tests
 *
 * The defect HOS-722 fixes is not "one dispatch computes the wrong link" — it
 * is "some dispatch sites pass `locale`/`addonSlug` and some silently do not".
 * Every omission renders a perfectly valid email whose CTA points at `/es/`
 * with no `?focus=`; nothing throws, nothing logs, and the send reports
 * success. That failure mode is invisible to any test of a single site, and it
 * recurs the moment a sixth add-on dispatch is added somewhere new.
 *
 * So the assertion here is over the SET of dispatch sites, in the same spirit
 * as `inv1-cache-invalidation.guard.test.ts`. Behavioural proof that the
 * resulting link is correct lives at the notification-service boundary
 * (`packages/notifications/test/services/addon-purchase-template-routing.test.ts`)
 * and at the link builder (`packages/notifications/test/templates/addon-links.test.ts`);
 * this file only proves nobody forgot to feed them.
 *
 * ## What it does NOT claim
 *
 * It says nothing about the VALUE passed — only that both keys are present in
 * the call. A site passing a hardcoded `locale: 'es'` would satisfy it. That is
 * deliberate: the predicate is "the field is wired", which is precisely the
 * thing that was missing, and a guard must never assert more than it proves.
 *
 * @module test/services/addon-notification-deep-link.guard.test
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every file in `apps/api/src` that dispatches an add-on lifecycle
 * notification. Listed explicitly rather than globbed so that MOVING a
 * dispatch to a new file is a deliberate, reviewed edit of this list instead
 * of a silent loss of coverage.
 */
const DISPATCH_FILES = [
    'src/cron/jobs/addon-expiry.job.ts',
    'src/services/addon.checkout.ts',
    'src/services/addon.user-addons.ts'
] as const;

/**
 * Total number of add-on notification dispatches expected across those files.
 *
 * - `addon-expiry.job.ts` — ADDON_EXPIRED, plus the 3-day and 1-day
 *   ADDON_EXPIRATION_WARNING reminders (3).
 * - `addon.checkout.ts` — ADDON_PURCHASE (1).
 * - `addon.user-addons.ts` — ADDON_CANCELLATION (1).
 *
 * ADDON_RENEWAL_CONFIRMATION is deliberately absent: the notification type
 * exists but has NO dispatch anywhere (GAP-043-53, `subscription-logic.ts`).
 * Building one is out of scope for HOS-722; if it is ever built, it must carry
 * these fields too, and bumping this number is how that gets noticed.
 */
const EXPECTED_DISPATCH_COUNT = 5;

/** Repo-relative root of the API app, resolved from this test's location. */
const API_ROOT = join(__dirname, '..', '..');

/**
 * A single `sendNotification({ ... })` call whose `type` is an add-on
 * notification, sliced out of its source file.
 */
interface AddonDispatch {
    readonly file: string;
    readonly notificationType: string;
    readonly source: string;
}

/**
 * Slices out every add-on `sendNotification({ ... })` call in a file.
 *
 * Cuts ONE block per call by brace-matching from the call's opening `{`, so a
 * key belonging to a neighbouring dispatch can never satisfy the assertion for
 * this one — the failure mode a whole-file `toContain` would have.
 *
 * @param params - `{ file, source }` the file's repo-relative path and contents.
 * @returns One entry per add-on dispatch found.
 */
function extractAddonDispatches({
    file,
    source
}: {
    readonly file: string;
    readonly source: string;
}): AddonDispatch[] {
    const dispatches: AddonDispatch[] = [];
    const callToken = 'sendNotification({';
    let searchFrom = 0;

    while (true) {
        const callStart = source.indexOf(callToken, searchFrom);
        if (callStart === -1) {
            break;
        }

        const braceStart = callStart + callToken.length - 1;
        let depth = 0;
        let cursor = braceStart;

        while (cursor < source.length) {
            const char = source[cursor];
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    break;
                }
            }
            cursor++;
        }

        const block = source.slice(braceStart, cursor + 1);
        const typeMatch = block.match(/type:\s*NotificationType\.(ADDON_[A-Z_]+)/);

        if (typeMatch) {
            dispatches.push({
                file,
                notificationType: typeMatch[1] as string,
                source: block
            });
        }

        searchFrom = cursor + 1;
    }

    return dispatches;
}

const allDispatches = DISPATCH_FILES.flatMap((file) =>
    extractAddonDispatches({ file, source: readFileSync(join(API_ROOT, file), 'utf8') })
);

describe('add-on notification dispatches carry their deep-link fields (HOS-722)', () => {
    it('finds every known add-on dispatch site', () => {
        // Arrange & Act — done at module load.
        // Assert: a dropped or relocated dispatch must fail loudly rather than
        // shrink the set this suite iterates over into silence.
        expect(allDispatches).toHaveLength(EXPECTED_DISPATCH_COUNT);
    });

    it('confirms ADDON_RENEWAL_CONFIRMATION still has no dispatch (GAP-043-53)', () => {
        // Out of scope for HOS-722, asserted so that building one later is a
        // deliberate change to this file rather than an unnoticed sixth site.
        const renewalDispatches = allDispatches.filter(
            (dispatch) => dispatch.notificationType === 'ADDON_RENEWAL_CONFIRMATION'
        );

        expect(renewalDispatches).toEqual([]);
    });

    it.each(
        allDispatches.map((dispatch) => [
            `${dispatch.file} → ${dispatch.notificationType}`,
            dispatch
        ])
    )('%s passes locale and addonSlug', (_label, dispatch) => {
        // Arrange
        const { source } = dispatch as AddonDispatch;

        // Assert — anchored on the key names, since both are optional on the
        // payload types (for backward compatibility) and their absence is
        // therefore a silent downgrade rather than a type error.
        expect(source).toMatch(/\blocale:/);
        expect(source).toMatch(/\baddonSlug\b\s*[,:]/);
    });
});
