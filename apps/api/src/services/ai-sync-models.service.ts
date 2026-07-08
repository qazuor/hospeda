/**
 * AI provider model-sync orchestration service (HOS-94, T-008).
 *
 * Wires together the three building blocks the earlier tasks of this spec
 * already implemented, in the exact order described in spec §6.4 / §12:
 *
 * 1. **Decrypt** — `getDecryptedAiProviderCredential` (T-... / SPEC-173 T-022)
 *    resolves the active credential for `providerId` and returns the
 *    plaintext API key. This service additionally reads the credential's
 *    `metadata.baseURL` directly (the vault's read path intentionally does
 *    NOT return metadata — see the module-level gotcha note below).
 * 2. **Fetch** — `listProviderModels` (`@repo/ai-core`, T-003/T-004/T-005) is
 *    a plain-`fetch` per-provider dispatcher that returns raw model ids.
 * 3. **Filter** — `filterChatCapableModels` (T-006) classifies raw ids into
 *    confident-chat / uncertain, hiding known non-chat families entirely and
 *    reporting the excluded ids as `hiddenIds` (owner follow-up, threaded
 *    into this service's `hiddenModelIds` result field below).
 * 4. **Merge** — `mergeDetectedAndCuratedModels` (T-007) unions the filtered
 *    detected list with the curated `KNOWN_PROVIDERS` catalog, annotating
 *    each entry by `source`.
 *
 * The result matches `AiSyncModelsResultSchema` (`@repo/schemas`) exactly and
 * is NEVER persisted here (OQ-3: the sync is ephemeral — only the operator's
 * confirmed enabled subset persists, via the existing `PATCH /{providerId}`
 * route).
 *
 * ## Gotcha — `getDecryptedAiProviderCredential` does not return `metadata`
 *
 * The vault service's `DecryptedCredentialResult` shape is
 * `{ providerId, plaintextKey }` only (see `ai-credential-vault.service.ts`).
 * The existing consumer of `metadata.baseURL` (`ai-service.factory.ts`,
 * `createConfiguredAiService`) works around this by running its own
 * `db.select({ providerId, metadata })` query alongside the vault call. This
 * service follows that exact precedent (`getCredentialBaseUrl` below) rather
 * than modifying the vault service's public contract, which is out of scope
 * for T-008 and already covered by its own test suite.
 *
 * ## Design decisions (mirrors `ai-credential-vault.service.ts`)
 *
 * - Plain module in `apps/api/src/services/` — does NOT extend `BaseService`.
 * - Returns `ServiceOutput<T>` from `@repo/service-core` for shape
 *   consistency with the rest of the vault/sync surface.
 * - **No `actor` parameter.** Like `getDecryptedAiProviderCredential`, this
 *   is a read-only orchestration path: it performs no DB write and no audit
 *   row, so there is nothing for an actor to be attributed to. The route
 *   layer (T-009) still enforces `AI_SETTINGS_MANAGE` before calling in; the
 *   auto-sync-on-create/rotate wiring (T-010) calls this service the same
 *   way, fire-and-forget, from inside an already-authorized mutation.
 * - **R-5 secret handling**: the decrypted `plaintextKey` is passed to
 *   `listProviderModels` and nowhere else. It is never logged, never placed
 *   in a returned value, and never included in an error message — every
 *   `ListModelsError` subclass thrown by the fetcher is engineered to omit
 *   the key from its `message` (see `@repo/ai-core/providers/list-models`).
 *
 * ## Preflight variant (BETA-129 part 1)
 *
 * Steps 2-4 (fetch -> filter -> merge) are pure over an in-memory API key —
 * they never touch the DB or the credential vault. That core is factored out
 * into `syncModelsFromKey`, shared by:
 *
 * - {@link syncAiProviderModels} — decrypts a STORED credential first
 *   (step 1), then delegates to the shared core.
 * - {@link syncAiProviderModelsPreflight} — skips step 1 entirely and calls
 *   the shared core directly with a caller-supplied `plaintextKey`, letting
 *   an admin preview a provider's models in the "create credential" dialog
 *   before anything is encrypted or saved. Same R-5 hygiene applies: the key
 *   is used once and never logged, returned, or echoed.
 *
 * @module services/ai-sync-models
 */

