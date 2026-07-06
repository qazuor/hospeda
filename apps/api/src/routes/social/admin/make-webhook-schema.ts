/**
 * @file make-webhook-schema.ts
 *
 * GET /api/v1/admin/social/make-webhook-schema
 *
 * Returns everything the operator needs to configure the Make.com side of the
 * social publishing integration, so it can be pasted/copied directly without
 * reverse-engineering the payload from code:
 *   1. `payloadSchema`  — live JSON Schema of `SocialMakePayloadSchema`, the
 *      body Hospeda POSTs to the Make.com webhook for each target.
 *   2. `responseSchema` — live JSON Schema of `MakeWebhookResponseSchema`, the
 *      synchronous "Webhook Response" body Make.com must return.
 *   3. `webhookUrl`     — the outbound Make.com webhook URL Hospeda dispatches to.
 *   4. `makeApiKey`     — the value Hospeda sends in the `x-make-apikey` header
 *      (the admin UI masks it with reveal-on-click).
 *   5. `headerName`     — the outbound auth header name (`x-make-apikey`).
 *
 * Both JSON Schemas are generated programmatically from the canonical Zod
 * schemas in `@repo/schemas` (via Zod 4's `z.toJSONSchema`), so they can never
 * drift from the shape the dispatch service actually sends/expects (HOS-13
 * Risk R-5 — same rationale as the GPT action schema export).
 *
 * ## Security note (owner-approved deviation)
 * `webhookUrl` and `makeApiKey` are read from the encrypted social credentials
 * vault (HOS-64) and returned in plaintext over HTTP. HOS-64's vault contract
 * otherwise keeps `getDecryptedSocialCredential` server-side only; exposing the
 * values here is a deliberate, owner-approved choice (HOS-67) because the whole
 * purpose of this export is to let the operator copy the real config into
 * Make.com. The endpoint is gated by admin session + SOCIAL_SETTINGS_MANAGE,
 * and the values are never logged.
 *
 * @module routes/social/admin/make-webhook-schema
 * @see HOS-67 (SPEC-297d) G-6
 */

import { z } from '@hono/zod-openapi';
import {
    MakeWebhookResponseSchema,
    PermissionEnum,
    ServiceErrorCode,
    SocialMakePayloadSchema
} from '@repo/schemas';
import { z as zodCore } from 'zod';
import { getDecryptedSocialCredential } from '../../../services/social-credential-vault.service';
import { createAdminRoute } from '../../../utils/route-factory';

/** Outbound auth header Hospeda sends on every Make.com dispatch POST. */
const MAKE_AUTH_HEADER_NAME = 'x-make-apikey';

/**
 * Resolution state of a vault-backed credential field.
 * - `ok`      — the credential exists and was decrypted; `value` holds it.
 * - `missing` — no credential is configured for this key (`NOT_FOUND`).
 * - `error`   — the credential exists but could not be read (decryption/DB
 *   failure, e.g. a misconfigured vault master key); `value` is `null` and the
 *   UI must show an error rather than the misleading "not configured" state.
 */
type CredentialFieldStatus = 'ok' | 'missing' | 'error';

/** A vault-backed credential value plus its resolution state. */
interface CredentialField {
    /** Plaintext secret when `status === 'ok'`, otherwise `null`. */
    readonly value: string | null;
    /** Resolution state — lets the UI distinguish "missing" from "error". */
    readonly status: CredentialFieldStatus;
}

/** Result shape of {@link getDecryptedSocialCredential} (inferred, no internal import). */
type VaultReadResult = Awaited<ReturnType<typeof getDecryptedSocialCredential>>;

/**
 * Maps a vault read result to a {@link CredentialField}, distinguishing a
 * genuinely-unconfigured credential (`NOT_FOUND` → `missing`) from a read/decrypt
 * failure (`error`). Never surfaces the two as the same state.
 *
 * @param result - The `getDecryptedSocialCredential` output for one key.
 * @returns The credential value + resolution state (never the raw error).
 */
