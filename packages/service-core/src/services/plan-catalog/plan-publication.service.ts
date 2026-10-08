import {
    and,
    billingOptions,
    catalogKeys,
    eq,
    getDb,
    inArray,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    verticals
} from '@repo/db';
import type {
    BillingCycle,
    CreatePlanRequest,
    PlanPublicationChange,
    PlanPublicationConfirmation,
    PlanRole,
    PlanVersionContentInput
} from '@repo/schemas';
import {
    PermissionEnum,
    PLAN_ROLES,
    ServiceErrorCode,
    VERTICAL_ACTIVATION_KEY
} from '@repo/schemas';
import type { Actor, DrizzleClient } from '../../types';
import { ServiceError } from '../../types';

/**
 * Action 18 — *publish a plan version* (HOS-1436, piece V2, AC:V2:6 and
 * AC:V2:7). Creates a plan, publishes a version (which is how a plan is
 * retired — publishing a non-sellable version — and how a retire is undone),
 * previews the key-by-key confirmation and applies the G-R3 validation the
 * action used to be a CI guard for.
 *
 * The whole action is `SUPER_ADMIN` only. The permission is
 * `MAINTENANCE_MODE_WRITE` (provisional, Coord-20): no new permission is
 * created.
 */

/** A plan version row. */
type PlanVersionRow = typeof planVersions.$inferSelect;

/** One entitlement effect, as read back from a version. */
interface EntitlementEffect {
    readonly key: string;
    readonly planQuota: number | null;
    readonly trialQuota: number | null;
}

/** The vertical catalog the validation reads, with each plan's current version. */
interface CatalogPlan {
    readonly id: string;
    readonly role: PlanRole | null;
    readonly currentVersion: PlanVersionRow | null;
}

/** Everything the G-R3 validation and the confirmation need. */
interface PublicationContext {
    readonly planId: string;
    readonly vertical: string;
    readonly activationEvent: string | null;
    readonly role: PlanRole | null;
    readonly previous: PlanVersionRow | null;
    readonly catalog: readonly CatalogPlan[];
    readonly content: PlanVersionContentInput;
    readonly keyClasses: ReadonlyMap<string, string>;
    /** The current version's cycles, read when the request declares none. */
    readonly previousCycles?: readonly BillingCycle[];
}

/**
 * The message of each rejection of AC:V2:7. Each cause has its OWN message —
 * never one message for several causes. The four halves of G-R3 keep the exact
 * wording the spec fixes (V2.md:507-520).
 */
export const PLAN_PUBLICATION_REJECTIONS = {
    sellableNonSellableRole:
        'un plan no vendible por construcción no puede publicar una versión vendible',
    extraKey: 'clave de más',
    floorKeyMissing: 'clave de piso que falta',
    activationIff: 'activación fuera del si y sólo si',
    vipInheritance: 'herencia de VIP fuera de una versión vendible',
    duplicateRank: 'rank repetido entre las versiones vendibles y vigentes de la vertical',
    planWithoutCurrent: 'el plan no queda con exactamente una versión vigente',
    trialDaysFlip: 'los días de prueba de la vertical no pueden pasar de cero a más, ni al revés',
    graceNotShorter: 'la gracia debe ser menor que el ciclo más corto que la versión ofrece'
} as const;

/** The two keys the floor version must grant (G-R3 half (b)). */
const FLOOR_REQUIRED_KEYS = ['subscribe_to_plan', 'recover_own_listing'] as const;

/**
 * The minimum length in days of each cycle. Cause (h) compares the grace
 * against the shortest cycle the version offers: a grace that is not strictly
 * shorter would outlive the cycle it is meant to bridge.
 */
export const CYCLE_MINIMUM_DAYS: Readonly<Record<BillingCycle, number>> = {
    monthly: 28,
    quarterly: 89,
    semiannual: 181,
    annual: 365
};

/**
 * Injected port that counts the customers a version reaches. The real one
 * returns `0` because the subscription anchor to `plan_version` does not exist
 * yet (it lands with `B3`); this is a B3 follow-up.
 */
