/**
 * The validation gate (contract §7.1, item 2): every argument, response and
 * event crosses the boundary through its schema, and one that does not
 * validate is NOT delivered. It is contract §6.1 ("el default es negar") on
 * the side of the shape: the caller gets a `ContractValidationError`, never a
 * malformed answer it could read as permissive.
 */
import type { z } from 'zod';
import { CoverageArgsSchema, CoverageResponseSchema } from './coverage.schema';
import {
    CanChargeArgsSchema,
    CanChargeResponseSchema,
    CoverageChangedEventSchema,
    RetentionStoppedArgsSchema,
    RetentionStoppedResponseSchema
} from './forward.schema';
import type { BillingForVerticals, ContractListener, VerticalsForBilling } from './interfaces';
import {
    AddonPolicyArgsSchema,
    AddonPolicyResponseSchema,
    ChangeDirectionArgsSchema,
    ChangeDirectionResponseSchema,
    ExtendTrialArgsSchema,
    ExtendTrialResponseSchema,
    ListingArgsSchema,
    ListingPurgedEventSchema,
    ListingPurgedResponseSchema,
    ListingResponseSchema,
    PlanPolicyArgsSchema,
    PlanPolicyResponseSchema
} from './inverse.schema';

/** What failed to validate. */
export type ContractValueKind = 'argument' | 'response' | 'event';

/** One validation issue, reduced to what a reader needs. */
export interface ContractValidationIssue {
    readonly path: readonly PropertyKey[];
    readonly message: string;
}

/**
 * A value that crossed the boundary without matching its schema. Thrown
 * instead of delivering it.
 */
export class ContractValidationError extends Error {
    /** The entry, e.g. `coverage` or `onListingPurged`. */
    readonly operation: string;
    /** Whether the argument, the response or the event failed. */
    readonly kind: ContractValueKind;
    /** What failed. */
    readonly issues: readonly ContractValidationIssue[];

    constructor(args: {
        readonly operation: string;
        readonly kind: ContractValueKind;
        readonly issues: readonly ContractValidationIssue[];
    }) {
        super(
            `billing-verticals contract: the ${args.kind} of ${args.operation} does not validate: ` +
                args.issues
                    .map(
                        (issue) =>
                            `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`
                    )
                    .join('; ')
        );
        this.name = 'ContractValidationError';
        this.operation = args.operation;
        this.kind = args.kind;
        this.issues = args.issues;
    }
}

/**
 * Parses a value with its schema, or throws.
 *
 * @throws ContractValidationError when the value does not validate
 */
function parseOrThrow<TSchema extends z.ZodType>(args: {
    readonly schema: TSchema;
    readonly value: unknown;
    readonly operation: string;
    readonly kind: ContractValueKind;
}): z.infer<TSchema> {
    const result = args.schema.safeParse(args.value);
    if (result.success) return result.data;
    throw new ContractValidationError({
        operation: args.operation,
        kind: args.kind,
        issues: result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))
    });
}

/** Validates the argument, calls the implementation, validates the response. */
async function gated<TArgs extends z.ZodType, TResponse extends z.ZodType>(args: {
    readonly operation: string;
    readonly argsSchema: TArgs;
    readonly responseSchema: TResponse;
    readonly value: unknown;
    readonly call: (parsed: z.infer<TArgs>) => Promise<unknown>;
}): Promise<z.infer<TResponse>> {
    const parsed = parseOrThrow({
        schema: args.argsSchema,
        value: args.value,
        operation: args.operation,
        kind: 'argument'
    });
    const response = await args.call(parsed);
    return parseOrThrow({
        schema: args.responseSchema,
        value: response,
        operation: args.operation,
        kind: 'response'
    });
}

/**
 * Wraps a listener so it only ever receives an event that validates.
 *
 * An invalid event never reaches the listener: the wrapper throws
 * `ContractValidationError` back to the EMITTER (synchronously, from the call
 * the emitter makes), so the side that produced the malformed event is the one
 * that sees the failure.
 */
