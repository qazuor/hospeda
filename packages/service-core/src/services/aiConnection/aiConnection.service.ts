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
import { type OauthConnectionModel, oauthConnectionModel } from '@repo/db';
import {
    type AiConnection,
    type AiConnectionClientId,
    AiConnectionClientIdSchema,
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

/**
 * Lists and revokes the actor's connected AI assistants.
 */
export class AiConnectionService extends BaseService {
    static readonly ENTITY_NAME = 'aiConnection';
    protected override readonly entityName = AiConnectionService.ENTITY_NAME;

    private readonly model: OauthConnectionModel;

    constructor(config: ServiceConfig, model?: OauthConnectionModel) {
        super(config, AiConnectionService.ENTITY_NAME);
        this.model = model ?? oauthConnectionModel;
    }

    /**
     * Lists the AI assistants the actor has connected, oldest first.
     *
     * @param actor - The authenticated actor.
     * @param ctx - Optional service context.
     * @returns `{ items }`.
     */
    public async list(
        actor: Actor,
        ctx?: ServiceContext
    ): Promise<ServiceOutput<{ readonly items: readonly AiConnection[] }>> {
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
                return {
                    items: rows.map((row) => ({
                        clientId: row.clientId,
                        name: row.name,
                        uri: row.uri,
                        logoUri: row.logoUri,
                        scopes: [...row.scopes],
                        connectedAt: row.connectedAt,
                        lastUsedAt: row.lastUsedAt
                    }))
                };
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
}