export type CountAnchoredCustomersPort = (input: {
    readonly planVersionId: string | null;
}) => Promise<number>;

/** The default port: no anchoring exists yet, so publishing reaches nobody. */
export const zeroAnchoredCustomers: CountAnchoredCustomersPort = async () => 0;

/** The confirmation message ACC:18 fixes. */
const CONFIRMATION_MESSAGE =
    'Publicar no mueve a los clientes anclados: cambian por un aumento o por la acción 17.';

/** The service transaction client; a plain Drizzle client outside a transaction. */
type Client = DrizzleClient;

/** Rejects every caller without the super-admin write permission. */
function requirePlanPublisher(actor: Actor): void {
    if (!actor.permissions.includes(PermissionEnum.MAINTENANCE_MODE_WRITE)) {
        throw new ServiceError(
            ServiceErrorCode.FORBIDDEN,
            'Sólo SUPER_ADMIN puede publicar versiones de plan'
        );
    }
}

/** Loads each key's class from the code catalog (`catalog_key`). */
async function loadKeyClasses(
    client: Client,
    keys: readonly string[]
): Promise<ReadonlyMap<string, string>> {
    if (keys.length === 0) return new Map();
    const rows = await client
        .select({ key: catalogKeys.key, keyClass: catalogKeys.keyClass })
        .from(catalogKeys)
        .where(inArray(catalogKeys.key, [...new Set(keys)]));
    return new Map(rows.map((row) => [row.key, row.keyClass]));
}

/** Loads the vertical catalog with each plan's current version. */
async function loadCatalog(client: Client, vertical: string): Promise<readonly CatalogPlan[]> {
    const planRows = await client
        .select({ id: plans.id, role: plans.role })
        .from(plans)
        .where(eq(plans.vertical, vertical));
    const currentRows = await client
        .select()
        .from(planVersions)
        .where(and(eq(planVersions.vertical, vertical), eq(planVersions.current, true)));
    const byPlan = new Map(currentRows.map((row) => [row.planId, row]));
    return planRows.map((row) => ({
        id: row.id,
        role: row.role as PlanRole | null,
        currentVersion: byPlan.get(row.id) ?? null
    }));
}

/** Loads one version's entitlements and limits. */
async function loadEffects(
    client: Client,
    versionId: string
): Promise<{ entitlements: EntitlementEffect[]; limits: { key: string; value: number }[] }> {
    const entitlements = await client
        .select({
            key: planVersionEntitlements.key,
            planQuota: planVersionEntitlements.planQuota,
            trialQuota: planVersionEntitlements.trialQuota
        })
        .from(planVersionEntitlements)
        .where(eq(planVersionEntitlements.planVersionId, versionId));
    const limits = await client
        .select({ key: planVersionLimits.key, value: planVersionLimits.value })
        .from(planVersionLimits)
        .where(eq(planVersionLimits.planVersionId, versionId));
    return { entitlements, limits };
}

/** Whether a key's class marks it commercial. */
function isCommercial(key: string, keyClasses: ReadonlyMap<string, string>): boolean {
    return keyClasses.get(key) === 'COMMERCIAL';
}

/**
 * The G-R3 validation plus the sellable-role invariant, each cause with its own
 * message. Throws a `VALIDATION_ERROR` (HTTP 422 at the route) on the FIRST
 * cause it finds, in the order the AC lists them.
 */
