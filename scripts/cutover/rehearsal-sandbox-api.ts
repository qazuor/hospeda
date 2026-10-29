import { z } from 'zod';
import type { CreateProviderApiInput, ProviderRequest } from './provider-api.ts';
import { createProviderRequest, ProviderError } from './provider-api.ts';
import type { ObjectKind } from './types.ts';

/** Same shape rule as the cutover client: an id that does not match is never sent. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

const KIND_PATH: Readonly<Record<ObjectKind, string>> = {
    plan: '/preapproval_plan',
    preapproval: '/preapproval'
};

/** What a mirror is created with. The amount is the minimum the sandbox accepts for ARS. */
const MIRROR_AUTO_RECURRING = {
    frequency: 1,
    frequency_type: 'months',
    transaction_amount: 15,
    currency_id: 'ARS'
} as const;
const MIRROR_BACK_URL = 'https://hospeda.com.ar';

const createdSchema = z.object({ id: z.union([z.string(), z.number()]).transform(String) });

/** Whether an id exists in the account behind the token. */
export type LookupResult = 'found' | 'not-found';

/**
 * Sandbox calls of the rehearsal sandbox-id rewrite (HOS-1957, owner decision 1). Implemented by
 * {@link createRehearsalSandboxApi} and by test doubles.
 */
export interface RehearsalSandboxApi {
    /**
     * Reads an id BY ID. `found` on 200, `not-found` on 404 (the id is not in this account: a
     * production id read with the sandbox token). Anything else throws {@link ProviderError}.
     */
    readonly lookup: (input: {
        readonly kind: ObjectKind;
        readonly id: string;
    }) => Promise<LookupResult>;
    /** Creates one mirror preapproval plan. Returns the new id. */
    readonly createPlan: (input: { readonly idempotencyKey: string }) => Promise<string>;
    /**
     * Creates one mirror preapproval, `pending`, bound to NO plan: a plan-bound preapproval needs
     * a card token, and an `authorized` one needs a checkout. Returns the new id.
     */
    readonly createPreapproval: (input: {
        readonly payerEmail: string;
        readonly idempotencyKey: string;
    }) => Promise<string>;
}

function assertSafeId({ id }: { readonly id: string }): void {
    if (!SAFE_ID.test(id)) {
        throw new ProviderError({
            message: 'refusing to call the provider with a malformed id',
            httpStatus: 0
        });
    }
}

/**
 * Builds the sandbox calls over the same sender (and retry policy) as the cutover client.
 * Errors carry the path and status only: provider bodies (which echo the payer email) are dropped.
 *
 * @param input - token and optional injection points (base URL, fetch, sleep)
 * @returns the rehearsal sandbox calls
 */
export function createRehearsalSandboxApi(input: CreateProviderApiInput): RehearsalSandboxApi {
    const request: ProviderRequest = createProviderRequest(input);

    const create = async ({
        path,
        body,
        idempotencyKey
    }: {
        readonly path: string;
        readonly body: Readonly<Record<string, string | Readonly<Record<string, string | number>>>>;
        readonly idempotencyKey: string;
    }): Promise<string> => {
        const { httpStatus, json } = await request({ method: 'POST', path, body, idempotencyKey });
        const parsed = createdSchema.safeParse(json);
        if (httpStatus < 200 || httpStatus >= 300 || !parsed.success) {
            throw new ProviderError({ message: `unusable answer from POST ${path}`, httpStatus });
        }
        return parsed.data.id;
    };

    return {
        lookup: async ({ kind, id }) => {
            assertSafeId({ id });
            const path = `${KIND_PATH[kind]}/${id}`;
            const { httpStatus } = await request({ method: 'GET', path });
            if (httpStatus === 200) return 'found';
            if (httpStatus === 404) return 'not-found';
            throw new ProviderError({ message: `unusable answer from GET ${path}`, httpStatus });
        },
        createPlan: async ({ idempotencyKey }) =>
            create({
                path: KIND_PATH.plan,
                idempotencyKey,
                body: {
                    reason: 'Hospeda rehearsal mirror plan',
                    back_url: MIRROR_BACK_URL,
                    auto_recurring: MIRROR_AUTO_RECURRING
                }
            }),
        createPreapproval: async ({ payerEmail, idempotencyKey }) =>
            create({
                path: KIND_PATH.preapproval,
                idempotencyKey,
                body: {
                    reason: 'Hospeda rehearsal mirror preapproval',
                    payer_email: payerEmail,
                    back_url: MIRROR_BACK_URL,
                    status: 'pending',
                    auto_recurring: MIRROR_AUTO_RECURRING
                }
            })
    };
}
