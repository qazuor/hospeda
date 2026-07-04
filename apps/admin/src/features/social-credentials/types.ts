/**
 * Social credential vault types (HOS-64 G-4, T-028).
 *
 * Mirror the authoritative API contract served by
 * `apps/api/src/routes/social/admin/credentials/*` (T-026/T-027), backed by
 * `apps/api/src/services/social-credential-vault.service.ts`.
 */

/** The fixed, closed set of secrets the social vault stores. */
export type SocialCredentialKey =
    | 'make_webhook_url'
    | 'make_api_key'
    | 'ai_social_key'
    | 'operator_pin';

/** Masked social credential returned by the API — never ciphertext/iv/authTag. */
export interface SocialCredentialMasked {
    readonly id: string;
    readonly key: SocialCredentialKey;
    readonly label: string | null;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly deletedAt: string | null;
}

/** Payload for creating a new social credential. */
export interface CreateSocialCredentialPayload {
    readonly key: SocialCredentialKey;
    readonly plaintext: string;
    readonly label?: string;
}

/** Payload for rotating a social credential's secret. */
export interface RotateSocialCredentialPayload {
    readonly newPlaintext: string;
}

/** Payload for updating a social credential's metadata (label only). */
export interface UpdateSocialCredentialPayload {
    readonly label?: string;
}

/** Response shape after credential create/rotate/update. */
export interface SocialCredentialMutationResponse {
    readonly id: string;
    readonly key: SocialCredentialKey;
}

/** Response shape after credential delete. */
export interface SocialCredentialDeleteResponse {
    readonly key: SocialCredentialKey;
}

/** Display-friendly label map for the 4 social credential keys. */
export const SOCIAL_CREDENTIAL_KEY_LABELS: Record<SocialCredentialKey, string> = {
    make_webhook_url: 'Make.com Webhook URL',
    make_api_key: 'Make.com API Key',
    ai_social_key: 'AI Social Key',
    operator_pin: 'Operator PIN'
} as const;

/**
 * Returns a display-friendly label for a social credential key.
 * Falls back to the raw key for unknown values.
 */
export function getSocialCredentialKeyLabel(key: SocialCredentialKey): string {
    return SOCIAL_CREDENTIAL_KEY_LABELS[key] ?? key;
}
