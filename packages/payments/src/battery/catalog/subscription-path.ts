/**
 * The measurements over the subscription path production uses (HOS-1512, owner decision
 * 2026-11-18): a preapproval created WITHOUT a card token, which stays pending until a person
 * authorizes it on the provider's page, read back by id and cancelled in the same run. None of
 * them moves money: no card token is ever sent, so nothing they create can charge.
 *
 * Every request is built by the adapter's own `authorize`, `readAuthorization` and `cancel`
 * (through {@link createWatchAdapterBridge}), so a drift in our adapter is caught too. The amounts
 * come from the fake's rule constants (RP3, PC-2), never from a literal.
 *
 * @module battery/catalog/subscription-path
 */
import {
    AMOUNT_ABOVE_CEILING_MESSAGE,
    AMOUNT_BELOW_FLOOR_MESSAGE,
    CURRENCY_REFUSED_MESSAGE,
    FAKE_AMOUNT_CEILING_MINOR,
    FAKE_AMOUNT_FLOOR_MINOR,
    FAKE_CURRENCY
} from '../../fake/fake-rules';
import { sanitizeApprovalUrl } from '../../provider/approval-url';
import type { AuthorizeInput } from '../../provider/payment-provider';
import type { JsonValue, WatchAccount, WatchContext, WatchEntry } from '../types';
import {
    type BridgeCall,
    createWatchAdapterBridge,
    type WatchAdapterBridge
} from './watch-adapter-bridge';
import { requireCreationSettings, WATCH_REASON, watchReference } from './watch-subjects';

/** One peso, in centavos: the step just outside each bound of RP3. */
const CENTAVOS_PER_PESO = 100;

/** The two currencies EX-18 measured as refused. */
const REFUSED_CURRENCIES = ['USD', 'BRL'] as const;

/** Days ahead of the first charge in the RP17 measurement. */
const FIRST_CHARGE_DAYS_AHEAD = 7;

/** A non-zero millisecond, so truncation to the second is observable (EX-60 sent `.318`). */
const FIRST_CHARGE_MILLISECOND = 318;

function describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/** The input the adapter's `authorize` gets, as `start-subscription` builds it, without a token. */
function pendingInput(args: {
    readonly ctx: WatchContext;
    readonly use: string;
    readonly amountMinor?: number;
    readonly currency?: string;
    readonly firstChargeAt?: string;
}): AuthorizeInput {
    const { payerEmail, returnUrl } = requireCreationSettings(args.ctx);
    return {
        reference: watchReference({ ctx: args.ctx, use: args.use }),
        amount: {
            amountMinor: args.amountMinor ?? FAKE_AMOUNT_FLOOR_MINOR,
            currency: args.currency ?? FAKE_CURRENCY
        },
        cadence: { everyMonths: 1 },
        reason: WATCH_REASON,
        returnUrl,
        payerEmail,
        ...(args.firstChargeAt === undefined ? {} : { firstChargeAt: args.firstChargeAt })
    };
}

/**
 * Creates one pending authorization and ALWAYS cancels it before returning, whatever `inspect`
 * did: the run never leaves a live authorization behind.
 *
 * @returns What `inspect` returned
 * @throws {Error} When the adapter cannot create it or cannot cancel it
 */
async function withPendingAuthorization<T>(args: {
    readonly bridge: WatchAdapterBridge;
    readonly input: AuthorizeInput;
    readonly label: string;
    readonly inspect: (created: {
        readonly id: string;
        readonly approvalUrl: string;
    }) => Promise<T>;
}): Promise<T> {
    const { bridge, label } = args;
    const created = await bridge.call(`${label}-create`, (provider) =>
        provider.authorize(args.input)
    );
    if (created.value === undefined) {
        throw new Error(
            `the adapter could not create the pending authorization: ${describe(created.error)}`
        );
    }
    const id = created.value.authorizationId;
    try {
        return await args.inspect({ id, approvalUrl: created.value.approvalUrl });
    } finally {
        await cancelOrThrow({ bridge, id, label: `${label}-cancel` });
    }
}

async function cancelOrThrow(args: {
    readonly bridge: WatchAdapterBridge;
    readonly id: string;
    readonly label: string;
}): Promise<void> {
    const cancelled = await args.bridge.call(args.label, (provider) =>
        provider.cancel({ authorizationId: args.id })
    );
    if (cancelled.error !== undefined) {
        throw new Error(
            `the authorization ${args.id} could not be cancelled: ${describe(cancelled.error)}`
        );
    }
}

