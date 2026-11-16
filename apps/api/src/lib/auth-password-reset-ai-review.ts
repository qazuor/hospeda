/**
 * @file auth-password-reset-ai-review.ts
 *
 * Records that a user reset their password while AI assistants were connected,
 * so the web can ask them on their next login whether to also disconnect those
 * assistants (HOS-2184). It never disconnects anything by itself.
 *
 * Called from Better Auth's `emailAndPassword.onPasswordReset`, which fires only
 * for the forgot-password flow. Changing the password while signed in goes
 * through a different route and never reaches it, which is the owner's rule:
 * the question is for a reset only.
 *
 * Storage: `users.settings.aiConnectionsPasswordResetAt` (ISO string). It rides
 * the existing `settings` JSONB column, merged with `||`, so no migration is
 * needed. The marker is recorded ONLY when the user has at least one connection
 * at that moment: with none there is nothing to ask about, and a connection
 * made afterwards is newer than the reset and never part of the question.
 *
 * The table references are resolved inside the function on purpose: this module
 * is imported by `lib/auth.ts`, and reading a `@repo/db` table at module scope
 * breaks boot with the MCP flag off.
 *
 * Failure policy: never throws. A password reset must succeed even when this
 * side effect cannot be recorded; the failure is logged.
 */

import { oauthConnectionModel, userModel } from '@repo/db';
import { createLogger } from '@repo/logger';

const logger = createLogger('auth-password-reset-ai-review');

/** Persistence the recorder needs, injectable for tests. */
export interface PasswordResetAiReviewDeps {
    readonly listConnections: (input: { readonly userId: string }) => Promise<readonly unknown[]>;
    readonly writeMarker: (input: {
        readonly userId: string;
        readonly value: string;
    }) => Promise<void>;
    readonly now: () => Date;
}

/** Production wiring, resolved lazily on each call. */
const defaultDeps = (): PasswordResetAiReviewDeps => ({
    listConnections: ({ userId }) => oauthConnectionModel.listForUser({ userId }),
    writeMarker: async ({ userId, value }) => {
        await userModel.update({ id: userId }, {
            settings: { aiConnectionsPasswordResetAt: value }
        } as Parameters<typeof userModel.update>[1]);
    },
    now: () => new Date()
});

/**
 * Records the reset instant for a user who has AI assistants connected.
 *
 * @param params - Receive-object payload.
 * @param params.userId - The account whose password was just reset.
 * @param params.deps - Optional persistence overrides (tests).
 * @returns `true` when the marker was written, `false` when the user has no
 *   connection or the write failed.
 */
export const recordPasswordResetForAiConnections = async (params: {
    readonly userId: string;
    readonly deps?: PasswordResetAiReviewDeps;
}): Promise<boolean> => {
    const { userId } = params;
    const deps = params.deps ?? defaultDeps();
    try {
        const connections = await deps.listConnections({ userId });
        if (connections.length === 0) {
            return false;
        }
        await deps.writeMarker({ userId, value: deps.now().toISOString() });
        return true;
    } catch (error) {
        logger.warn(
            { userId, error: error instanceof Error ? error.message : String(error) },
            'Could not record the password reset for the AI assistants review'
        );
        return false;
    }
};
