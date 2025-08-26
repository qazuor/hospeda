import { z } from '@hono/zod-openapi';
import { UserService } from '@repo/service-core';
import { AuthProviderEnum } from '@repo/types';
import { Webhook } from 'svix';
import { createGuestActor } from '../../utils/actor';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';
import { userCache } from '../../utils/user-cache';

const userService = new UserService({ logger: apiLogger });

export const clerkWebhookRoute = createSimpleRoute({
    method: 'post',
    path: '/webhook',
    summary: 'Clerk webhook',
    description: 'Handles Clerk user events for synchronization',
    tags: ['Auth'],
    options: { skipAuth: true },
    responseSchema: z.object({ ok: z.boolean() }).openapi('ClerkWebhookResponse'),
    handler: async (c) => {
        const svixId = c.req.header('svix-id') ?? '';
        const svixTimestamp = c.req.header('svix-timestamp') ?? '';
        const svixSignature = c.req.header('svix-signature') ?? '';
        if (!env.HOSPEDA_CLERK_WEBHOOK_SECRET) {
            apiLogger.error('CLERK_WEBHOOK_SECRET not configured');
            return new Response(
                JSON.stringify({
                    success: false,
                    error: { code: 'CONFIG', message: 'Missing secret' }
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const payloadText = await c.req.text();
        const wh = new Webhook(env.HOSPEDA_CLERK_WEBHOOK_SECRET);
        let evt: { type: string; data: Record<string, unknown> };
        try {
            evt = wh.verify(payloadText, {
                'svix-id': svixId,
                'svix-timestamp': svixTimestamp,
                'svix-signature': svixSignature
            }) as unknown as { type: string; data: Record<string, unknown> };
        } catch (_unused) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Invalid signature' }
                }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }

        try {
            const type = evt.type;
            const data = evt.data as Record<string, unknown>;
            const clerkUserId = (data?.id as string | undefined) ?? undefined;
            if (!clerkUserId) {
                return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }

            // Map minimal profile
            const firstName =
                typeof data?.first_name === 'string' ? (data.first_name as string) : undefined;
            const lastName =
                typeof data?.last_name === 'string' ? (data.last_name as string) : undefined;
            const displayName =
                typeof data?.full_name === 'string' ? (data.full_name as string) : undefined;
            const imageUrl =
                typeof data?.image_url === 'string' ? (data.image_url as string) : undefined;
            const profile = {
                firstName,
                lastName,
                displayName,
                profile: imageUrl ? { avatar: imageUrl } : undefined
            } as const;
            const externalAccounts =
                (data?.external_accounts as Array<Record<string, unknown>>) || [];
            const identities = externalAccounts.map((acc) => ({
                provider: (acc.provider as string) || 'unknown',
                providerUserId: (acc.id as string) || '',
                email: (acc.email_address as string | undefined) ?? undefined,
                username: (acc.username as string | undefined) ?? undefined,
                avatarUrl: (acc.avatar_url as string | undefined) ?? undefined,
                raw: acc,
                lastLoginAt: undefined
            }));

            // Only ensure on create/updated; ignore delete for now or set lifecycle/deletedAt if desired
            if (type?.startsWith('user.')) {
                // Use guest actor for webhook operations
                // The service layer will handle foreign key constraints appropriately
                const systemActor = createGuestActor();

                const result = await userService.ensureFromAuthProvider(systemActor, {
                    provider: AuthProviderEnum.CLERK,
                    providerUserId: clerkUserId,
                    profile,
                    identities
                });
                if (result.error) {
                    apiLogger.warn(`Webhook sync error: ${result.error.message}`);
                } else {
                    // Invalidate user cache since user data was updated via webhook
                    userCache.invalidate(clerkUserId);
                }
            }

            return new Response(JSON.stringify({ success: true, data: { ok: true } }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (_err) {
            apiLogger.error('Webhook handler error');
            return new Response(
                JSON.stringify({
                    success: false,
                    error: { code: 'INTERNAL', message: 'Webhook error' }
                }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }
});