function approvalUrlUsable(approvalUrl: string): boolean {
    try {
        sanitizeApprovalUrl({ approvalUrl });
        return true;
    } catch {
        return false;
    }
}

function carriesActivation(approvalUrl: string): boolean {
    try {
        return new URL(approvalUrl).searchParams.get('activation') === 'true';
    } catch {
        return false;
    }
}

/** What the lifecycle measurement reads, per account. */
function lifecycleExpected(account: WatchAccount): JsonValue {
    return {
        referenceEchoed: true,
        amountEchoed: true,
        cadenceEchoed: true,
        currencyEchoed: true,
        pendingAfterCreate: true,
        // M9: the provider adds a free period on its own only when the first charge is in the
        // future; the adapter sends no `start_date` here, so none may appear.
        freePeriodAdded: false,
        approvalUrlUsable: true,
        // M10 / EX-37, measured in production only: the link carries `activation=true`.
        ...(account === 'production' ? { approvalUrlCarriesActivation: true } : {}),
        cancelledOnReread: true
    };
}

function lifecycleEntry(account: WatchAccount): WatchEntry {
    return {
        id: account === 'production' ? 'lifecycle-prod' : 'lifecycle-sbx',
        rows: account === 'production' ? ['M9', 'M10'] : ['M9'],
        accounts: [account],
        effect: 'mutates',
        expected: lifecycleExpected(account),
        measure: async (ctx): Promise<JsonValue> => {
            const bridge = createWatchAdapterBridge({ ctx });
            const input = pendingInput({ ctx, use: 'lifecycle' });
            let createdId = '';
            const facts = await withPendingAuthorization({
                bridge,
                input,
                label: 'lifecycle',
                inspect: async ({ id, approvalUrl }) => {
                    createdId = id;
                    const read = await bridge.call('lifecycle-read', (provider) =>
                        provider.readAuthorization({ authorizationId: id })
                    );
                    if (read.value === undefined) {
                        throw new Error(
                            `the adapter could not read ${id}: ${describe(read.error)}`
                        );
                    }
                    const { snapshot } = read.value;
                    return {
                        referenceEchoed: snapshot.reference === input.reference,
                        amountEchoed: snapshot.amount.amountMinor === input.amount.amountMinor,
                        cadenceEchoed: snapshot.cadence.everyMonths === input.cadence.everyMonths,
                        currencyEchoed: snapshot.amount.currency === input.amount.currency,
                        pendingAfterCreate: snapshot.status === 'pending',
                        freePeriodAdded: snapshot.freePeriodDays !== null,
                        approvalUrlUsable: approvalUrlUsable(approvalUrl),
                        ...(account === 'production'
                            ? { approvalUrlCarriesActivation: carriesActivation(approvalUrl) }
                            : {})
                    };
                }
            });
            const reread = await bridge.call('lifecycle-reread', (provider) =>
                provider.readAuthorization({ authorizationId: createdId })
            );
            if (reread.value === undefined) {
                throw new Error(
                    `the adapter could not re-read ${createdId}: ${describe(reread.error)}`
                );
            }
            return { ...facts, cancelledOnReread: reread.value.snapshot.status === 'cancelled' };
        }
    };
}

/** M3 / EX-17 (sandbox): the same request twice creates two authorizations. */
const duplicateCreation: WatchEntry = {
    id: 'duplicate-create',
    rows: ['M3'],
    accounts: ['sandbox'],
    effect: 'mutates',
    expected: { secondCreateIsANewAuthorization: true },
    measure: async (ctx): Promise<JsonValue> => {
        const bridge = createWatchAdapterBridge({ ctx });
        const input = pendingInput({ ctx, use: 'duplicate' });
        return withPendingAuthorization({
            bridge,
            input,
            label: 'first',
            inspect: async ({ id }) =>
                withPendingAuthorization({
                    bridge,
                    input,
                    label: 'second',
                    inspect: async (second) => ({
                        secondCreateIsANewAuthorization: second.id !== id
                    })
                })
        });
    }
};