function gatedListener<TSchema extends z.ZodType>(args: {
    readonly operation: string;
    readonly schema: TSchema;
    readonly listener: ContractListener<z.infer<TSchema>>;
}): ContractListener<unknown> {
    return (event) =>
        args.listener(
            parseOrThrow({
                schema: args.schema,
                value: event,
                operation: args.operation,
                kind: 'event'
            })
        );
}

/**
 * Puts the validation gate in front of a forward implementation.
 *
 * @param args.implementation - What billing (or the bootstrap) implements
 * @returns `{ validated }`: the same interface, where nothing invalid crosses
 */
export function validateBillingForVerticals(args: {
    readonly implementation: BillingForVerticals;
}): { readonly validated: BillingForVerticals } {
    const impl = args.implementation;
    const validated: BillingForVerticals = {
        coverage: (value) =>
            gated({
                operation: 'coverage',
                argsSchema: CoverageArgsSchema,
                responseSchema: CoverageResponseSchema,
                value,
                call: (parsed) => impl.coverage(parsed)
            }),
        retentionStopped: (value) =>
            gated({
                operation: 'retentionStopped',
                argsSchema: RetentionStoppedArgsSchema,
                responseSchema: RetentionStoppedResponseSchema,
                value,
                call: (parsed) => impl.retentionStopped(parsed)
            }),
        canCharge: (value) =>
            gated({
                operation: 'canCharge',
                argsSchema: CanChargeArgsSchema,
                responseSchema: CanChargeResponseSchema,
                value,
                call: (parsed) => impl.canCharge(parsed)
            }),
        onCoverageChanged: (listener) =>
            impl.onCoverageChanged(
                gatedListener({
                    operation: 'onCoverageChanged',
                    schema: CoverageChangedEventSchema,
                    listener
                })
            )
    };
    return { validated };
}

/**
 * Puts the validation gate in front of an inverse implementation.
 *
 * @param args.implementation - What verticals implements
 * @returns `{ validated }`: the same interface, where nothing invalid crosses
 */
export function validateVerticalsForBilling(args: {
    readonly implementation: VerticalsForBilling;
}): { readonly validated: VerticalsForBilling } {
    const impl = args.implementation;
    const validated: VerticalsForBilling = {
        planPolicy: (value) =>
            gated({
                operation: 'planPolicy',
                argsSchema: PlanPolicyArgsSchema,
                responseSchema: PlanPolicyResponseSchema,
                value,
                call: (parsed) => impl.planPolicy(parsed)
            }),
        changeDirection: (value) =>
            gated({
                operation: 'changeDirection',
                argsSchema: ChangeDirectionArgsSchema,
                responseSchema: ChangeDirectionResponseSchema,
                value,
                call: (parsed) => impl.changeDirection(parsed)
            }),
        listingPurged: (value) =>
            gated({
                operation: 'listingPurged',
                argsSchema: ListingArgsSchema,
                responseSchema: ListingPurgedResponseSchema,
                value,
                call: (parsed) => impl.listingPurged(parsed)
            }),
        listing: (value) =>
            gated({
                operation: 'listing',
                argsSchema: ListingArgsSchema,
                responseSchema: ListingResponseSchema,
                value,
                call: (parsed) => impl.listing(parsed)
            }),
        addonPolicy: (value) =>
            gated({
                operation: 'addonPolicy',
                argsSchema: AddonPolicyArgsSchema,
                responseSchema: AddonPolicyResponseSchema,
                value,
                call: (parsed) => impl.addonPolicy(parsed)
            }),
        extendTrial: (value) =>
            gated({
                operation: 'extendTrial',
                argsSchema: ExtendTrialArgsSchema,
                responseSchema: ExtendTrialResponseSchema,
                value,
                call: (parsed) => impl.extendTrial(parsed)
            }),
        onListingPurged: (listener) =>
            impl.onListingPurged(
                gatedListener({
                    operation: 'onListingPurged',
                    schema: ListingPurgedEventSchema,
                    listener
                })
            )
    };
    return { validated };
}
