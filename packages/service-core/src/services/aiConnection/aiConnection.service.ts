/**
 * AiConnectionService (HOS-2184 T-026).
 *
 * Lets a user see and revoke the AI assistants (OAuth clients) they connected
 * to the MCP server. Every operation is scoped to the actor's own account, so
 * there is no permission to check: another user's connection is simply not
 * there (404, never 403).
 *
 * Revoking removes the consent AND the refresh tokens, see
 * `OauthConnectionModel` for why both are needed.
 *
 * @module services/aiConnection
 */
import {
    type OauthConnectionModel,
    type OauthConnectionRow,
    oauthConnectionModel,
    type UserModel,
    userModel
} from '@repo/db';
import {
    type AiConnection,
    type AiConnectionClientId,
    AiConnectionClientIdSchema,
    type AiConnectionPendingResetReview,
    type AiConnectionResetReviewAction,
    AiConnectionResetReviewActionSchema,
    type AiConnectionResetReviewResult,
    ServiceErrorCode
} from '@repo/schemas';
import { z } from 'zod';
import { BaseService } from '../../base/base.service';
import type { Actor, ServiceConfig, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';

/** Input of {@link AiConnectionService.revoke}. */
export const RevokeAiConnectionInputSchema = z.object({
    /** OAuth `client_id` to disconnect. */
    clientId: AiConnectionClientIdSchema
});

/** Input type of {@link AiConnectionService.revoke}. */
export type RevokeAiConnectionInput = z.infer<typeof RevokeAiConnectionInputSchema>;

/** What {@link AiConnectionService.revoke} reports. */
export interface RevokeAiConnectionOutput {
    /** The client that was disconnected. */
    readonly clientId: AiConnectionClientId;
    /** Rows removed, for the audit record. */
    readonly removed: {
        readonly consents: number;
        readonly refreshTokens: number;
        readonly accessTokens: number;
    };
}

/** Input of {@link AiConnectionService.resolveResetReview}. */
export const ResolveResetReviewInputSchema = z.object({
    /** What the user chose to do with the assistants connected before the reset. */
    action: AiConnectionResetReviewActionSchema
});

/** Input type of {@link AiConnectionService.resolveResetReview}. */
export type ResolveResetReviewInput = z.infer<typeof ResolveResetReviewInputSchema>;

/** What {@link AiConnectionService.resolveResetReview} reports. */
export interface ResolveResetReviewOutput extends AiConnectionResetReviewResult {
    /** Rows removed per disconnected client, for the audit records. */
    readonly removedByClient: readonly {
        readonly clientId: AiConnectionClientId;
        readonly removed: RevokeAiConnectionOutput['removed'];
    }[];
}

/** Machine-readable reason of the 409 when there is no reset to answer. */
export const NO_PENDING_RESET_REVIEW_REASON = 'NO_PENDING_RESET_REVIEW';

/** Maps a model row to the public connection shape. */
const toAiConnection = (row: OauthConnectionRow): AiConnection => ({
    clientId: row.clientId,
    name: row.name,
    uri: row.uri,
    logoUri: row.logoUri,
    scopes: [...row.scopes],
    connectedAt: row.connectedAt,
    lastUsedAt: row.lastUsedAt
});

/**
 * Parses the stored reset marker. A missing, `null` or malformed value is "no
 * reset", never an error: the marker is advisory.
 *
 * @param value - Raw `settings.aiConnectionsPasswordResetAt`.
 */
const parseResetAt = (value: unknown): Date | null => {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Lists and revokes the actor's connected AI assistants.
 */
export class AiConnectionService extends BaseService {
    static readonly ENTITY_NAME = 'aiConnection';
    protected override readonly entityName = AiConnectionService.ENTITY_NAME;

    private readonly model: OauthConnectionModel;
    private readonly userModel: UserModel;

    constructor(config: ServiceConfig, model?: OauthConnectionModel, users?: UserModel) {
        super(config, AiConnectionService.ENTITY_NAME);
        this.model = model ?? oauthConnectionModel;
        this.userModel = users ?? userModel;
    }

    /**
     * Reads the unanswered post-reset question: the connections made before the
     * user's last forgot-password reset that are still in place.
     *
     * `null` when no reset is recorded or none of those connections is left
     * (the user already removed them). Connections without a known date are
     * never listed: only a connection that provably predates the reset is
     * offered for removal.
     */
    private async readPendingResetReview(input: {
        readonly userId: string;
        readonly connections: readonly AiConnection[];
        readonly tx?: ServiceContext['tx'];
    }): Promise<AiConnectionPendingResetReview | null> {
        const user = await this.userModel.findById(input.userId, input.tx);
        const resetAt = parseResetAt(
            (user?.settings as Record<string, unknown> | null | undefined)
                ?.aiConnectionsPasswordResetAt
        );
        if (!resetAt) return null;
        const before = input.connections.filter(
            (connection) => connection.connectedAt !== null && connection.connectedAt < resetAt
        );
        return before.length > 0 ? { resetAt, connectionsBeforeReset: before } : null;
    }

    /** Sets or clears the reset marker, merging into `settings` (shallow `||`). */
    private async writeResetMarker(input: {
        readonly userId: string;
        readonly value: string | null;
        readonly tx?: ServiceContext['tx'];
    }): Promise<void> {
        const updated = await this.userModel.update(
            { id: input.userId },
            { settings: { aiConnectionsPasswordResetAt: input.value } } as Parameters<
                UserModel['update']
            >[1],
            input.tx
        );
        if (!updated) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Failed to update the AI connections reset marker'
            );
        }
    }

    /**
     * Lists the AI assistants the actor has connected, oldest first.
     *
     * @param actor - The authenticated actor.
     * @param ctx - Optional service context.
     * @returns `{ items, pendingResetReview }`. `pendingResetReview` is the
     *   unanswered post-reset question (see {@link resolveResetReview}) or `null`.
     */
    public async list(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<
        ServiceOutput<{
            readonly items: readonly AiConnection[];
            readonly pendingResetReview: AiConnectionPendingResetReview | null;
        }>
    > {
        return this.runWithLoggingAndValidation({
            methodName: 'list',
            input: { actor },
            schema: z.object({}),
            ctx,
            execute: async (_validated, validatedActor, execCtx) => {
                const rows = await this.model.listForUser({
                    userId: validatedActor.id,
                    tx: execCtx.tx
                });
                const items = rows.map(toAiConnection);
                // Nothing connected means nothing to ask about: skip the user read.
                const pendingResetReview =
                    items.length === 0
                        ? null
                        : await this.readPendingResetReview({
                              userId: validatedActor.id,
                              connections: items,
                              tx: execCtx.tx
                          });
                return { items, pendingResetReview };
            }
        });
    }

    /**
     * Disconnects one AI assistant: the next `/mcp` call with an access token it
     * already holds answers 401, and it can no longer refresh.
     *
     * Returns `NOT_FOUND` when the actor has no connection to the client,
     * whether the id is unknown or belongs to somebody else's connection.
     *
     * @param actor - The authenticated actor.
     * @param input - `{ clientId }`.
     * @param ctx - Optional service context.
     */
    public async revoke(
        actor: Actor,
        input: RevokeAiConnectionInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<RevokeAiConnectionOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'revoke',
            input: { ...input, actor },
            schema: RevokeAiConnectionInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                const removed = await this.model.revokeForUser({
                    userId: validatedActor.id,
                    clientId: validated.clientId,
                    tx: execCtx.tx
                });
                if (
                    removed.consents === 0 &&
                    removed.refreshTokens === 0 &&
                    removed.accessTokens === 0
                ) {
                    throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'AI connection not found');
                }
                return { clientId: validated.clientId, removed };
            }
        });
    }

    /**
     * Answers the post-reset question (HOS-2184).
     *
     * - `revoke_previous` disconnects exactly the connections made before the
     *   reset (the ones {@link list} reports in `pendingResetReview`), one
     *   `revokeForUser` per client, then clears the marker. A client connected
     *   after the reset is left alone.
     * - `keep` only clears the marker.
     *
     * Answers 409 `ALREADY_EXISTS` (reason `NO_PENDING_RESET_REVIEW`) when
     * there is nothing to answer, which is also what a repeated call gets: the
     * second call changes nothing. The marker is cleared last, so a failure
     * half way leaves the question open and a retry finishes the job.
     *
     * @param actor - The authenticated actor.
     * @param input - `{ action }`.
     * @param ctx - Optional service context.
     */
    public async resolveResetReview(
        actor: Actor,
        input: ResolveResetReviewInput,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<ResolveResetReviewOutput>> {
        return this.runWithLoggingAndValidation({
            methodName: 'resolveResetReview',
            input: { ...input, actor },
            schema: ResolveResetReviewInputSchema,
            ctx,
            execute: async (validated, validatedActor, execCtx) => {
                const rows = await this.model.listForUser({
                    userId: validatedActor.id,
                    tx: execCtx.tx
                });
                const connections = rows.map(toAiConnection);
                const pending = await this.readPendingResetReview({
                    userId: validatedActor.id,
                    connections,
                    tx: execCtx.tx
                });
                if (!pending) {
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        'There is no password reset review to answer',
                        undefined,
                        NO_PENDING_RESET_REVIEW_REASON
                    );
                }

                const action: AiConnectionResetReviewAction = validated.action;
                const removedByClient: {
                    clientId: AiConnectionClientId;
                    removed: RevokeAiConnectionOutput['removed'];
                }[] = [];
                if (action === 'revoke_previous') {
                    for (const connection of pending.connectionsBeforeReset) {
                        const removed = await this.model.revokeForUser({
                            userId: validatedActor.id,
                            clientId: connection.clientId,
                            tx: execCtx.tx
                        });
                        removedByClient.push({ clientId: connection.clientId, removed });
                    }
                }

                await this.writeResetMarker({
                    userId: validatedActor.id,
                    value: null,
                    tx: execCtx.tx
                });

                return {
                    action,
                    revokedClientIds: removedByClient.map((entry) => entry.clientId),
                    removedByClient
                };
            }
        });
    }
}