/** RP17 / EX-60 (sandbox): the stored first charge date is truncated to the whole second. */
const firstChargePrecision: WatchEntry = {
    id: 'first-charge-sec',
    rows: ['RP17'],
    accounts: ['sandbox'],
    effect: 'mutates',
    expected: { firstChargeTruncatedToSecond: true },
    measure: async (ctx): Promise<JsonValue> => {
        const bridge = createWatchAdapterBridge({ ctx });
        const at = new Date(ctx.now().getTime() + FIRST_CHARGE_DAYS_AHEAD * 86_400_000);
        at.setUTCMilliseconds(FIRST_CHARGE_MILLISECOND);
        const truncated = new Date(at.getTime());
        truncated.setUTCMilliseconds(0);
        const input = pendingInput({ ctx, use: 'first-charge', firstChargeAt: at.toISOString() });
        return withPendingAuthorization({
            bridge,
            input,
            label: 'first-charge',
            inspect: async ({ id }) => {
                const read = await bridge.call('first-charge-read', (provider) =>
                    provider.readAuthorization({ authorizationId: id })
                );
                if (read.value === undefined) {
                    throw new Error(`the adapter could not read ${id}: ${describe(read.error)}`);
                }
                return {
                    firstChargeTruncatedToSecond:
                        read.value.snapshot.firstChargeAt === truncated.toISOString()
                };
            }
        });
    }
};

/**
 * Sends a create the provider is expected to REFUSE and reads its message. If it is not refused
 * the authorization exists: it is cancelled at once and the measurement reads `created`.
 */
async function expectRefusal(args: {
    readonly bridge: WatchAdapterBridge;
    readonly input: AuthorizeInput;
    readonly label: string;
}): Promise<string> {
    const answer: BridgeCall<{ readonly authorizationId: string }> = await args.bridge.call(
        args.label,
        (provider) => provider.authorize(args.input)
    );
    if (answer.value !== undefined) {
        await cancelOrThrow({
            bridge: args.bridge,
            id: answer.value.authorizationId,
            label: `${args.label}-cancel`
        });
        return 'created';
    }
    const body = answer.responses[0]?.body;
    const message =
        typeof body === 'object' && body !== null && 'message' in body
            ? (body as { readonly message: unknown }).message
            : undefined;
    return typeof message === 'string' ? message : 'no message';
}

/** RP3 / PC-2 (sandbox and production): out-of-range amounts are refused with the exact message. */
const amountBounds: WatchEntry = {
    id: 'amount-bounds',
    rows: ['RP3'],
    accounts: ['sandbox', 'production'],
    effect: 'mutates',
    expected: {
        belowFloor: AMOUNT_BELOW_FLOOR_MESSAGE,
        aboveCeiling: AMOUNT_ABOVE_CEILING_MESSAGE
    },
    measure: async (ctx): Promise<JsonValue> => {
        const bridge = createWatchAdapterBridge({ ctx });
        return {
            belowFloor: await expectRefusal({
                bridge,
                label: 'below-floor',
                input: pendingInput({
                    ctx,
                    use: 'below-floor',
                    amountMinor: FAKE_AMOUNT_FLOOR_MINOR - CENTAVOS_PER_PESO
                })
            }),
            aboveCeiling: await expectRefusal({
                bridge,
                label: 'above-ceiling',
                input: pendingInput({
                    ctx,
                    use: 'above-ceiling',
                    amountMinor: FAKE_AMOUNT_CEILING_MINOR + CENTAVOS_PER_PESO
                })
            })
        };
    }
};

/**
 * RP4 / EX-18 (sandbox and production): another currency is refused. The amount is the floor: the
 * provider checks the amount BEFORE the currency (EX-18), so it must not be below the floor.
 */
const otherCurrency: WatchEntry = {
    id: 'other-currency',
    rows: ['RP4'],
    accounts: ['sandbox', 'production'],
    effect: 'mutates',
    expected: Object.fromEntries(
        REFUSED_CURRENCIES.map((code) => [code, CURRENCY_REFUSED_MESSAGE])
    ),
    measure: async (ctx): Promise<JsonValue> => {
        const bridge = createWatchAdapterBridge({ ctx });
        const read: Record<string, string> = {};
        for (const currency of REFUSED_CURRENCIES) {
            read[currency] = await expectRefusal({
                bridge,
                label: `currency-${currency.toLowerCase()}`,
                input: pendingInput({ ctx, use: `currency-${currency.toLowerCase()}`, currency })
            });
        }
        return read;
    }
};

/** The measurements over the no-token subscription path. */
export const SUBSCRIPTION_PATH_ENTRIES: readonly WatchEntry[] = [
    lifecycleEntry('sandbox'),
    lifecycleEntry('production'),
    duplicateCreation,
    firstChargePrecision,
    amountBounds,
    otherCurrency
];