import type {
    ListModelsError,
    ListProviderModelsInput,
    ListProviderModelsResult
} from '@repo/ai-core';
import {
    ListModelsAuthError,
    ListModelsRateLimitError,
    ListModelsUnsupportedProviderError,
    ListModelsUpstreamError,
    listProviderModels
} from '@repo/ai-core';
import { aiProviderCredentials, getDb } from '@repo/db';
import type { AiSyncModelsResult } from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import type { ServiceOutput } from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import { apiLogger } from '../utils/logger.js';
import { getDecryptedAiProviderCredential } from './ai-credential-vault.service.js';
import { filterChatCapableModels } from './ai-sync-models.filter.js';
import { mergeDetectedAndCuratedModels } from './ai-sync-models.merge.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

/**
 * Input for {@link syncAiProviderModels}.
 */
export interface SyncAiProviderModelsInput {
    /** AI provider identifier (matches `ai_provider_credentials.providerId`). */
    readonly providerId: string;
}

/**
 * Input for {@link syncAiProviderModelsPreflight} (BETA-129 part 1).
 */
export interface SyncAiProviderModelsPreflightInput {
    /** AI provider identifier (e.g. `openai`, `anthropic`, `ollama`). */
    readonly providerId: string;
    /** The raw, not-yet-saved API key. Used once, never persisted or logged. */
    readonly plaintextKey: string;
    /** Optional base URL override (required by self-hosted providers like Ollama). */
    readonly baseURL?: string;
}

/**
 * Input for the shared {@link syncModelsFromKey} core (internal).
 */
