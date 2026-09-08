/**
 * Static guard: no add-on IN THE STATIC CATALOGUE
 * (`packages/billing/src/config/addons.config.ts`) may grant an entitlement that
 * `entitlement-filter.ts` reads, while the owner-entitlement cache is blind to
 * add-ons (HOS-847 PR 7c).
 *
 * ## What this guard does NOT cover
 *
 * The catalogue the RUNTIME reads is DB-backed: `AddonCatalogService` maps
 * `billing_addons.entitlements` into `grantsEntitlement`
 * (`packages/service-core/src/services/billing/addon/addon-catalog.mapper.ts`),
 * and `POST`/`PATCH /api/v1/admin/addons` write that column with no allow-list
 * (`apps/api/src/routes/billing/admin/addons.ts`). A row created or edited
 * through that path can grant an entitlement the filter reads without this
 * file — a static scan of a TypeScript config — ever seeing it. Closing that
 * half means validating `grantsEntitlement` inside `AddonCatalogService`; it is
 * deliberately out of scope here, so read a green run as "the shipped config is
 * clean", never as "no add-on anywhere can grant this".
 *
 * ## The blind path this guard watches over
 *
 * `resolveOwnerEntitlementSet`
 * (`apps/api/src/middlewares/owner-entitlement.ts`) answers a cache HIT from the
 * owner's PLAN alone. On a non-granting cached status it returns an EMPTY set
 * without ever looking at add-on grants, and on a granting one it returns
 * `loadPlanEntitlements(planId)` — again plan-only. A MISS is safe (it falls
 * through to the live resolution); a HIT is where add-ons disappear.
 *
 * That set is what `entitlement-filter.ts` consults to decide what seven public
 * listing endpoints show about an accommodation. So if an add-on ever granted
 * one of the entitlements that filter reads, an owner who BOUGHT it would see
 * the feature vanish from their public listing whenever the cache answered —
 * intermittently, only in production, and only for paying customers.
 *
 * ## Why a guard instead of closing the path
 *
 * Measured: today the filter reads exactly four entitlements and NO add-on in
 * the static catalogue grants any of them. Closing the hole meant walking add-on grants
 * on every cache hit — up to 2x100 extra queries per list response — to change
 * literally no response. The owner's decision was to keep the cheap path and
 * make the day it stops being safe fail loudly instead of silently.
 *
 * This guard therefore asserts an INVARIANT, not an implementation. When it
 * fails, the correct fix is NOT to edit the expected list: it is to make
 * `resolveOwnerEntitlementSet` consult add-on grants (or to give the filter a
 * live resolution for that key), because the premise that made skipping them
 * free has just stopped holding.
 *
 * ## Anchoring
 *
 * Both sides are DERIVED, not frozen by hand:
 *
 * - the entitlements the filter reads come from scanning its source for
 *   `EntitlementKey.<NAME>`, so a fifth key added to that file joins the set
 *   without anyone updating this test;
 * - the add-ons come from every `AddonDefinition` REACHABLE from the static
 *   catalogue module — not just `ALL_ADDONS` — because this repo already keeps
 *   deliberate exclusions from an `ALL_*` aggregate (the commerce plans are kept
 *   out of `ALL_PLANS` on purpose), and an add-on parked outside the array is
 *   exactly the one nobody would think to check. Reachable from that module is
 *   the whole reach: a `billing_addons` row has no TypeScript export to find.
 *
 * The derivation has one escape it cannot see: a read written as
 * `ownerEntitlements.includes(someVariable)`. The floor assertion below turns
 * that from a silent empty set into a failure.
 *
 * @module test/utils/entitlement-filter-addon-grant.guard
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as billingModule from '@repo/billing';
import { EntitlementKey } from '@repo/billing';
import { describe, expect, it } from 'vitest';

const FILTER_SOURCE_PATH = resolve(import.meta.dirname, '../../src/utils/entitlement-filter.ts');
const BLIND_PATH = 'apps/api/src/middlewares/owner-entitlement.ts (resolveOwnerEntitlementSet)';

/** Every `EntitlementKey.X` member name the enum actually declares. */
const ENTITLEMENT_MEMBER_NAMES = new Set(Object.keys(EntitlementKey));

/**
 * The entitlements `entitlement-filter.ts` reads, derived from its source.
 *
 * Scanning beats a hand-list for the reason the INV-1 guard's auto-discovery
 * block exists: a guard that only checks what someone remembered to list is not
 * a guard against forgetting to list something.
 */
function deriveFilterReadEntitlements(): ReadonlySet<string> {
    const source = readFileSync(FILTER_SOURCE_PATH, 'utf-8');
    const found = new Set<string>();

    for (const match of source.matchAll(/EntitlementKey\.([A-Z0-9_]+)/g)) {
        const memberName = match[1];
        if (memberName && ENTITLEMENT_MEMBER_NAMES.has(memberName)) {
            found.add((EntitlementKey as Record<string, string>)[memberName] as string);
        }
    }

    return found;
}

