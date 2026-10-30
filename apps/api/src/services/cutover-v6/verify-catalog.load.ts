/**
 * SELECT-only loader of the step 3a {@link CatalogSnapshot} (HOS-1957 G8).
 * The query function is injected so the mapping is testable without Postgres.
 */
import type { CatalogSnapshot } from './verify-catalog.js';

/** Minimal `pg` query surface. */
export type QueryFn = (
    sql: string
) => Promise<{ readonly rows: readonly Record<string, unknown>[] }>;

const num = (value: unknown): number => Number(value);
const numOrNull = (value: unknown): number | null =>
    value === null || value === undefined ? null : Number(value);
const str = (value: unknown): string => String(value);
const strOrNull = (value: unknown): string | null =>
    value === null || value === undefined ? null : String(value);
const dateOrNull = (value: unknown): Date | null =>
    value === null || value === undefined ? null : new Date(value as string | Date);

/**
 * Reads the catalog tables with plain SELECTs.
 *
 * @param input - Query function and the evaluation instant.
 * @returns The snapshot.
 */
export async function loadCatalogSnapshot(input: {
    readonly query: QueryFn;
    readonly now: Date;
}): Promise<CatalogSnapshot> {
    const q = async (sql: string) => (await input.query(sql)).rows;
    const [
        verticals,
        plans,
        versions,
        ents,
        limits,
        options,
        addons,
        addonVersions,
        products,
        promos,
        vDeadlines,
        bDeadlines
    ] = await Promise.all([
        q('SELECT id, activation_event FROM vertical'),
        q('SELECT id, vertical, slug, role FROM plan'),
        q(
            'SELECT id, plan_id, vertical, rank, sellable, current, grace_days, trial_days, allows_pause, inherits_tourist_vip FROM plan_version'
        ),
        q('SELECT plan_version_id, key, plan_quota, trial_quota FROM plan_version_entitlement'),
        q('SELECT plan_version_id, key, value FROM plan_version_limit'),
        q('SELECT plan_version_id, cycle, amount, currency FROM billing_option'),
        q('SELECT id, slug FROM addon'),
        q('SELECT id, addon_id FROM addon_version'),
        q(
            'SELECT id, addon_id, version_id, price, charge_kind, cycle, compatible_verticals FROM addon_product'
        ),
        q(
            'SELECT code, effect_kind, extension_days, discount_kind, value, all_verticals, verticals, valid_from, valid_until, duration_kind, duration_charges, closed_at FROM promo_code'
        ),
        q('SELECT version, "values" FROM vertical_deadline_version'),
        q('SELECT version, "values" FROM billing_deadline_version')
    ]);
    return {
        now: input.now,
        verticals: verticals.map((r) => ({
            id: str(r.id),
            activationEvent: strOrNull(r.activation_event)
        })),
        plans: plans.map((r) => ({
            id: str(r.id),
            vertical: str(r.vertical),
            slug: str(r.slug),
            role: strOrNull(r.role)
        })),
        versions: versions.map((r) => ({
            id: str(r.id),
            planId: str(r.plan_id),
            vertical: str(r.vertical),
            rank: num(r.rank),
            sellable: r.sellable === true,
            current: r.current === true,
            graceDays: num(r.grace_days),
            trialDays: num(r.trial_days),
            allowsPause: r.allows_pause === true,
            inheritsTouristVip: r.inherits_tourist_vip === true
        })),
        entitlements: ents.map((r) => ({
            planVersionId: str(r.plan_version_id),
            key: str(r.key),
            planQuota: numOrNull(r.plan_quota),
            trialQuota: numOrNull(r.trial_quota)
        })),
        limits: limits.map((r) => ({
            planVersionId: str(r.plan_version_id),
            key: str(r.key),
            value: num(r.value)
        })),
        billingOptions: options.map((r) => ({
            planVersionId: str(r.plan_version_id),
            cycle: str(r.cycle),
            amount: num(r.amount),
            currency: str(r.currency)
        })),
        addons: addons.map((r) => ({ id: str(r.id), slug: str(r.slug) })),
        addonVersions: addonVersions.map((r) => ({ id: str(r.id), addonId: str(r.addon_id) })),
        addonProducts: products.map((r) => ({
            id: str(r.id),
            addonId: str(r.addon_id),
            versionId: str(r.version_id),
            price: num(r.price),
            chargeKind: str(r.charge_kind),
            cycle: strOrNull(r.cycle),
            compatibleVerticals: (r.compatible_verticals as readonly string[] | null) ?? []
        })),
        promoCodes: promos.map((r) => ({
            code: str(r.code),
            effectKind: str(r.effect_kind),
            extensionDays: numOrNull(r.extension_days),
            discountKind: strOrNull(r.discount_kind),
            value: numOrNull(r.value),
            allVerticals: r.all_verticals === true,
            verticals: (r.verticals as readonly string[] | null) ?? null,
            validFrom: new Date(r.valid_from as string | Date),
            validUntil: dateOrNull(r.valid_until),
            durationKind: strOrNull(r.duration_kind),
            durationCharges: numOrNull(r.duration_charges),
            closedAt: dateOrNull(r.closed_at)
        })),
        verticalDeadlines: vDeadlines.map((r) => ({ version: num(r.version), values: r.values })),
        billingDeadlines: bDeadlines.map((r) => ({ version: num(r.version), values: r.values }))
    };
}