function toCredentialField(result: VaultReadResult): CredentialField {
    if (result.data) {
        return { value: result.data.plaintext, status: 'ok' };
    }
    if (result.error?.code === ServiceErrorCode.NOT_FOUND) {
        return { value: null, status: 'missing' };
    }
    return { value: null, status: 'error' };
}

/**
 * Builds the schema-documentation portion of the export (no secrets, no DB).
 *
 * Pure function — suitable for unit testing without booting the app or the DB.
 * Both JSON Schemas are derived from the canonical Zod schemas, so any change to
 * `SocialMakePayloadSchema` / `MakeWebhookResponseSchema` is reflected here
 * automatically (the AC-1 "generated, not hand-written" guarantee).
 *
 * `unrepresentable: 'any'` maps JSON-Schema-unrepresentable Zod nodes (e.g.
 * `scheduledAt: z.date()`) to an open `{}` instead of throwing; the field is
 * serialised as an ISO string on the wire.
 *
 * @returns The payload/response JSON Schemas plus the outbound header name.
 */
export function buildMakeWebhookSchemaDoc(): {
    readonly payloadSchema: Record<string, unknown>;
    readonly responseSchema: Record<string, unknown>;
    readonly headerName: typeof MAKE_AUTH_HEADER_NAME;
} {
    const payloadSchema = zodCore.toJSONSchema(SocialMakePayloadSchema, {
        unrepresentable: 'any'
    }) as Record<string, unknown>;
    const responseSchema = zodCore.toJSONSchema(MakeWebhookResponseSchema, {
        unrepresentable: 'any'
    }) as Record<string, unknown>;

    return { payloadSchema, responseSchema, headerName: MAKE_AUTH_HEADER_NAME };
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/social/make-webhook-schema
 *
 * Returns the Make.com webhook config export (payload/response JSON Schemas +
 * webhook URL + API key + header name). Admin + SOCIAL_SETTINGS_MANAGE required.
 */
export const adminGetMakeWebhookSchemaRoute = createAdminRoute({
    method: 'get',
    path: '/',
    summary: 'Export Make.com webhook config',
    description:
        'Returns the live JSON Schema of the Make.com dispatch payload and webhook ' +
        'response, plus the configured webhook URL and outbound API key, so the ' +
        'operator can configure the Make.com scenario without reverse-engineering ' +
        'the payload. The JSON Schemas are generated from the canonical Zod schemas.',
    tags: ['Social Settings'],
    requiredPermissions: [PermissionEnum.SOCIAL_SETTINGS_MANAGE],
    responseSchema: z.object({
        payloadSchema: z.object({}).passthrough(),
        responseSchema: z.object({}).passthrough(),
        webhookUrl: z.object({
            value: z.string().nullable(),
            status: z.enum(['ok', 'missing', 'error'])
        }),
        makeApiKey: z.object({
            value: z.string().nullable(),
            status: z.enum(['ok', 'missing', 'error'])
        }),
        headerName: z.literal(MAKE_AUTH_HEADER_NAME)
    }),
    handler: async () => {
        const doc = buildMakeWebhookSchemaDoc();

        // Read the outbound webhook URL + API key from the encrypted vault
        // (HOS-64). A missing credential and a read/decrypt failure are mapped
        // to distinct states so the UI never shows a vault error as "not
        // configured" (see toCredentialField).
        const [urlResult, keyResult] = await Promise.all([
            getDecryptedSocialCredential({ key: 'make_webhook_url' }),
            getDecryptedSocialCredential({ key: 'make_api_key' })
        ]);

        return {
            payloadSchema: doc.payloadSchema,
            responseSchema: doc.responseSchema,
            webhookUrl: toCredentialField(urlResult),
            makeApiKey: toCredentialField(keyResult),
            headerName: doc.headerName
        };
    }
});
