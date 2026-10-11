import { z } from 'zod';

const encryptedPart = z.string().nullable();

/** Encrypted Google calendar credential fields read from the passage table. */
export const encryptedCalendarGrantSchema = z
    .object({
        access_token_ciphertext: encryptedPart,
        access_token_iv: encryptedPart,
        access_token_auth_tag: encryptedPart,
        refresh_token_ciphertext: encryptedPart,
        refresh_token_iv: encryptedPart,
        refresh_token_auth_tag: encryptedPart,
        external_calendar_id: z.string().nullable(),
        provider: z.string().nullable().optional()
    })
    .strict();

/** One calendar credential preserved for a deleted listing. */
export type EncryptedCalendarGrant = z.infer<typeof encryptedCalendarGrantSchema>;

/** Photo information preserved for a deleted listing. */
export const passagePhotoSchema = z
    .object({ publicId: z.string().nullable(), url: z.string() })
    .strict();

/** One deleted listing row read from the external cutover passage table. */
export const passageRowSchema = z
    .object({
        entityType: z.enum(['accommodation', 'gastronomy', 'experience']),
        entityId: z.string().uuid(),
        slug: z.string().nullable(),
        photos: z.array(passagePhotoSchema),
        calendarTokens: z.array(encryptedCalendarGrantSchema)
    })
    .strict();

/** Validated representation of a row in the external passage table. */
export type PassageRow = z.infer<typeof passageRowSchema>;

/** External image deletion port. */
export interface PhotoStorage {
    /** Deletes one image and reports whether it existed. */
    delete(input: { readonly publicId: string }): Promise<{ readonly wasPresent: boolean }>;
}

/** Provider-side calendar grant revocation port. */
export interface CalendarGrantRevoker {
    /** Revokes a grant or reports that the provider already considers it invalid. */
    revoke(input: { readonly token: string }): Promise<'revoked' | 'already_invalid'>;
}

/** Decrypts one vault secret. */
export type DecryptSecret = (input: {
    readonly ciphertext: string;
    readonly iv: string;
    readonly authTag: string;
}) => { readonly plaintext: string };
