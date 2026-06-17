/**
 * @file user.push-token.schema.ts
 *
 * Schemas for the push-token registration endpoint (SPEC-243 T-011).
 *
 * Used by POST /api/v1/protected/profile/push-token.
 * These schemas are the single source of truth for the request/response
 * contract shared between the API route and mobile client.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// POST /api/v1/protected/profile/push-token
// ---------------------------------------------------------------------------

/**
 * Request body for the push-token registration endpoint.
 *
 * Registers (or re-registers) an Expo push token for the authenticated user's
 * current device. The server performs an UPSERT on the global token column:
 * if another user previously registered this token (e.g. after a re-login),
 * ownership is transferred to the current actor.
 */
export const PushTokenRegisterBodySchema = z
    .object({
        /**
         * Expo push token string (e.g. `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxxxx]`
         * or a raw APNs / FCM device token string for bare workflow).
         * Max 512 characters covers all known Expo token formats.
         */
        token: z
            .string({ message: 'zodError.pushToken.token.required' })
            .min(1, { message: 'zodError.pushToken.token.min' })
            .max(512, { message: 'zodError.pushToken.token.max' }),

        /**
         * Device platform.
         * Must be one of 'ios', 'android', or 'web'.
         */
        platform: z.enum(['ios', 'android', 'web'], {
            message: 'zodError.pushToken.platform.invalid'
        })
    })
    .strict();

/** Inferred TypeScript type for {@link PushTokenRegisterBodySchema}. */
export type PushTokenRegisterBody = z.infer<typeof PushTokenRegisterBodySchema>;

/**
 * Response returned by POST /api/v1/protected/profile/push-token.
 *
 * A literal `registered: true` signals successful upsert.
 */
export const PushTokenRegisterResponseSchema = z.object({
    registered: z.literal(true)
});

/** Inferred TypeScript type for {@link PushTokenRegisterResponseSchema}. */
export type PushTokenRegisterResponse = z.infer<typeof PushTokenRegisterResponseSchema>;
