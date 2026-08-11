import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { HostTradeReviewSchema } from '../../host-trade-review/host-trade-review.schema.js';
import * as reviewBarrel from '../../host-trade-review/index.js';
import { HostTradeReviewReplySchema } from '../../host-trade-review-reply/host-trade-review-reply.schema.js';
import * as replyBarrel from '../../host-trade-review-reply/index.js';
import { HostTradeBenefitUsageSchema } from '../../host-trade-usage/host-trade-usage.schema.js';
import * as usageBarrel from '../../host-trade-usage/index.js';
import { HOST_TRADE_DOMAIN_MANAGED_FIELDS } from '../host-trade-managed-fields.js';
import * as hostTradeBarrel from '../index.js';

/**
 * @file host-trade-managed-fields.guard.test.ts
 * @description T-017 — the HOS-376 domain's static "not user-settable" guard.
 *
 * Written in the mould of `HOST_TRADE_OWNER_FORBIDDEN_FIELDS`: the fields a
 * client may never set are named in one exported list, and this file asserts
 * no write schema declares any of them.
 *
 * The sweep is DERIVED rather than hand-listed, because a guard that checks a
 * fixed set of schemas is blind to the eighteenth one somebody adds next month.
 * It walks the four barrels of the domain and picks up everything whose export
 * name reads as a write shape.
 */

/** A Zod object exposing a `.shape`, which is all this guard needs. */
type ShapedSchema = { readonly shape: Record<string, z.ZodTypeAny> };

/** Export names that read as a create/update shape. */
const WRITE_SCHEMA_NAME_RE = /(?:Create|Update).*Schema$|^(?:Create|Update)[A-Za-z]*Schema$/;

function isShaped(value: unknown): value is ShapedSchema {
    return (
        typeof value === 'object' &&
        value !== null &&
        'shape' in value &&
        typeof (value as ShapedSchema).shape === 'object'
    );
}

/** Every write schema the domain exports, keyed by its export name. */
function collectWriteSchemas(): Map<string, ShapedSchema> {
    const found = new Map<string, ShapedSchema>();
    const barrels: Record<string, unknown>[] = [
        hostTradeBarrel,
        usageBarrel,
        reviewBarrel,
        replyBarrel
    ];

    for (const barrel of barrels) {
        for (const [name, exported] of Object.entries(barrel)) {
            if (WRITE_SCHEMA_NAME_RE.test(name) && isShaped(exported)) {
                found.set(name, exported);
            }
        }
    }

    return found;
}

/**
 * Every shape a request body is parsed with — the client-reachable surface.
 *
 * These must declare ZERO managed fields. The admin shapes are in here too:
 * an admin has no more business typing a denormalised counter than a provider
 * does, because both would be overwritten by the next recalculation anyway.
 */
const HTTP_WRITE_SCHEMAS = [
    'CreateHostTradeSchema',
    'HostTradeBenefitUsageHostCreateBodySchema',
    'HostTradeBenefitUsageProviderCreateBodySchema',
    'HostTradeCreateHttpSchema',
    'HostTradeOwnerUpdateSchema',
    'HostTradeReviewCreateBodySchema',
    'HostTradeReviewReplyCreateBodySchema',
    'HostTradeReviewReplyUpdateBodySchema',
    'HostTradeReviewUpdateBodySchema',
    'HostTradeUpdateHttpSchema',
    'UpdateHostTradeSchema'
] as const;

/**
 * Shapes only the SERVICE fills in, never parsed from a request.
 *
 * A managed field is legitimate here — the service is what stamps it — but
 * never implicit. Each one is named in {@link SERVICE_WRITABLE_MANAGED_FIELDS}
 * with the transition that earns it, and the assertion below is an EQUALITY:
 * an unlisted field appearing is red, and a listed one disappearing is red too,
 * so the exceptions shrink as the code does instead of outliving it.
 */
const SERVICE_INPUT_SCHEMAS = [
    'HostTradeBenefitUsageCreateInputSchema',
    'HostTradeBenefitUsageUpdateInputSchema',
    'HostTradeReviewCreateInputSchema',
    'HostTradeReviewReplyCreateInputSchema',
    'HostTradeReviewReplyUpdateInputSchema',
    'HostTradeReviewUpdateInputSchema'
] as const;