function validatePublication(context: PublicationContext): void {
    const { content, role, activationEvent, catalog, planId, keyClasses, previousCycles } = context;
    const entitlementKeys = content.entitlements.map((item) => item.key);
    const reject = (message: string): never => {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, message);
    };

    // A plan of a non-sellable role publishes only non-sellable versions.
    if (role !== null && content.sellable) {
        reject(PLAN_PUBLICATION_REJECTIONS.sellableNonSellableRole);
    }

    // (a) a non-sellable version grants no commercial key and no metered entitlement.
    if (role !== null) {
        const commercialEntitlement = content.entitlements.some(
            (item) =>
                isCommercial(item.key, keyClasses) ||
                item.planQuota != null ||
                item.trialQuota != null
        );
        const commercialLimit = content.limits.some((item) => isCommercial(item.key, keyClasses));
        if (commercialEntitlement || commercialLimit) {
            reject(PLAN_PUBLICATION_REJECTIONS.extraKey);
        }
    }

    // (b) the floor version grants "subscribe_to_plan" and "recover_own_listing".
    if (role === 'floor') {
        const missing = FLOOR_REQUIRED_KEYS.some((key) => !entitlementKeys.includes(key));
        if (missing) reject(PLAN_PUBLICATION_REJECTIONS.floorKeyMissing);
    }

    // (c) the activation capability holds "if and only if".
    if (role === 'pre_trial') {
        const grantsActivation = entitlementKeys.includes(VERTICAL_ACTIVATION_KEY);
        const trialPlan = catalog.find((plan) => plan.role === 'trial');
        const trialDaysPositive = (trialPlan?.currentVersion?.trialDays ?? 0) > 0;
        const expected = activationEvent != null && trialDaysPositive;
        if (grantsActivation !== expected) {
            reject(PLAN_PUBLICATION_REJECTIONS.activationIff);
        }
    }

    // (d) no trial or non-sellable version inherits Turista VIP.
    if (role !== null && content.inheritsTouristVip) {
        reject(PLAN_PUBLICATION_REJECTIONS.vipInheritance);
    }

    // (e) a sellable, current version repeats no rank in the vertical.
    if (role === null && content.sellable) {
        const repeated = catalog.some(
            (plan) =>
                plan.id !== planId &&
                plan.currentVersion != null &&
                plan.currentVersion.sellable &&
                plan.currentVersion.rank === content.rank
        );
        if (repeated) reject(PLAN_PUBLICATION_REJECTIONS.duplicateRank);
    }

    // (f) every plan of the vertical keeps exactly one current version. The
    // target plan is about to receive the version being published.
    const planWithoutCurrent = catalog.some(
        (plan) => plan.id !== planId && plan.currentVersion == null
    );
    if (planWithoutCurrent) reject(PLAN_PUBLICATION_REJECTIONS.planWithoutCurrent);

    // (g) a trial plan never crosses zero trial days on either direction.
    if (role === 'trial' && context.previous != null) {
        const wasPositive = context.previous.trialDays > 0;
        const isPositive = content.trialDays > 0;
        if (wasPositive !== isPositive) reject(PLAN_PUBLICATION_REJECTIONS.trialDaysFlip);
    }

    // (h) the grace is strictly shorter than the shortest cycle the version offers.
    // The cycles come from the request, else from the current version's billing
    // options; with neither, (h) does not apply.
    const cycles = content.cycles ?? previousCycles;
    if (cycles != null && cycles.length > 0) {
        const shortest = Math.min(...cycles.map((cycle) => CYCLE_MINIMUM_DAYS[cycle]));
        if (content.graceDays >= shortest) {
            reject(PLAN_PUBLICATION_REJECTIONS.graceNotShorter);
        }
    }
}

/** Reads the cycles of a version's billing options. */
async function loadVersionCycles(
    client: Client,
    versionId: string
): Promise<readonly BillingCycle[] | undefined> {
    const rows = await client
        .select({ cycle: billingOptions.cycle })
        .from(billingOptions)
        .where(eq(billingOptions.planVersionId, versionId));
    if (rows.length === 0) return undefined;
    return rows.map((row) => row.cycle as BillingCycle);
}