interface SyncModelsFromKeyInput {
    readonly providerId: string;
    readonly apiKey: string;
    readonly baseURL?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds the standard error output shape. Mirrors the helper of the same
 * name in `ai-credential-vault.service.ts` for consistency across the two
 * sibling services.
 *
 * @param code - `ServiceErrorCode` for this error.
 * @param message - Human-readable error message.
 * @returns Failure `ServiceOutput<never>`.
 */
function errorOutput<T>(code: ServiceErrorCode, message: string): ServiceOutput<T> {
    return { error: { code, message } };
}

/**
 * Reads the active credential's `metadata.baseURL` for `providerId`,
 * mirroring the metadata query already used by `createConfiguredAiService`
 * (`ai-service.factory.ts`), since `getDecryptedAiProviderCredential` does
 * not expose metadata.
 *
 * @param providerId - AI provider identifier to look up.
 * @returns The stored `baseURL`, or `undefined` when absent/not a string.
 */
async function getCredentialBaseUrl(providerId: string): Promise<string | undefined> {
    const db = getDb();

    const rows = await db
        .select({ metadata: aiProviderCredentials.metadata })
        .from(aiProviderCredentials)
        .where(
            and(
                eq(aiProviderCredentials.providerId, providerId),
                isNull(aiProviderCredentials.deletedAt)
            )
        )
        .limit(1);

    const metadata = rows[0]?.metadata;
    if (metadata === null || metadata === undefined || typeof metadata !== 'object') {
        return undefined;
    }

    const baseURL = (metadata as Record<string, unknown>).baseURL;
    return typeof baseURL === 'string' && baseURL.length > 0 ? baseURL : undefined;
}

/**
 * Maps a thrown `ListModelsError` (or an unexpected non-`ListModelsError`
 * failure) from `listProviderModels` to a typed `ServiceOutput` error.
 *
 * Mapping (spec §7, closest existing `ServiceErrorCode` — see the module's
 * Key Learnings entry for why no dedicated code was added):
 *
 * - `ListModelsAuthError` (invalid/expired key, HTTP 401/403) →
 *   `ServiceErrorCode.VALIDATION_ERROR` (HTTP 400) — the stored credential is
 *   present but the provider rejected it; this is an operator/config problem
 *   (fix/rotate the key), NOT a server fault, so it must not surface as a 5xx
 *   (which would trip false Sentry alerts). See HOS-94 owner decision.
 * - `ListModelsRateLimitError` / `ListModelsUpstreamError` /
 *   `ListModelsUnsupportedProviderError` (rate-limited, provider down,
 *   unexpected shape, unsupported family) →
 *   `ServiceErrorCode.SERVICE_UNAVAILABLE` — the external dependency is not
 *   available right now; a retry may succeed.
 * - Anything else (a non-`ListModelsError` exception) →
 *   `ServiceErrorCode.INTERNAL_ERROR`.
 *
 * @param providerId - AI provider identifier, for structured logging only.
 * @param error - The value thrown by `listProviderModels`.
 * @returns A failure `ServiceOutput<T>` with a stable, typed error code.
 */
function mapListModelsError<T>(providerId: string, error: unknown): ServiceOutput<T> {
    if (error instanceof ListModelsAuthError) {
        apiLogger.warn(
            { providerId, code: error.code },
            'ai-sync-models: provider rejected the stored credential'
        );
        return errorOutput<T>(ServiceErrorCode.VALIDATION_ERROR, error.message);
    }

    if (
        error instanceof ListModelsRateLimitError ||
        error instanceof ListModelsUpstreamError ||
        error instanceof ListModelsUnsupportedProviderError
    ) {
        const typedError = error as ListModelsError;
        apiLogger.warn(
            { providerId, code: typedError.code },
            'ai-sync-models: list-models upstream failure'
        );
        return errorOutput<T>(ServiceErrorCode.SERVICE_UNAVAILABLE, typedError.message);
    }

    const message =
        error instanceof Error ? error.message : 'Unexpected error while fetching provider models';
    apiLogger.error({ providerId, error: message }, 'ai-sync-models: unexpected fetcher error');
    return errorOutput<T>(ServiceErrorCode.INTERNAL_ERROR, message);
}

// ---------------------------------------------------------------------------
// Shared core (fetch -> filter -> merge), no DB coupling
// ---------------------------------------------------------------------------

/**
 * Shared core of the sync-models flow: fetch the raw model list from the
 * provider, filter to chat-capable models, and merge with the curated
 * catalog. Operates purely over an in-memory `apiKey` — it never touches the
 * DB or the credential vault, which is exactly what lets both
 * {@link syncAiProviderModels} (stored-credential path) and
 * {@link syncAiProviderModelsPreflight} (not-yet-saved key path, BETA-129
 * part 1) share it.
 *
 * @param input - `{ providerId, apiKey, baseURL? }`.
 * @returns `ServiceOutput` with an `AiSyncModelsResult` on success.
 */
async function syncModelsFromKey(
    input: SyncModelsFromKeyInput
): Promise<ServiceOutput<AiSyncModelsResult>> {
    const { providerId, apiKey, baseURL } = input;

    try {
        // 1. Fetch the raw model list from the provider.
        let fetchResult: ListProviderModelsResult;
        try {
            const fetchInput: ListProviderModelsInput = {
                providerId,
                apiKey,
                ...(baseURL === undefined ? {} : { baseURL })
            };
            fetchResult = await listProviderModels(fetchInput);
        } catch (fetchError) {
            return mapListModelsError<AiSyncModelsResult>(providerId, fetchError);
        }

        // 2. Filter to chat-capable models (denylist + uncertain bucket).
        //    `hiddenIds` are the raw ids the denylist excluded — surfaced so
        //    the admin UI can auto-remove them from a previously-enabled
        //    selection on re-sync, while telling them apart from hand-typed
        //    custom ids the provider API never returned (owner follow-up).
        const { models: classified, hiddenIds } = filterChatCapableModels({
            ids: fetchResult.ids,
            providerId
        });

        // 3. Merge with the curated `KNOWN_PROVIDERS` catalog.
        const models = mergeDetectedAndCuratedModels({ providerId, detected: classified });

        const result: AiSyncModelsResult = {
            providerId,
            models,
            fetchedAt: new Date().toISOString(),
            ...(fetchResult.warnings && fetchResult.warnings.length > 0
                ? { warnings: fetchResult.warnings }
                : {}),
            ...(hiddenIds.length > 0 ? { hiddenModelIds: [...hiddenIds] } : {})
        };

        apiLogger.info({ providerId, modelCount: models.length }, 'ai-sync-models: sync completed');

        return { data: result };
    } catch (error) {
        apiLogger.error(
            { providerId, error: error instanceof Error ? error.message : String(error) },
            'ai-sync-models: unexpected error in syncModelsFromKey'
        );
        return errorOutput<AiSyncModelsResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while syncing provider models'
        );
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Syncs the suggested model catalog for an AI provider by decrypting its
 * stored credential, calling the provider's live list-models endpoint,
 * filtering to chat-capable models, and merging with the curated catalog.
 *
 * Never persists anything (OQ-3 — ephemeral by design) and never logs or
 * returns the decrypted API key (R-5).
 *
 * Fails with the vault's own error (typically `NOT_FOUND`) when no active
 * credential is configured for `providerId`. Fails with
 * `ServiceErrorCode.VALIDATION_ERROR` (HTTP 400) when the provider rejects the
 * stored key, or `ServiceErrorCode.SERVICE_UNAVAILABLE` when the provider is
 * unreachable, rate-limiting, or returns an unsupported/unexpected shape.
 *
 * @param input - `{ providerId }` — the AI provider to sync.
 * @returns `ServiceOutput` with an `AiSyncModelsResult` on success.
 *
 * @example
 * ```ts
 * const result = await syncAiProviderModels({ providerId: 'openai' });
 * if (result.data) {
 *   console.log(result.data.models); // detected ∪ curated, annotated by source
 * }
 * ```
 */
export async function syncAiProviderModels(
    input: SyncAiProviderModelsInput
): Promise<ServiceOutput<AiSyncModelsResult>> {
    const { providerId } = input;

    try {
        // 1. Decrypt the active credential. No active credential → pass the
        //    vault's own typed error straight through (already `NOT_FOUND`
        //    with a descriptive message — no need to re-wrap it).
        const credentialResult = await getDecryptedAiProviderCredential({ providerId });
        if (credentialResult.data === undefined) {
            return errorOutput<AiSyncModelsResult>(
                credentialResult.error?.code ?? ServiceErrorCode.NOT_FOUND,
                credentialResult.error?.message ??
                    `No active credential configured for provider '${providerId}'`
            );
        }

        const { plaintextKey } = credentialResult.data;
        const baseURL = await getCredentialBaseUrl(providerId);

        // 2-4. Fetch -> filter -> merge, shared with the preflight path.
        return await syncModelsFromKey({ providerId, apiKey: plaintextKey, baseURL });
    } catch (error) {
        apiLogger.error(
            { providerId, error: error instanceof Error ? error.message : String(error) },
            'ai-sync-models: unexpected error in syncAiProviderModels'
        );
        return errorOutput<AiSyncModelsResult>(
            ServiceErrorCode.INTERNAL_ERROR,
            'Unexpected error while syncing provider models'
        );
    }
}

/**
 * Syncs the suggested model catalog for an AI provider using a just-typed,
 * not-yet-saved API key (BETA-129 part 1).
 *
 * Lets an admin preview a provider's model catalog in the "create
 * credential" dialog BEFORE the key is encrypted and stored — there is no
 * DB row to decrypt yet, so `plaintextKey` and (optionally) `baseURL` are
 * supplied directly by the caller. Delegates the fetch/filter/merge core to
 * {@link syncModelsFromKey}, the exact same logic used by the stored-
 * credential path ({@link syncAiProviderModels}), so both surfaces stay in
 * lockstep.
 *
 * Never persists anything and never logs or returns the plaintext key (R-5).
 *
 * @param input - `{ providerId, plaintextKey, baseURL? }`.
 * @returns `ServiceOutput` with an `AiSyncModelsResult` on success.
 *
 * @example
 * ```ts
 * const result = await syncAiProviderModelsPreflight({
 *   providerId: 'openai',
 *   plaintextKey: 'sk-...' // typed into the create-credential form, not yet saved
 * });
 * ```
 */
export async function syncAiProviderModelsPreflight(
    input: SyncAiProviderModelsPreflightInput
): Promise<ServiceOutput<AiSyncModelsResult>> {
    const { providerId, plaintextKey, baseURL } = input;

    return syncModelsFromKey({ providerId, apiKey: plaintextKey, baseURL });
}
