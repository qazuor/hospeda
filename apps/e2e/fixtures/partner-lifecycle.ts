import { randomUUID } from 'node:crypto';
import { execSQL } from './db-helpers.ts';
import { type CatalogSlug, monthlyOptionForSlug } from './signup-checkout.ts';

interface PartnerBillingSetupArgs {
    readonly apiUrl: string;
    readonly adminCookie: string;
    readonly partnerId: string;
    readonly plan: 'partner-gold' | 'partner-silver';
}

interface JsonResponse<T> {
    readonly success?: boolean;
    readonly data?: T;
    readonly error?: { readonly message?: string };
}

/** Configures Partner billing with ACC:6 and registers its first installment (AC:V7:19, TEST:V7:22). */
export async function activatePartnerPlan(args: PartnerBillingSetupArgs): Promise<string> {
    const optionId = await monthlyOptionForSlug(args.plan satisfies CatalogSlug);
    const headers = { cookie: args.adminCookie, 'content-type': 'application/json' };
    const previewResponse = await fetch(
        `${args.apiUrl}/api/v1/admin/partners/${args.partnerId}/billing-setup`,
        { headers }
    );
    const preview = (await previewResponse.json()) as JsonResponse<{
        readonly options: readonly {
            readonly billingOptionId: string;
            readonly planSlug: string;
        }[];
    }>;
    if (!previewResponse.ok)
        throw new Error(`Action 6 preview failed (${previewResponse.status}).`);
    const option = preview.data?.options.find(
        (entry) => entry.planSlug === args.plan && entry.billingOptionId === optionId
    );
    if (!option) throw new Error(`Action 6 did not offer ${args.plan}.`);

    const setupResponse = await fetch(
        `${args.apiUrl}/api/v1/admin/partners/${args.partnerId}/billing-setup`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({
                billingOptionId: option.billingOptionId,
                reason: `Partner lifecycle ${randomUUID()}`,
                confirm: true
            })
        }
    );
    const setup = (await setupResponse.json()) as JsonResponse<{
        readonly subscriptionId: string;
        readonly manualPaymentId: string;
    }>;
    if (!setupResponse.ok || !setup.data)
        throw new Error(`Action 6 configuration failed (${setupResponse.status}).`);

    const registerResponse = await fetch(
        `${args.apiUrl}/api/v1/admin/billing-subscription/${setup.data.subscriptionId}/manual-payments/${setup.data.manualPaymentId}/register`,
        {
            method: 'POST',
            headers,
            body: JSON.stringify({ proofRef: `v7-${randomUUID()}` })
        }
    );
    if (!registerResponse.ok)
        throw new Error(`MP1 registration failed (${registerResponse.status}).`);
    const rows = await execSQL<{ status: string }>(
        'SELECT status FROM subscription WHERE id = $1',
        [setup.data.subscriptionId]
    );
    if (rows[0]?.status !== 'ACTIVE') throw new Error('MP1 did not activate the subscription.');
    return setup.data.subscriptionId;
}

/** Assigns a unique public slug after PP2 approval (AC:V7:19, TEST:V7:22). */
export async function assignPartnerSlug(partnerId: string): Promise<string> {
    const slug = `v7-${randomUUID()}`;
    await execSQL('UPDATE partners SET slug = $2 WHERE id = $1', [partnerId, slug]);
    return slug;
}
