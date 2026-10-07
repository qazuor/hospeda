/**
 * Runtime validation of every input the payment provider interface receives.
 * Each adapter parses its input with these before doing anything else, so a
 * malformed request is refused the same way by every provider.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { z } from 'zod';
import type { PaymentCapability } from './capabilities';
import { PaymentProviderError } from './errors';
import type {
    AuthorizationRef,
    AuthorizeInput,
    ChangeAmountInput,
    ChargeInput,
    ChargeRef,
    Money,
    NoticeDelivery,
    RefundInput
} from './payment-provider';

const NonEmptyId = z.string().trim().min(1);

/** Money in integer minor units and an ISO 4217 code. Floats are refused. */
export const MoneySchema: z.ZodType<Money> = z.strictObject({
    amountMinor: z.number().int().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/)
});

/** Money strictly greater than zero. */
const PositiveMoneySchema = MoneySchema.refine((money) => money.amountMinor > 0, {
    message: 'amountMinor must be greater than zero'
});

/** Input of capability 1. */
export const AuthorizeInputSchema: z.ZodType<AuthorizeInput> = z.strictObject({
    reference: NonEmptyId,
    amount: PositiveMoneySchema,
    cadence: z.strictObject({ everyMonths: z.number().int().min(1).max(12) }),
    reason: z.string().trim().min(1),
    returnUrl: z.url(),
    payerEmail: z.email().optional()
});

/** Input of capability 2. */
export const ChargeInputSchema: z.ZodType<ChargeInput> = z.strictObject({
    authorizationId: NonEmptyId,
    amount: PositiveMoneySchema,
    reference: NonEmptyId
});

/** Input of capability 3. */
export const ChangeAmountInputSchema: z.ZodType<ChangeAmountInput> = z.strictObject({
    authorizationId: NonEmptyId,
    amount: PositiveMoneySchema
});

/** Identifies one authorization (capabilities 4, 5 and 7). */
export const AuthorizationRefSchema: z.ZodType<AuthorizationRef> = z.strictObject({
    authorizationId: NonEmptyId
});

/** Identifies one charge (capability 7). */
export const ChargeRefSchema: z.ZodType<ChargeRef> = z.strictObject({
    chargeId: NonEmptyId
});

/** Input of capability 6. */
export const RefundInputSchema: z.ZodType<RefundInput> = z.strictObject({
    chargeId: NonEmptyId,
    amount: PositiveMoneySchema,
    reference: NonEmptyId
});

/** Input of capability 8. */
export const NoticeDeliverySchema: z.ZodType<NoticeDelivery> = z.strictObject({
    headers: z.record(z.string(), z.string()),
    body: z.string()
});

/** Constructor options of every implementation: the injected clock. */
export const PaymentProviderOptionsSchema: z.ZodType<{ readonly clock: Clock }> = z.strictObject({
    clock: z.custom<Clock>(
        (value) =>
            typeof value === 'object' &&
            value !== null &&
            typeof (value as { now?: unknown }).now === 'function',
        { message: 'clock must be an object with now(): Date' }
    )
});

/**
 * Parses one interface input, refusing it with a typed error.
 *
 * @param args.schema - The schema of that input
 * @param args.input - What the caller passed
 * @param args.capability - The capability asked for, named in the error
 * @returns The parsed input
 * @throws PaymentProviderError with code `INVALID_INPUT` when validation fails
 */
export function parseProviderInput<T>(args: {
    readonly schema: z.ZodType<T>;
    readonly input: unknown;
    readonly capability: PaymentCapability;
}): { readonly value: T } {
    const result = args.schema.safeParse(args.input);
    if (!result.success) {
        throw new PaymentProviderError({
            code: 'INVALID_INPUT',
            capability: args.capability,
            message: z.prettifyError(result.error),
            cause: result.error
        });
    }
    return { value: result.data };
}
