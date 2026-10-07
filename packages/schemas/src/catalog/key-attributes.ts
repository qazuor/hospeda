import { z } from 'zod';

/**
 * Whether a catalog key is a boolean capability or a numeric limit.
 *
 * `entitlement` keys are switches; `limit` keys carry a number whose value lives
 * in the database, never in code.
 */
export const KEY_KINDS = ['entitlement', 'limit'] as const;
export type KeyKind = (typeof KEY_KINDS)[number];
export const KeyKindSchema = z.enum(KEY_KINDS);

/**
 * Where a key is resolved: per `user + vertical`, or per `user` (a global key,
 * such as a profile badge). A metered key is always `vertical`; that rule is
 * enforced by the resolution unit, not here.
 */
export const KEY_SCOPES = ['vertical', 'global'] as const;
export type KeyScope = (typeof KEY_SCOPES)[number];
export const KeyScopeSchema = z.enum(KEY_SCOPES);

/**
 * Aggregation strategy: how several sources granting the same key fold into one
 * value (cap. 15 section 2.2). Closed list. English identifier on the left,
 * the spec's Spanish name on the right:
 *
 * - `SUM`           = `SUMA`: add every source (photos, listings).
 * - `MAX`           = `MAXIMO`: the highest wins. Also how a boolean key folds
 *                     (granted wins over not granted).
 * - `MIN`           = `MINIMO`: the lowest wins (a response-time commitment).
 * - `BEST_DECLARED` = `MEJOR_DECLARADO`: the key declares an order over its
 *                     values and the best wins (support level).
 */
export const AGGREGATION_STRATEGIES = ['SUM', 'MAX', 'MIN', 'BEST_DECLARED'] as const;
export type AggregationStrategy = (typeof AGGREGATION_STRATEGIES)[number];
export const AggregationStrategySchema = z.enum(AGGREGATION_STRATEGIES);

/**
 * What happens to the excess when the effective value drops below what is in
 * use (cap. 15 section 4.3: never delete, only archive, unpublish or disable).
 *
 * - `ARCHIVE`   : the newest excess items are archived.
 * - `UNPUBLISH` : the newest excess listings are unpublished.
 * - `DISABLE`   : the capability or the account stops working.
 * - `NONE`      : nothing persisted to reconcile; the gate is evaluated live.
 */
export const ENFORCEMENT_STRATEGIES = ['ARCHIVE', 'UNPUBLISH', 'DISABLE', 'NONE'] as const;
export type EnforcementStrategy = (typeof ENFORCEMENT_STRATEGIES)[number];
export const EnforcementStrategySchema = z.enum(ENFORCEMENT_STRATEGIES);

/**
 * Key class (DEC-ENT-005), the attribute `G-R3` reads. Closed list of two:
 *
 * - `COMERCIAL`: exercising it produces or sustains public presence, or
 *   consumes a limit or a metered quota.
 * - `DE_ACCESO`: exercising it produces no presence and consumes nothing. It
 *   only lets a person exist, recover what is theirs and subscribe again.
 */
export const KEY_CLASSES = ['COMERCIAL', 'DE_ACCESO'] as const;
export type KeyClass = (typeof KEY_CLASSES)[number];
export const KeyClassSchema = z.enum(KEY_CLASSES);

/**
 * One catalog entry: a name plus its four declared attributes (scope,
 * aggregation strategy, enforcement strategy, class). `kind` only says which of
 * the two lists the name belongs to.
 *
 * The schema is STRICT on purpose: a value, price or plan assignment attached to
 * a key is rejected, because code holds names and attributes only.
 */
export const CatalogKeyDefinitionSchema = z
    .object({
        key: z.string().regex(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/),
        kind: KeyKindSchema,
        scope: KeyScopeSchema,
        aggregationStrategy: AggregationStrategySchema,
        enforcementStrategy: EnforcementStrategySchema,
        keyClass: KeyClassSchema
    })
    .strict();
export type CatalogKeyDefinition = z.infer<typeof CatalogKeyDefinitionSchema>;