/** Assembles the publication context, running the reads the validation needs. */
async function buildContext(
    client: Client,
    input: { planId: string; content: PlanVersionContentInput }
): Promise<PublicationContext & { previousCycles?: readonly BillingCycle[] }> {
    const [planRow] = await client
        .select({ id: plans.id, vertical: plans.vertical, role: plans.role })
        .from(plans)
        .where(eq(plans.id, input.planId))
        .limit(1);
    if (!planRow) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'El plan no existe');
    }
    const [verticalRow] = await client
        .select({ activationEvent: verticals.activationEvent })
        .from(verticals)
        .where(eq(verticals.id, planRow.vertical))
        .limit(1);
    const catalog = await loadCatalog(client, planRow.vertical);
    const target = catalog.find((plan) => plan.id === planRow.id);
    const previous = target?.currentVersion ?? null;
    const keys = [
        ...input.content.entitlements.map((item) => item.key),
        ...input.content.limits.map((item) => item.key)
    ];
    const keyClasses = await loadKeyClasses(client, keys);
    const previousCycles = previous ? await loadVersionCycles(client, previous.id) : undefined;
    const context = {
        planId: planRow.id,
        vertical: planRow.vertical,
        activationEvent: verticalRow?.activationEvent ?? null,
        role: planRow.role as PlanRole | null,
        previous,
        catalog,
        content: input.content,
        keyClasses,
        previousCycles
    };
    validatePublication(context);
    return context;
}

/** Deep-equality for the confirmation's from/to values. */
function sameValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Builds the key-by-key confirmation against the current version. */
function buildChanges(context: PublicationContext): PlanPublicationChange[] {
    const { content, previous } = context;
    const changes: PlanPublicationChange[] = [];
    const settings: readonly [string, unknown, unknown][] = [
        ['rank', previous?.rank ?? null, content.rank],
        ['sellable', previous?.sellable ?? null, content.sellable],
        ['trialDays', previous?.trialDays ?? null, content.trialDays],
        ['graceDays', previous?.graceDays ?? null, content.graceDays],
        ['allowsPause', previous?.allowsPause ?? null, content.allowsPause],
        ['inheritsTouristVip', previous?.inheritsTouristVip ?? null, content.inheritsTouristVip]
    ];
    for (const [key, from, to] of settings) {
        if (!sameValue(from, to)) changes.push({ key, kind: 'setting', from, to });
    }
    return changes;
}

/** Builds the confirmation, including the entitlements and limits deltas. */
async function buildConfirmation(
    client: Client,
    context: PublicationContext,
    countAnchoredCustomers: CountAnchoredCustomersPort
): Promise<PlanPublicationConfirmation> {
    const changes = buildChanges(context);
    const previousEffects = context.previous
        ? await loadEffects(client, context.previous.id)
        : { entitlements: [], limits: [] };
    const previousEntitlements = new Map(previousEffects.entitlements.map((e) => [e.key, e]));
    const previousLimits = new Map(previousEffects.limits.map((l) => [l.key, l.value]));

    for (const entitlement of context.content.entitlements) {
        const from = previousEntitlements.get(entitlement.key) ?? null;
        const to = {
            planQuota: entitlement.planQuota ?? null,
            trialQuota: entitlement.trialQuota ?? null
        };
        const fromValue = from ? { planQuota: from.planQuota, trialQuota: from.trialQuota } : null;
        if (!sameValue(fromValue, to)) {
            changes.push({ key: entitlement.key, kind: 'entitlement', from: fromValue, to });
        }
    }
    for (const [key, effect] of previousEntitlements) {
        if (!context.content.entitlements.some((item) => item.key === key)) {
            changes.push({
                key,
                kind: 'entitlement',
                from: { planQuota: effect.planQuota, trialQuota: effect.trialQuota },
                to: null
            });
        }
    }
    for (const limit of context.content.limits) {
        const from = previousLimits.get(limit.key) ?? null;
        if (!sameValue(from, limit.value)) {
            changes.push({ key: limit.key, kind: 'limit', from, to: limit.value });
        }
    }
    for (const [key, value] of previousLimits) {
        if (!context.content.limits.some((item) => item.key === key)) {
            changes.push({ key, kind: 'limit', from: value, to: null });
        }
    }

    const anchoredCustomers = await countAnchoredCustomers({
        planVersionId: context.previous?.id ?? null
    });
    return {
        planId: context.planId,
        vertical: context.vertical,
        role: context.role,
        sellable: context.content.sellable,
        currentVersionId: context.previous?.id ?? null,
        anchoredCustomers,
        changes,
        message: CONFIRMATION_MESSAGE
    };
}