/**
 * The four keys the filter read when this guard was written, kept as a FLOOR.
 *
 * Not the expected set — the derived scan is authoritative and may legitimately
 * grow. This exists so a refactor that moves the reads behind a variable (which
 * the regex cannot see) fails here instead of quietly deriving an empty set and
 * passing forever.
 */
const KNOWN_FILTER_ENTITLEMENTS: readonly EntitlementKey[] = [
    EntitlementKey.CAN_USE_RICH_DESCRIPTION,
    EntitlementKey.CAN_EMBED_VIDEO,
    EntitlementKey.HAS_VERIFICATION_BADGE,
    EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY
];

/** An add-on as this guard needs to see it. */
interface CatalogueAddon {
    readonly slug: string;
    readonly grantsEntitlement: string | null;
}

/** Structural test — avoids importing the type just to narrow a namespace value. */
function isAddonDefinition(value: unknown): value is CatalogueAddon {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return typeof record.slug === 'string' && 'grantsEntitlement' in record;
}

/**
 * Every add-on reachable from the billing catalogue module: the members of any
 * exported array AND any exported definition on its own, deduplicated by slug.
 */
function collectCatalogueAddons(): readonly CatalogueAddon[] {
    const bySlug = new Map<string, CatalogueAddon>();

    for (const exported of Object.values(billingModule as Record<string, unknown>)) {
        if (isAddonDefinition(exported)) {
            bySlug.set(exported.slug, exported);
            continue;
        }
        if (Array.isArray(exported)) {
            for (const item of exported) {
                if (isAddonDefinition(item)) {
                    bySlug.set(item.slug, item);
                }
            }
        }
    }

    return [...bySlug.values()];
}

const FILTER_ENTITLEMENTS = deriveFilterReadEntitlements();
const CATALOGUE_ADDONS = collectCatalogueAddons();

describe('entitlement-filter × add-on catalogue (HOS-847 PR 7c)', () => {
    it('derives a non-empty set of entitlements from the filter source', () => {
        expect(
            FILTER_ENTITLEMENTS.size,
            `No "EntitlementKey.X" reads were found in ${FILTER_SOURCE_PATH}.\nThe scan that feeds this guard has gone blind — most likely the reads now go through a variable. Restore a form the scan can see, or replace the derivation; do NOT leave this guard deriving an empty set, which would pass against every add-on forever.`
        ).toBeGreaterThan(0);
    });

    it.each(
        KNOWN_FILTER_ENTITLEMENTS
    )('still sees the filter read %s', (entitlement: EntitlementKey) => {
        expect(
            FILTER_ENTITLEMENTS.has(entitlement),
            `${entitlement} was read by entitlement-filter.ts when this guard was written and the source scan no longer finds it.\nEither the filter genuinely stopped reading it (then drop it from KNOWN_FILTER_ENTITLEMENTS here, with the reason) or the read moved behind a variable the scan cannot see — in which case this guard is now weaker than it looks and must be re-anchored.`
        ).toBe(true);
    });

    it('finds the add-on catalogue (guard against an empty import)', () => {
        expect(
            CATALOGUE_ADDONS.length,
            'No add-on definitions were reachable from @repo/billing. A stale build of the package makes every export undefined, and this guard would then pass against a catalogue it never read.'
        ).toBeGreaterThan(5);
    });

    it.each(
        CATALOGUE_ADDONS.map((addon) => [addon.slug, addon] as const)
    )('static add-on %s grants nothing the owner-entitlement cache would hide', (_slug: string, addon: CatalogueAddon) => {
        if (addon.grantsEntitlement === null || addon.grantsEntitlement === undefined) {
            // Limit-only add-ons cannot trip this: limits are resolved on a
            // different path entirely.
            return;
        }

        expect(
            FILTER_ENTITLEMENTS.has(addon.grantsEntitlement),
            `Static-catalogue add-on "${addon.slug}" grants ${addon.grantsEntitlement}, which entitlement-filter.ts READS.\n\nThat combination is not safe today. ${BLIND_PATH} answers a cache HIT from the owner's PLAN alone — an empty set on a non-granting status, plan entitlements otherwise — and never consults add-on grants. So an owner who PAID for this add-on would have the feature stripped from their public listing on every request the cache answers: intermittent, production-only, and only for paying customers.\n\nThe fix is NOT to delete this expectation or to move the add-on. Either teach resolveOwnerEntitlementSet to fold in add-on grants on the cache-hit path, or give this entitlement a live resolution in the filter. The premise that made skipping add-on grants free — that no add-on in the SHIPPED CONFIG grants anything the filter reads — has just stopped holding, and this guard exists to say so on the day it does.\n\nScope: this guard reads the static catalogue only. A \`billing_addons\` row written through POST/PATCH /api/v1/admin/addons carries the same risk and is NOT checked here.`
        ).toBe(false);
    });
});
