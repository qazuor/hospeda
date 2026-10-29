/**
 * Step 3a verifier (HOS-1957 G8, AC:CORTE:8): read-only verification of the
 * production catalog after the structural migration of cutover step 3.
 *
 * Pure module. The script loads a {@link CatalogSnapshot} with SELECTs only
 * and re-runs the panel validation of "publish a plan version" (G-R3, owned by
 * `previewPlanVersion` in `@repo/service-core`) through an injected port, so
 * the validation logic keeps one home. What lives here is everything else
 * paso 3a lists: vertical enum mirror, the four plan roles per vertical, one
 * current version per plan, prices, add-ons, promo codes in force and the
 * version 1 deadlines.
 */
import {
    BillingDeadlineValuesSchema,
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    VerticalDeadlineValuesSchema,
    VerticalEnum
} from '@repo/schemas';

/** `plan` row. */
export interface PlanRow {
    readonly id: string;
    readonly vertical: string;
    readonly slug: string;
    readonly role: string | null;
}

/** `plan_version` row. */
export interface PlanVersionRow {
    readonly id: string;
    readonly planId: string;
    readonly vertical: string;
    readonly rank: number;
    readonly sellable: boolean;
    readonly current: boolean;
    readonly graceDays: number;
    readonly trialDays: number;
    readonly allowsPause: boolean;
    readonly inheritsTouristVip: boolean;
}

/** `plan_version_entitlement` row. */
export interface EntitlementRow {
    readonly planVersionId: string;
    readonly key: string;
    readonly planQuota: number | null;
    readonly trialQuota: number | null;
}

/** `plan_version_limit` row. */
export interface LimitRow {
    readonly planVersionId: string;
    readonly key: string;
    readonly value: number;
}

/** `billing_option` row. */
export interface BillingOptionRow {
    readonly planVersionId: string;
    readonly cycle: string;
    readonly amount: number;
    readonly currency: string;
}

/** `addon_product` row. */
export interface AddonProductRow {
    readonly id: string;
    readonly addonId: string;
    readonly versionId: string;
    readonly price: number;
    readonly chargeKind: string;
    readonly cycle: string | null;
    readonly compatibleVerticals: readonly string[];
}

/** `promo_code` row. */
export interface PromoCodeRow {
    readonly code: string;
    readonly effectKind: string;
    readonly extensionDays: number | null;
    readonly discountKind: string | null;
    readonly value: number | null;
    readonly allVerticals: boolean;
    readonly verticals: readonly string[] | null;
    readonly validFrom: Date;
    readonly validUntil: Date | null;
    readonly durationKind: string | null;
    readonly durationCharges: number | null;
    readonly closedAt: Date | null;
}

/** Everything the verifier reads, as plain data. */
export interface CatalogSnapshot {
    /** Instant the promo "in force" window is evaluated at. */
    readonly now: Date;
    readonly verticals: readonly { readonly id: string; readonly activationEvent: string | null }[];
    readonly plans: readonly PlanRow[];
    readonly versions: readonly PlanVersionRow[];
    readonly entitlements: readonly EntitlementRow[];
    readonly limits: readonly LimitRow[];
    readonly billingOptions: readonly BillingOptionRow[];
    readonly addons: readonly { readonly id: string; readonly slug: string }[];
    readonly addonVersions: readonly { readonly id: string; readonly addonId: string }[];
    readonly addonProducts: readonly AddonProductRow[];
    readonly promoCodes: readonly PromoCodeRow[];
    readonly verticalDeadlines: readonly { readonly version: number; readonly values: unknown }[];
    readonly billingDeadlines: readonly { readonly version: number; readonly values: unknown }[];
}

/** The three non-sellable roles every vertical declares. */
export const REQUIRED_PLAN_ROLES = ['trial', 'pre_trial', 'floor'] as const;

/** The content G-R3 validates for one plan's current version. */
export interface Gr3Candidate {
    readonly planId: string;
    readonly versionId: string;
    readonly vertical: string;
    readonly slug: string;
    readonly content: {
        readonly rank: number;
        readonly sellable: boolean;
        readonly trialDays: number;
        readonly graceDays: number;
        readonly allowsPause: boolean;
        readonly inheritsTouristVip: boolean;
        readonly entitlements: readonly {
            readonly key: string;
            readonly planQuota: number | null;
            readonly trialQuota: number | null;
        }[];
        readonly limits: readonly { readonly key: string; readonly value: number }[];
    };
}