/** Creates a plan (action 18). `role` is accepted only here and never updated. */
export async function createPlan(input: {
    actor: Actor;
    data: CreatePlanRequest;
}): Promise<typeof plans.$inferSelect> {
    requirePlanPublisher(input.actor);
    if (input.data.role != null && !PLAN_ROLES.includes(input.data.role)) {
        throw new ServiceError(ServiceErrorCode.VALIDATION_ERROR, 'Rol de plan inválido');
    }
    const [row] = await getDb()
        .insert(plans)
        .values({
            vertical: input.data.vertical,
            slug: input.data.slug,
            name: input.data.name,
            description: input.data.description ?? null,
            pricingOrder: input.data.pricingOrder ?? 0,
            role: input.data.role ?? null
        })
        .returning();
    if (!row) throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'No se creó el plan');
    return row;
}

/** Builds the confirmation of publishing a version; writes nothing. */
export async function previewPlanVersion(input: {
    actor: Actor;
    planId: string;
    content: PlanVersionContentInput;
    countAnchoredCustomers?: CountAnchoredCustomersPort;
}): Promise<PlanPublicationConfirmation> {
    requirePlanPublisher(input.actor);
    const client = getDb();
    const context = await buildContext(client, {
        planId: input.planId,
        content: input.content
    });
    return buildConfirmation(
        client,
        context,
        input.countAnchoredCustomers ?? zeroAnchoredCustomers
    );
}

/**
 * Publishes a version of a plan. Retiring a plan and undoing a retire are both
 * this action: the retire publishes a non-sellable version, the undo publishes
 * a sellable one. Previous current version is flipped off, the new version and
 * its effects are written in the SAME transaction (extras 041 requires it).
 */
export async function publishPlanVersion(input: {
    actor: Actor;
    planId: string;
    content: PlanVersionContentInput;
    countAnchoredCustomers?: CountAnchoredCustomersPort;
}): Promise<PlanVersionRow> {
    requirePlanPublisher(input.actor);
    return getDb().transaction(async (tx) => {
        const context = await buildContext(tx, {
            planId: input.planId,
            content: input.content
        });
        await tx
            .update(planVersions)
            .set({ current: false })
            .where(and(eq(planVersions.planId, context.planId), eq(planVersions.current, true)));
        const [published] = await tx
            .insert(planVersions)
            .values({
                planId: context.planId,
                vertical: context.vertical,
                rank: context.content.rank,
                sellable: context.content.sellable,
                current: true,
                graceDays: context.content.graceDays,
                trialDays: context.content.trialDays,
                allowsPause: context.content.allowsPause,
                inheritsTouristVip: context.content.inheritsTouristVip
            })
            .returning();
        if (!published) {
            throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'No se publicó la versión');
        }
        if (context.content.entitlements.length > 0) {
            await tx.insert(planVersionEntitlements).values(
                context.content.entitlements.map((item) => {
                    const planQuota = item.planQuota ?? null;
                    const trialQuota = item.trialQuota ?? null;
                    if ((planQuota == null) !== (trialQuota == null)) {
                        throw new ServiceError(
                            ServiceErrorCode.VALIDATION_ERROR,
                            'Un entitlement medido lleva sus dos cuotas o ninguna'
                        );
                    }
                    return {
                        planVersionId: published.id,
                        key: item.key,
                        planQuota,
                        trialQuota
                    };
                })
            );
        }
        if (context.content.limits.length > 0) {
            await tx.insert(planVersionLimits).values(
                context.content.limits.map((item) => ({
                    planVersionId: published.id,
                    key: item.key,
                    value: item.value
                }))
            );
        }
        return published;
    });
}
