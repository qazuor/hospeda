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
    AuthorizationSearchInput,
    AuthorizeInput,
    ChangeAmountInput,
    ChargeInput,
    ChargeRef,
    ChargeSearchInput,
    Money,
    NoticeDelivery,
    OneTimeChargeInput,
    OneTimePaymentInput,
    OrderRef,
    OrderRefundInput,
    OrderSearchInput,
    PaymentPageRef,
    RefundInput
} from './payment-provider';

const NonEmptyId = z.string().trim().min(1);

/** Narrow search criteria for capability 7. */
export const AuthorizationSearchInputSchema: z.ZodType<AuthorizationSearchInput> = z.strictObject({
    reference: NonEmptyId.optional(),
    payerEmail: z.email().optional(),
    status: z.enum(['pending', 'active', 'paused', 'cancelled']).optional()
});

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
    payerEmail: z.email().optional(),
    firstChargeAt: z.iso.datetime({ offset: true }).optional(),
    paymentToken: NonEmptyId.optional()
});

/** Input of capability 2. */
export const ChargeInputSchema: z.ZodType<ChargeInput> = z.strictObject({
    authorizationId: NonEmptyId,
    amount: PositiveMoneySchema,
    reference: NonEmptyId
});

/** Validates a one-time order before any provider call (AC:B6:12, MP:EX-41/EX-30). */
export const OneTimeChargeInputSchema: z.ZodType<OneTimeChargeInput> = z.strictObject({
    reference: NonEmptyId,
    idempotencyKey: NonEmptyId,
    amount: PositiveMoneySchema,
    payerEmail: z.email(),
    paymentToken: NonEmptyId,
    paymentBrand: NonEmptyId,
    paymentKind: z.enum(['credit', 'debit'])
});

/** The only hosts a plain-http return URL may name, and only outside production (HOS-2179). */
const LOCAL_RETURN_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1']);

/**
 * Whether a return URL is acceptable: https always; plain http only when the caller allows
 * local development, the host is exactly `localhost` or `127.0.0.1`, and it carries no
 * credentials. An unparseable string is refused here too: zod 4 runs a refinement even after
 * `z.url()` failed, so this must not throw.
 */
function isAcceptableReturnUrl(input: { readonly url: string; readonly allowLocalHttp: boolean }) {
    if (!URL.canParse(input.url)) return false;
    const parsed = new URL(input.url);
    if (parsed.protocol === 'https:') return true;
    return (
        input.allowLocalHttp &&
        parsed.protocol === 'http:' &&
        parsed.username === '' &&
        parsed.password === '' &&
        LOCAL_RETURN_HOSTS.has(parsed.hostname)
    );
}

/**
 * Builds the one-time payment page request schema (HOS-2179 §6.2: no field for card data).
 * The customer comes back to `returnUrl` from the provider's page: https only, except that
 * outside production `http://localhost` and `http://127.0.0.1` are accepted for local
 * development (owner decision). The flag comes from the provider's own configuration.
 *
 * @param input.allowLocalHttpReturnUrl - True only outside production
 * @returns The request schema
 */
export function oneTimePaymentInputSchemaFor(input: {
    readonly allowLocalHttpReturnUrl: boolean;
}): z.ZodType<OneTimePaymentInput> {
    return z.strictObject({
        reference: NonEmptyId,
        idempotencyKey: NonEmptyId,
        amount: PositiveMoneySchema,
        reason: z.string().trim().min(1),
        returnUrl: z
            .url()
            .refine(
                (url) =>
                    isAcceptableReturnUrl({ url, allowLocalHttp: input.allowLocalHttpReturnUrl }),
                {
                    message: input.allowLocalHttpReturnUrl
                        ? 'returnUrl must be https, or http on localhost or 127.0.0.1'
                        : 'returnUrl must be https'
                }
            ),
        expiresAt: z.iso.datetime({ offset: true })
    });
}

/** Validates a one-time payment page request with the production rule: https only. */
export const OneTimePaymentInputSchema: z.ZodType<OneTimePaymentInput> =
    oneTimePaymentInputSchemaFor({ allowLocalHttpReturnUrl: false });

/** Identifies one payment page (capabilities 5 and 7). */
export const PaymentPageRefSchema: z.ZodType<PaymentPageRef> = z.strictObject({
    paymentPageId: NonEmptyId
});

/** Charge search criteria (capability 7): an ordered, inclusive creation range. */
export const ChargeSearchInputSchema: z.ZodType<ChargeSearchInput> = z
    .strictObject({
        reference: NonEmptyId,
        createdFrom: z.iso.datetime({ offset: true }),
        createdTo: z.iso.datetime({ offset: true })
    })
    .refine((input) => Date.parse(input.createdFrom) <= Date.parse(input.createdTo), {
        message: 'the search range ends before it starts',
        path: ['createdTo']
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

/** Identifies one one-time order (capability 7). */
export const OrderRefSchema: z.ZodType<OrderRef> = z.strictObject({
    orderId: NonEmptyId
});

/** Order search criteria (capability 7, EX-57): both creation dates are required. */
export const OrderSearchInputSchema: z.ZodType<OrderSearchInput> = z.strictObject({
    reference: NonEmptyId,
    createdFrom: z.iso.datetime({ offset: true }),
    createdTo: z.iso.datetime({ offset: true })
});

/** Input of capability 6. */
export const RefundInputSchema: z.ZodType<RefundInput> = z.strictObject({
    chargeId: NonEmptyId,
    amount: PositiveMoneySchema,
    reference: NonEmptyId
});

/** Capability 6 order refund input (MP:EX-58, AC:B6:8, TRANS:B:RF2). */
export const OrderRefundInputSchema: z.ZodType<OrderRefundInput> = z.strictObject({
    orderId: NonEmptyId,
    reference: NonEmptyId,
    scope: z.discriminatedUnion('kind', [
        z.strictObject({ kind: z.literal('total') }),
        z.strictObject({
            kind: z.literal('partial'),
            transactionId: NonEmptyId,
            amount: PositiveMoneySchema
        })
    ])
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
