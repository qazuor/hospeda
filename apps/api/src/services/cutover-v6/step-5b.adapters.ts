import type { ImageProvider } from '@repo/media/server';
import { CloudinaryProvider } from '@repo/media/server';
import { env } from '../../utils/env.js';
import { GoogleOAuthClientError, revokeToken } from '../google-calendar/google-oauth-client.js';
import type { CalendarGrantRevoker, PhotoStorage } from './ports.js';

/** Error thrown when remote photo deletion cannot safely use Cloudinary. */
export class CutoverPhotoStorageError extends Error {
    /** Creates a typed setup or provider error. */
    constructor(message: string) {
        super(message);
        this.name = 'CutoverPhotoStorageError';
    }
}

/**
 * Creates the Cloudinary deletion port and rejects local memory doubles.
 *
 * @param input - The configured image provider, if one exists.
 * @returns A port limited to individual remote deletion.
 * @throws {CutoverPhotoStorageError} When Cloudinary is not configured or the
 *   provider is not a real CloudinaryProvider.
 */
export function createPhotoStorage(input: {
    readonly provider: ImageProvider | null;
}): PhotoStorage {
    if (input.provider === null) {
        const required = [
            ['HOSPEDA_CLOUDINARY_CLOUD_NAME', env.HOSPEDA_CLOUDINARY_CLOUD_NAME],
            ['HOSPEDA_CLOUDINARY_API_KEY', env.HOSPEDA_CLOUDINARY_API_KEY],
            ['HOSPEDA_CLOUDINARY_API_SECRET', env.HOSPEDA_CLOUDINARY_API_SECRET]
        ] as const;
        const missing = required.filter(([, value]) => !value).map(([name]) => name);
        if (missing.length > 0) {
            throw new CutoverPhotoStorageError(
                `Cloudinary provider is unavailable; missing variables: ${missing.join(', ')}`
            );
        }
        throw new CutoverPhotoStorageError(
            'Cloudinary provider is unavailable; all required variables are set, but provider initialization failed'
        );
    }
    if (!(input.provider instanceof CloudinaryProvider)) {
        throw new CutoverPhotoStorageError(
            'Step 5b requires a CloudinaryProvider; memory providers are refused'
        );
    }
    const provider = input.provider;
    return { delete: ({ publicId }) => provider.delete({ publicId }) };
}

/**
 * Creates a Google Calendar grant revoker using the existing OAuth client.
 *
 * @returns A revocation port that recognizes Google's already-invalid response.
 */
export function createGoogleGrantRevoker(): CalendarGrantRevoker {
    return {
        async revoke({ token }) {
            try {
                await revokeToken({ token });
                return 'revoked';
            } catch (error) {
                if (
                    error instanceof GoogleOAuthClientError &&
                    error.body?.error === 'invalid_token'
                ) {
                    return 'already_invalid';
                }
                throw error;
            }
        }
    };
}