/**
 * One G-R3 outcome: `message` is the rejection text, `null` when it passed.
 */
export interface Gr3Result {
    readonly planId: string;
    readonly versionId: string;
    readonly vertical: string;
    readonly slug: string;
    readonly message: string | null;
}

/**
 * Builds, for each plan with a current version, the content the "publish a plan
 * version" action would receive if that same version were published again.
 * Re-validating it exercises every G-R3 half plus the other panel validations
 * against the real rows.
 *
 * @param input - The snapshot.
 * @returns One candidate per plan that has exactly one current version.
 */
export function buildGr3Candidates(input: {
    readonly snapshot: CatalogSnapshot;
}): readonly Gr3Candidate[] {
    const { snapshot } = input;
    const candidates: Gr3Candidate[] = [];
    for (const plan of snapshot.plans) {
        const current = snapshot.versions.filter((v) => v.planId === plan.id && v.current);
        const version = current.length === 1 ? current[0] : undefined;
        if (version === undefined) continue;
        candidates.push({
            planId: plan.id,
            versionId: version.id,
            vertical: plan.vertical,
            slug: plan.slug,
            content: {
                rank: version.rank,
                sellable: version.sellable,
                trialDays: version.trialDays,
                graceDays: version.graceDays,
                allowsPause: version.allowsPause,
                inheritsTouristVip: version.inheritsTouristVip,
                entitlements: snapshot.entitlements
                    .filter((e) => e.planVersionId === version.id)
                    .map((e) => ({ key: e.key, planQuota: e.planQuota, trialQuota: e.trialQuota })),
                limits: snapshot.limits
                    .filter((l) => l.planVersionId === version.id)
                    .map((l) => ({ key: l.key, value: l.value }))
            }
        });
    }
    return candidates;
}

/** One named check of the verification. */
export interface CatalogCheck {
    readonly id: string;
    readonly title: string;
    readonly ok: boolean;
    readonly failures: readonly string[];
}

/** One price line, for the operator's by-eye comparison with the pre-cut prices. */
export interface PriceLine {
    readonly vertical: string;
    readonly plan: string;
    readonly rank: number;
    readonly cycle: string;
    readonly amount: number;
    readonly currency: string;
}

/** Result of {@link verifyCatalog}. */
export interface CatalogVerification {
    /** `true` only when every check passed: the cut may go on to 3b. */
    readonly ok: boolean;
    readonly checks: readonly CatalogCheck[];
    readonly report: {
        readonly prices: readonly PriceLine[];
        readonly addonProducts: number;
        readonly promoCodesInForce: number;
    };
}

function check(id: string, title: string, failures: readonly string[]): CatalogCheck {
    return { id, title, ok: failures.length === 0, failures };
}

function verifyEnumMirror(snapshot: CatalogSnapshot): CatalogCheck {
    const failures: string[] = [];
    const inDb = new Set(snapshot.verticals.map((v) => v.id));
    const inCode = new Set<string>(Object.values(VerticalEnum));
    for (const id of inCode) if (!inDb.has(id)) failures.push(`vertical '${id}' missing in DB`);
    for (const id of inDb)
        if (!inCode.has(id)) failures.push(`vertical '${id}' not in VerticalEnum`);
    for (const row of snapshot.verticals) {
        const expected = (VERTICAL_ACTIVATION_EVENT_BY_VERTICAL as Record<string, string | null>)[
            row.id
        ];
        if (expected !== undefined && expected !== row.activationEvent) {
            failures.push(
                `vertical '${row.id}' activation_event is ${String(row.activationEvent)}, expected ${String(expected)}`
            );
        }
    }
    return check(
        'enum-mirror',
        'vertical table mirrors VerticalEnum and activation events',
        failures
    );
}