/** The only managed fields a service-layer shape may declare, and why. */
const SERVICE_WRITABLE_MANAGED_FIELDS: Record<string, readonly string[]> = {
    /**
     * The host's edit derives a new `averageRating` from the breakdown and
     * stamps `editedAt`, which is what marks any existing reply as answering an
     * older text (AC-22). Both are computed from the submitted body, never read
     * out of it — `HostTradeReviewUpdateBodySchema` declares neither.
     */
    HostTradeReviewUpdateInputSchema: ['averageRating', 'editedAt']
};

/**
 * The write schemas the sweep must find, pinned so the guard cannot pass
 * vacuously. If the matcher stops matching, a barrel stops re-exporting, or a
 * schema is renamed, this goes red instead of the sweep silently checking
 * nothing — the failure mode where a guard keeps reporting green over an empty
 * inventory.
 *
 * A NEW write schema landing here is also a deliberate red: adding one is
 * exactly the moment somebody should be made to classify it.
 */
const EXPECTED_WRITE_SCHEMAS = [...HTTP_WRITE_SCHEMAS, ...SERVICE_INPUT_SCHEMAS].sort();

describe('HOS-376 managed fields — the write surface never declares them', () => {
    const writeSchemas = collectWriteSchemas();

    function leakedFields(schemaName: string): string[] {
        const schema = writeSchemas.get(schemaName);
        expect(schema, `${schemaName} was not swept`).toBeDefined();

        return Object.keys((schema as ShapedSchema).shape).filter((field) =>
            (HOST_TRADE_DOMAIN_MANAGED_FIELDS as readonly string[]).includes(field)
        );
    }

    it('sweeps exactly the write schemas the domain exports', () => {
        expect([...writeSchemas.keys()].sort()).toEqual(EXPECTED_WRITE_SCHEMAS);
    });

    it.each([...HTTP_WRITE_SCHEMAS])('%s declares no managed field', (schemaName) => {
        expect(leakedFields(schemaName)).toEqual([]);
    });

    it.each([
        ...SERVICE_INPUT_SCHEMAS
    ])('%s declares only the managed fields it is allowed to stamp', (schemaName) => {
        const allowed = [...(SERVICE_WRITABLE_MANAGED_FIELDS[schemaName] ?? [])].sort();
        expect(leakedFields(schemaName).sort()).toEqual(allowed);
    });
});

describe('HOST_TRADE_DOMAIN_MANAGED_FIELDS', () => {
    /**
     * A misspelt entry protects nothing while looking like it does, so every
     * field belonging to one of the three new tables must actually exist on
     * that table's entity schema.
     *
     * The `host_trades` aggregate and suspension columns are deliberately NOT
     * checked here: they exist in the database (T-009) but have not been added
     * to `HostTradeSchema` yet, which is precisely why the list must already
     * name them — see the const's own documentation.
     */
    it.each([
        ['status', HostTradeBenefitUsageSchema],
        ['expiresAt', HostTradeBenefitUsageSchema],
        ['reminderSentAt', HostTradeBenefitUsageSchema],
        ['confirmedAt', HostTradeBenefitUsageSchema],
        ['confirmedById', HostTradeBenefitUsageSchema],
        ['rejectedAt', HostTradeBenefitUsageSchema],
        ['rejectedById', HostTradeBenefitUsageSchema],
        ['moderationState', HostTradeReviewSchema],
        ['moderatedById', HostTradeReviewSchema],
        ['moderatedAt', HostTradeReviewSchema],
        ['moderationReason', HostTradeReviewSchema],
        ['editedAt', HostTradeReviewSchema],
        ['reviewEditedAfterReply', HostTradeReviewReplySchema]
    ])('names %s, a real column on its entity', (field, entity) => {
        expect(HOST_TRADE_DOMAIN_MANAGED_FIELDS as readonly string[]).toContain(field);
        expect(Object.keys(entity.shape)).toContain(field);
    });

    /**
     * The five denormalised aggregates and the three suspension columns
     * (HOS-376 §7.2). `CreateHostTradeSchema` is built by OMITTING audit fields
     * from `HostTradeSchema`, not by allowlisting, so the day these land on the
     * Zod entity they flow straight into the admin create body unless somebody
     * omits them. Naming them now is what turns that into a red test.
     */
    it.each([
        'confirmedUsesCount',
        'distinctHostsCount',
        'reviewsCount',
        'averageRating',
        'benefitRespectedCount',
        'declarationSuspendedAt',
        'declarationSuspendedById',
        'declarationSuspendReason'
    ])('names the host_trades column %s ahead of its Zod entity', (field) => {
        expect(HOST_TRADE_DOMAIN_MANAGED_FIELDS as readonly string[]).toContain(field);
    });
});
