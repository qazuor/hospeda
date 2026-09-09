/**
 * Every content-mutating route in the three verticals declares the
 * subscription gate ITSELF (HOS-1275).
 *
 * ---
 * ## Why a static guard exists alongside a request test
 *
 * `test/commerce/hos-1275-live-subscription-gate.e2e.test.ts` proves the 402
 * reaches the wire. It cannot prove that a GIVEN route declares the gate,
 * because of how `applyRouteMiddlewares` (`utils/route-factory.ts`) attaches
 * them:
 *
 * ```ts
 * app.use(honoPath, middleware)   // path-scoped, METHOD-agnostic
 * ```
 *
 * Path-scoped and method-agnostic. Two routes that share a path and differ only
 * in method — `PUT /{id}/faqs/{faqId}` (updateFaq) and
 * `DELETE /{id}/faqs/{faqId}` (removeFaq) — end up sharing each other's
 * `options.middlewares`. Measured while mutation-testing this issue: deleting
 * `requireLiveSubscription` from `accommodation/protected/removeFaq.ts` left
 * every e2e test GREEN, because `updateFaq`'s copy on the same path still ran
 * on the DELETE. Deleting it from `addFaq.ts` — whose path `/{id}/faqs` has no
 * gated sibling — turned that case red immediately.
 *
 * Two consequences worth writing down:
 *
 * 1. A request test can never be a per-route witness for a route whose path has
 *    a gated sibling. This file is that witness, and it reads the DEFINITION,
 *    which is what a rename or a deletion actually changes.
 * 2. It also means the six `removeFaq`/`removeMedia` routes that carried no
 *    `options` block at all before this issue were not, in practice, reachable
 *    ungated: their path siblings' `requireEntitlement` already ran on them.
 *    The wiring was still missing from their own declaration, which is what
 *    makes them break the moment a sibling is renamed, re-pathed, or removed —
 *    so they are wired for real now rather than left leaning on a neighbour.
 *
 * ## Fail-CLOSED, which is the whole point of the shape
 *
 * The file list is DERIVED — every `*.ts` under the three `protected/`
 * directories that declares a mutating `method:` — never enumerated. A new
 * mutating route therefore has to be either gated or added to
 * {@link NOT_CONTENT_EDITING} with a reason. It cannot opt out by being
 * forgotten, which is the failure mode of a guard whose scan roots are typed by
 * hand.
 *
 * @module test/routes/content-edit-gate-coverage.guard
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES_DIR = join(import.meta.dirname, '../../src/routes');

/** The three verticals, and the `ProductDomainEnum` member each must demand. */
const VERTICALS = [
    { dir: 'accommodation', domain: 'ACCOMMODATION' },
    { dir: 'gastronomy', domain: 'GASTRONOMY' },
    { dir: 'experience', domain: 'EXPERIENCE' }
] as const;

/**
 * Mutating routes that are NOT listing-content editing, and so are outside this
 * gate's scope. Each entry needs a reason; "it was already there" is not one.
 *
 * Several of these arguably want a subscription gate of their own. They are
 * listed rather than silently skipped precisely so that argument has somewhere
 * to happen — and so a new file cannot join them by accident.
 */
const NOT_CONTENT_EDITING: Readonly<Record<string, readonly string[]>> = {
    accommodation: [
        // Lifecycle, not content. `publish` runs the real publish gate
        // (`checkEligibility`, which is date-aware and grants the trial);
        // gating it here as well would decide the same thing twice with a
        // different predicate.
        'create.ts',
        'createDraft.ts',
        'publish.ts',
        'unpublish.ts',
        'softDelete.ts',
        // Calendar and occupancy: gated on CAN_USE_CALENDAR /
        // CAN_SYNC_EXTERNAL_CALENDAR, which are real plan keys rather than
        // floor keys, so they already depend on a subscription.
        'addOccupancy.ts',
        'batchOccupancy.ts',
        'removeOccupancy.ts',
        'updateOccupancyEvent.ts',
        'calendarConnectGoogle.ts',
        'calendarConnectIcal.ts',
        'calendarDisconnect.ts',
        'calendarSync.ts',
        // Reads that happen to POST.
        'compare.ts',
        'import-from-url.ts'
    ],
    gastronomy: [
        // Menu, events and daily specials are gated on MANAGE_GASTRONOMY_*,
        // which are NOT floor keys — they reach an owner only from a plan row,
        // so a lapsed owner already loses them.
        'putMenu.ts',
        'putEvents.ts',
        'putDailySpecials.ts',
        'uploadMenuFile.ts',
        'deleteMenuFile.ts',
        'uploadMenuItemPhoto.ts',
        // A review is the VISITOR's content, not the owner's listing content.
        'createReview.ts'
    ],
    experience: [
        // Gated on ISSUE_EXPERIENCE_CERTIFICATE, a plan key, not a floor key.
        'certificates.ts',
        'createReview.ts'
    ]
};

/** A route file that declares at least one mutating HTTP method. */
interface MutatingRoute {
    readonly file: string;
    readonly source: string;
}

/**
 * Lists the mutating route files in one vertical's `protected/` directory.
 *
 * @param dir - The vertical's directory name.
 * @returns Every `*.ts` (bar `index.ts`) declaring a post/put/patch/delete.
 */
function mutatingRoutes(dir: string): readonly MutatingRoute[] {
    const base = join(ROUTES_DIR, dir, 'protected');
    return readdirSync(base)
        .filter((file) => file.endsWith('.ts') && file !== 'index.ts')
        .map((file) => ({ file, source: readFileSync(join(base, file), 'utf8') }))
        .filter(({ source }) => /method:\s*'(?:post|put|patch|delete)'/.test(source));
}

describe('HOS-1275 — the content-editing subscription gate is declared per route', () => {
    for (const { dir, domain } of VERTICALS) {
        const routes = mutatingRoutes(dir);
        const exempt = new Set(NOT_CONTENT_EDITING[dir] ?? []);

        it(`${dir}: finds mutating routes at all (the search can fail)`, () => {
            // Positive control. A glob that silently matches nothing would make
            // every assertion below vacuously true — the exact way a guard
            // reports "all clean" over a surface it never looked at.
            expect(routes.length).toBeGreaterThan(10);
        });

        for (const { file, source } of routes) {
            if (exempt.has(file)) {
                it(`${dir}/${file}: is exempt, and still exists`, () => {
                    // Keeps the exemption list honest: a renamed or deleted file
                    // must be removed from it rather than left as decoration.
                    expect(source.length).toBeGreaterThan(0);
                });
                continue;
            }

            it(`${dir}/${file}: declares requireLiveSubscription(${domain})`, () => {
                expect(source).toContain(`requireLiveSubscription(ProductDomainEnum.${domain})`);
                // The mount is worth nothing if the import was dropped with it.
                expect(source).toContain("from '../../../middlewares/require-live-subscription'");
            });
        }

        it(`${dir}: every exempt entry names a file that exists`, () => {
            const present = new Set(routes.map((route) => route.file));
            for (const file of exempt) {
                expect(present.has(file), `${dir}/${file} is exempt but not found`).toBe(true);
            }
        });
    }

    it('covers 34 content-editing routes across the three verticals', () => {
        // The number PR #3299's write-up got wrong (it reported the commerce
        // half only). Pinned so a route quietly leaving the set is visible.
        const total = VERTICALS.reduce((sum, { dir }) => {
            const exempt = new Set(NOT_CONTENT_EDITING[dir] ?? []);
            return sum + mutatingRoutes(dir).filter((r) => !exempt.has(r.file)).length;
        }, 0);
        expect(total).toBe(34);
    });
});