function verifyPlanStructure(snapshot: CatalogSnapshot): CatalogCheck {
    const failures: string[] = [];
    for (const vertical of Object.values(VerticalEnum)) {
        const plans = snapshot.plans.filter((p) => p.vertical === vertical);
        for (const role of REQUIRED_PLAN_ROLES) {
            const count = plans.filter((p) => p.role === role).length;
            if (count !== 1)
                failures.push(`${vertical}: ${count} plans with role '${role}', expected 1`);
        }
        const sellable = plans.filter((p) =>
            snapshot.versions.some((v) => v.planId === p.id && v.current && v.sellable)
        );
        if (sellable.length === 0) failures.push(`${vertical}: no sellable current plan`);
    }
    for (const plan of snapshot.plans) {
        const current = snapshot.versions.filter((v) => v.planId === plan.id && v.current).length;
        if (current !== 1) {
            failures.push(`${plan.vertical}/${plan.slug}: ${current} current versions, expected 1`);
        }
    }
    return check(
        'plan-structure',
        'each vertical has trial, pre_trial, floor and a sellable plan; one current version per plan',
        failures
    );
}

function verifyPrices(snapshot: CatalogSnapshot): { check: CatalogCheck; prices: PriceLine[] } {
    const failures: string[] = [];
    const prices: PriceLine[] = [];
    const planById = new Map(snapshot.plans.map((p) => [p.id, p]));
    for (const version of snapshot.versions.filter((v) => v.current && v.sellable)) {
        const plan = planById.get(version.planId);
        const options = snapshot.billingOptions.filter((o) => o.planVersionId === version.id);
        const label = `${version.vertical}/${plan?.slug ?? version.planId}`;
        if (options.length === 0)
            failures.push(`${label}: sellable current version has no billing option`);
        for (const option of options) {
            if (!Number.isInteger(option.amount) || option.amount <= 0) {
                failures.push(
                    `${label}: ${option.cycle} amount ${option.amount} is not a positive integer`
                );
            }
            if (option.currency !== 'ARS')
                failures.push(`${label}: ${option.cycle} currency ${option.currency}`);
            prices.push({
                vertical: version.vertical,
                plan: plan?.slug ?? version.planId,
                rank: version.rank,
                cycle: option.cycle,
                amount: option.amount,
                currency: option.currency
            });
        }
    }
    prices.sort(
        (a, b) =>
            a.vertical.localeCompare(b.vertical) ||
            a.rank - b.rank ||
            a.cycle.localeCompare(b.cycle)
    );
    return {
        check: check('prices', 'every sellable current version has positive ARS prices', failures),
        prices
    };
}

function verifyAddons(snapshot: CatalogSnapshot): CatalogCheck {
    const failures: string[] = [];
    const verticals = new Set<string>(Object.values(VerticalEnum));
    for (const addon of snapshot.addons) {
        if (!snapshot.addonVersions.some((v) => v.addonId === addon.id)) {
            failures.push(`addon '${addon.slug}': no version`);
        }
        if (!snapshot.addonProducts.some((p) => p.addonId === addon.id)) {
            failures.push(`addon '${addon.slug}': no product (price)`);
        }
    }
    for (const product of snapshot.addonProducts) {
        if (!Number.isInteger(product.price) || product.price <= 0)
            failures.push(`addon product ${product.id}: price ${product.price}`);
        if (
            product.compatibleVerticals.length === 0 ||
            product.compatibleVerticals.some((v) => !verticals.has(v))
        ) {
            failures.push(
                `addon product ${product.id}: compatible verticals [${product.compatibleVerticals.join(',')}]`
            );
        }
        if ((product.chargeKind === 'PERIODICO') !== (product.cycle !== null)) {
            failures.push(
                `addon product ${product.id}: charge kind ${product.chargeKind} with cycle ${String(product.cycle)}`
            );
        }
    }
    if (snapshot.addons.length === 0) failures.push('no add-ons loaded');
    return check(
        'addons',
        'add-ons have a version, a product and valid prices and verticals',
        failures
    );
}

function isInForce(promo: PromoCodeRow, now: Date): boolean {
    return (
        promo.closedAt === null &&
        promo.validFrom <= now &&
        (promo.validUntil === null || promo.validUntil > now)
    );
}

