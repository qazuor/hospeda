import { eq, getDb, users } from '@repo/db';
import { PermissionEnum, RememberedPayerEmailResponseSchema } from '@repo/schemas';
import { getActorFromContext } from '../../utils/actor';
import { createProtectedRoute } from '../../utils/route-factory';

/**
 * Read the payer email remembered for the authenticated account (HOS-2616). It is the email
 * declared on the last approved charge, only used to prefill checkouts, never a confirmed one.
 */
export const protectedReadRememberedPayerEmailRoute = createProtectedRoute({
    method: 'get',
    path: '/payer-email',
    summary: 'Read the remembered payer email',
    description:
        'Returns the email declared on the last approved charge of the authenticated account, or null.',
    tags: ['Billing subscriptions'],
    requiredPermissions: [PermissionEnum.BILLING_VIEW_OWN],
    emailUnverifiedOperation: 'READ_OWN',
    responseSchema: RememberedPayerEmailResponseSchema,
    handler: async (ctx) => {
        const userId = getActorFromContext(ctx).id;
        const [row] = await getDb()
            .select({ rememberedPayerEmail: users.lastSuccessfulPayerEmail })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
        return { rememberedPayerEmail: row?.rememberedPayerEmail ?? null };
    }
});
