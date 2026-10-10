import type { BillingForVerticals } from '@repo/billing-verticals-contract';
import { VerticalEnumSchema } from '@repo/schemas';
import { resolveAdministrativeActionStep } from './administrative-action-step';
import { type EffectiveSetPort, resolveEntitlementStep } from './entitlement-step';
import { resolveLimitStep } from './limit-step';
import {
    type ListingOperation,
    type ListingVertical,
    OPERATION_PASSES_STEP5,
    OPERATION_STEP6_KEY
} from './listing-operation';
import { type ListingAccessFacts, resolveResourceStep } from './resource-step';
import { resolveResourceVertical } from './resource-vertical';

/** The listing authorization decision and its subject when access is granted. */
export type ListingAccessResult =
    | {
          readonly allowed: true;
          readonly subjectId: string | null;
          readonly evaluatedSteps: readonly (3 | 4 | 5 | 6 | 7)[];
      }
    | {
          readonly allowed: false;
          readonly reason:
              | 'NOT_FOUND'
              | 'FORBIDDEN'
              | 'NO_COVERAGE'
              | 'NO_CAPABILITY'
              | 'LIMIT_REACHED'
              | 'UNAUTHENTICATED';
          readonly key?: string;
          readonly max?: number;
          readonly requested?: number;
      };

/**
 * Resolve the vertical precondition, then steps 3, 4, 5, 6 and 7 in order
 * (V5.md §1.2). Step 1 rejects a guest (`actorId` null or empty) on every
 * operation except READ_PUBLIC. Callers must pass null for a guest; the API's
 * guest actor has a UUID and must be identified with `isGuestActor(actor)`.
 * The vertical precondition runs first, so a mismatched declared vertical
 * returns NOT_FOUND even for a guest.
 */
export async function resolveListingAccess(args: {
    readonly actorId: string | null;
    readonly vertical: string;
    readonly declaredVertical?: string | null;
    readonly facts: ListingAccessFacts | null;
    readonly operation: ListingOperation;
    readonly adminAction?: { readonly permitted: boolean; readonly isSystemActor: boolean };
    readonly step6Key?: string;
    readonly limit?: { readonly key: string; readonly requested: number };
    readonly billing: Pick<BillingForVerticals, 'coverage'>;
    readonly effectiveSet: EffectiveSetPort;
}): Promise<ListingAccessResult> {
    const vertical = resolveResourceVertical({
        resourceVertical: args.vertical,
        declaredVertical: args.declaredVertical
    });
    if (!vertical.allowed) return vertical;
    // Step 1 — "quién es": guest fails except for READ_PUBLIC.
    if (!args.actorId && args.operation !== 'READ_PUBLIC')
        return { allowed: false, reason: 'UNAUTHENTICATED' };
    const evaluatedSteps: (3 | 4 | 5 | 6 | 7)[] = [];
    let subjectId = args.actorId;
    if (args.adminAction) {
        evaluatedSteps.push(3);
        if (args.actorId === null) return { allowed: false, reason: 'FORBIDDEN' };
        const action = resolveAdministrativeActionStep({
            action: 'ACC_15',
            actorId: args.actorId,
            subjectId: args.facts?.ownerId ?? null,
            permitted: args.adminAction.permitted,
            isSystemActor: args.adminAction.isSystemActor
        });
        if (!action.allowed) return action;
        if (args.operation !== 'EDIT') return { allowed: false, reason: 'FORBIDDEN' };
        subjectId = args.facts?.ownerId ?? null;
    }
    if (args.operation === 'CREATE') {
        if (args.facts !== null) throw new Error('CREATE must not have listing facts');
    } else {
        evaluatedSteps.push(4);
        const resource = resolveResourceStep({
            actorId: subjectId,
            facts: args.facts,
            operation: args.operation
        });
        if (!resource.allowed) return resource;
    }
    if (subjectId === null && args.operation !== 'READ_PUBLIC') {
        return { allowed: false, reason: 'NOT_FOUND' };
    }
    if (OPERATION_PASSES_STEP5[args.operation]) {
        evaluatedSteps.push(5);
        if (subjectId === null) return { allowed: false, reason: 'NOT_FOUND' };
        const coverage = await args.billing.coverage({
            userId: subjectId,
            vertical: VerticalEnumSchema.parse(args.vertical)
        });
        if (coverage.sources.length === 0) return { allowed: false, reason: 'NO_COVERAGE' };
    }
    const requirement = OPERATION_STEP6_KEY[args.operation];
    let keys: readonly string[] = [];
    if (requirement.kind === 'KEY') keys = [requirement.key];
    if (requirement.kind === 'CALLER_KEY') {
        if (!args.step6Key) throw new Error('READ_OWN_COMMERCIAL requires step6Key');
        keys = [args.step6Key];
    }
    if (requirement.kind === 'VERTICAL_KEY' || requirement.kind === 'ANY_OF_VERTICAL') {
        if (
            requirement.kind !== 'VERTICAL_KEY' ||
            !args.facts?.publicationStatus ||
            !requirement.exceptInStates.includes(args.facts.publicationStatus)
        ) {
            const key = requirement.keys[args.vertical as ListingVertical];
            if (!key) return { allowed: false, reason: 'NO_CAPABILITY' };
            keys = typeof key === 'string' ? [key] : key;
        }
    }
    if (keys.length > 0) {
        evaluatedSteps.push(6);
        if (subjectId === null) return { allowed: false, reason: 'NOT_FOUND' };
        const entitlement = await resolveEntitlementStep({
            userId: subjectId,
            vertical: VerticalEnumSchema.parse(args.vertical),
            keys,
            effectiveSet: args.effectiveSet
        });
        if (!entitlement.allowed) return entitlement;
    }
    if (args.limit) {
        evaluatedSteps.push(7);
        if (subjectId === null) return { allowed: false, reason: 'NOT_FOUND' };
        const limit = await resolveLimitStep({
            userId: subjectId,
            vertical: VerticalEnumSchema.parse(args.vertical),
            limit: args.limit,
            effectiveSet: args.effectiveSet
        });
        if (!limit.allowed) return limit;
    }
    return { allowed: true, subjectId, evaluatedSteps };
}