function verifyPromos(snapshot: CatalogSnapshot): { check: CatalogCheck; inForce: number } {
    const failures: string[] = [];
    const verticals = new Set<string>(Object.values(VerticalEnum));
    const inForce = snapshot.promoCodes.filter((p) => isInForce(p, snapshot.now));
    for (const promo of inForce) {
        if (promo.allVerticals !== (promo.verticals === null))
            failures.push(`promo '${promo.code}': all_verticals disagrees with verticals`);
        if (promo.verticals?.some((v) => !verticals.has(v))) {
            failures.push(
                `promo '${promo.code}': unknown vertical in [${promo.verticals.join(',')}]`
            );
        }
        if (promo.effectKind === 'DISCOUNT') {
            if (
                promo.discountKind === null ||
                promo.value === null ||
                promo.durationKind === null
            ) {
                failures.push(`promo '${promo.code}': DISCOUNT without kind, value or duration`);
            } else if (promo.discountKind === 'PERCENTAGE' && promo.value > 100) {
                failures.push(`promo '${promo.code}': percentage ${promo.value} over 100`);
            }
        } else if (promo.effectKind === 'TRIAL_EXTENSION') {
            if (promo.extensionDays === null || promo.extensionDays <= 0)
                failures.push(`promo '${promo.code}': TRIAL_EXTENSION without positive days`);
        } else {
            failures.push(`promo '${promo.code}': unknown effect ${promo.effectKind}`);
        }
    }
    return {
        check: check(
            'promo-codes',
            'promo codes in force have a coherent effect and known verticals',
            failures
        ),
        inForce: inForce.length
    };
}

function verifyDeadlines(snapshot: CatalogSnapshot): CatalogCheck {
    const failures: string[] = [];
    const pairs = [
        {
            name: 'vertical_deadline_version',
            rows: snapshot.verticalDeadlines,
            schema: VerticalDeadlineValuesSchema
        },
        {
            name: 'billing_deadline_version',
            rows: snapshot.billingDeadlines,
            schema: BillingDeadlineValuesSchema
        }
    ] as const;
    for (const { name, rows, schema } of pairs) {
        const one = rows.find((r) => r.version === 1);
        if (one === undefined) {
            failures.push(`${name}: version 1 is missing`);
            continue;
        }
        for (const row of rows) {
            const parsed = schema.safeParse(row.values);
            if (!parsed.success) {
                failures.push(
                    `${name} v${row.version}: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`
                );
            }
        }
    }
    return check(
        'deadlines',
        'deadline version 1 exists and every version satisfies the deadline validations',
        failures
    );
}

function verifyGr3(results: readonly Gr3Result[], snapshot: CatalogSnapshot): CatalogCheck {
    const failures = results
        .filter((r) => r.message !== null)
        .map((r) => `${r.vertical}/${r.slug}: ${r.message}`);
    const expected = buildGr3Candidates({ snapshot }).length;
    if (results.length !== expected) {
        failures.push(`G-R3 ran on ${results.length} plans, expected ${expected}`);
    }
    return check(
        'g-r3',
        'G-R3 and the panel validations accept every current plan version',
        failures
    );
}

/**
 * Runs every paso 3a check over the snapshot.
 *
 * @param input - The loaded snapshot and the G-R3 outcomes for
 * {@link buildGr3Candidates}.
 * @returns Per-check results, the price table and `ok` (false: the cut stops).
 */
export function verifyCatalog(input: {
    readonly snapshot: CatalogSnapshot;
    readonly gr3Results: readonly Gr3Result[];
}): CatalogVerification {
    const { snapshot } = input;
    const prices = verifyPrices(snapshot);
    const promos = verifyPromos(snapshot);
    const checks = [
        verifyEnumMirror(snapshot),
        verifyPlanStructure(snapshot),
        verifyGr3(input.gr3Results, snapshot),
        prices.check,
        verifyAddons(snapshot),
        promos.check,
        verifyDeadlines(snapshot)
    ];
    return {
        ok: checks.every((c) => c.ok),
        checks,
        report: {
            prices: prices.prices,
            addonProducts: snapshot.addonProducts.length,
            promoCodesInForce: promos.inForce
        }
    };
}
