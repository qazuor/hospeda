/**
 * Authentication API Schemas
 *
 * Schemas for authentication endpoints including actor information,
 * cache statistics, and authentication status responses.
 */
import { z } from 'zod';
import { StrongPasswordSchema } from '../common/password.schema.js';

/**
 * Actor schema representing authenticated users and guests
 */
export const ActorSchema = z.object({
    id: z.string().describe('Actor unique identifier'),
    role: z.string().describe('Actor role (USER, ADMIN, GUEST, etc.)'),
    permissions: z.array(z.string()).describe('Array of permission strings'),
    name: z
        .string()
        .optional()
        .describe(
            "Display name (mirrors users.display_name; absent for guests and system actors). Added in SPEC-113 so /auth/me can keep the navbar's actor.name in sync with the DB after a profile mutation."
        ),
    email: z
        .string()
        .optional()
        .describe('Actor email (absent for guests and system actors). Added in SPEC-113.'),
    image: z
        .string()
        .optional()
        .describe(
            'Actor avatar URL (mirrors users.image — Better Auth auto-populates this from the Google `picture` claim or the Facebook profile photo on OAuth signin). Absent for users without an uploaded avatar, guests, and system actors. Added in SPEC-113 follow-up so /auth/me can keep the navbar avatar in sync after profile mutations, matching the existing actor.name/email semantics.'
        ),
    _isSystemActor: z
        .boolean()
        .optional()
        .describe('Flag indicating this is a system actor, not a real user')
});

export type Actor = z.infer<typeof ActorSchema>;

/**
 * Actor response schema for API responses.
 * Omits `_isSystemActor` which is an internal-only flag.
 */
export const ActorResponseSchema = ActorSchema.omit({ _isSystemActor: true });

export type ActorResponse = z.infer<typeof ActorResponseSchema>;

/**
 * Auth status response schema for /auth/me endpoint
 */
export const AuthMeResponseSchema = z.object({
    actor: ActorResponseSchema,
    isAuthenticated: z.boolean().describe('Whether the actor is authenticated (not a guest)'),
    passwordChangeRequired: z
        .boolean()
        .optional()
        .describe('Whether the user must change their password before continuing')
});

export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

/**
 * Change password input schema for POST /auth/change-password
 *
 * Uses `StrongPasswordSchema` as the single source of truth for password
 * complexity rules (min 8, max 128, uppercase, lowercase, digit, special char).
 */
export const ChangePasswordInputSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: StrongPasswordSchema
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

/**
 * Change password response schema
 */
export const ChangePasswordResponseSchema = z.object({
    success: z.boolean(),
    message: z.string()
});

export type ChangePasswordResponse = z.infer<typeof ChangePasswordResponseSchema>;

/**
 * Authentication status response schema for /auth/status endpoint
 */
export const AuthStatusResponseSchema = z.object({
    success: z.boolean(),
    data: z.object({
        isAuthenticated: z.boolean().describe('Whether user is authenticated'),
        userId: z.string().nullish().describe('User ID if authenticated'),
        actor: ActorResponseSchema
    }),
    metadata: z.object({
        timestamp: z.string().describe('Response timestamp'),
        requestId: z.string().describe('Unique request identifier')
    })
});

export type AuthStatusResponse = z.infer<typeof AuthStatusResponseSchema>;

/**
 * Cache statistics schema for cache performance monitoring
 */
export const CacheStatsSchema = z.object({
    size: z.number().describe('Current number of cached users'),
    maxSize: z.number().describe('Maximum cache capacity'),
    hitCount: z.number().describe('Total cache hits since startup'),
    missCount: z.number().describe('Total cache misses since startup'),
    hitRate: z.number().min(0).max(1).describe('Cache hit rate (0-1)'),
    pendingQueries: z.number().describe('Number of queries currently in progress')
});

export type CacheStats = z.infer<typeof CacheStatsSchema>;

/**
 * Cache performance metrics schema
 */
export const CachePerformanceSchema = z.object({
    hitRatePercentage: z.string().describe('Hit rate as percentage'),
    totalRequests: z.number().describe('Total requests processed'),
    efficiency: z.enum(['excellent', 'good', 'fair', 'poor']).describe('Cache efficiency rating')
});

export type CachePerformance = z.infer<typeof CachePerformanceSchema>;

/**
 * Complete cache statistics response schema for /auth/cache/stats endpoint
 */
export const CacheStatsResponseSchema = z.object({
    cache: CacheStatsSchema,
    performance: CachePerformanceSchema,
    recommendations: z.array(z.string()).describe('Performance recommendations')
});

export type CacheStatsResponse = z.infer<typeof CacheStatsResponseSchema>;

/**
 * Sync operation result schema for webhook/sync endpoints
 */
export const SyncUserResponseSchema = z.object({
    user: z.object({ id: z.string() }).passthrough().describe('User sync result')
});

export type SyncUserResponse = z.infer<typeof SyncUserResponseSchema>;

/**
 * Sign out response schema for /auth/signout endpoint
 */
export const AuthSignOutResponseSchema = z.object({
    message: z.string().describe('Success message'),
    cacheCleared: z.boolean().describe('Whether cache was cleared')
});

export type AuthSignOutResponse = z.infer<typeof AuthSignOutResponseSchema>;

/**
 * Failure reasons for a reset-password token check.
 *
 * - `expired`: The token row exists in the `verifications` table but its
 *   `expiresAt` is in the past.
 * - `invalid`: The token row is not present. This collapses three real-world
 *   cases that Better Auth cannot distinguish post-consumption: (1) the token
 *   was already consumed (Better Auth deletes the row on use), (2) the token
 *   string was hand-tampered or never existed, (3) the token belongs to a
 *   different identifier namespace.
 *
 * See SPEC-118 Phase 0 decision for the rationale on collapsing
 * `used`/`unknown`/`tampered` into a single `invalid` reason.
 */
export const ResetPasswordCheckReasonSchema = z.enum(['expired', 'invalid']);

export type ResetPasswordCheckReason = z.infer<typeof ResetPasswordCheckReasonSchema>;

/**
 * Query parameters for `GET /api/v1/public/auth/reset-password/check`.
 *
 * The token is the opaque string Better Auth embedded in the password-reset
 * email URL. We accept it as-is and pass it to the verification lookup; format
 * validation beyond non-empty is intentionally skipped because Better Auth
 * controls the token format and may evolve it across versions.
 */
export const ResetPasswordCheckQuerySchema = z.object({
    token: z
        .string()
        .min(1, 'Token is required')
        .max(512, 'Token is too long')
        .describe('Opaque reset-password token from the email link')
});

export type ResetPasswordCheckQuery = z.infer<typeof ResetPasswordCheckQuerySchema>;

/**
 * Response payload for the reset-password token check.
 *
 * Discriminated by `valid`. When `valid: false`, `reason` indicates whether
 * the token is past its TTL (`expired`) or unrecognised (`invalid`). The web
 * page branches on this to render the form vs an error state with a "request
 * new link" CTA.
 */
export const ResetPasswordCheckResponseSchema = z.discriminatedUnion('valid', [
    z.object({
        valid: z.literal(true)
    }),
    z.object({
        valid: z.literal(false),
        reason: ResetPasswordCheckReasonSchema
    })
]);

export type ResetPasswordCheckResponse = z.infer<typeof ResetPasswordCheckResponseSchema>;
