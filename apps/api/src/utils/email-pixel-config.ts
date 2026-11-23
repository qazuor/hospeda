/**
 * @file email-pixel-config.ts
 * @description Boot-time check of the email open-pixel origin (HOS-2359 §6.A.1).
 */

/** Minimal logger the check needs. */
interface WarnLogger {
    warn: (value: unknown, label?: string) => void;
}

/**
 * Returns the Umami URL to hand to `configureEmailAssets({ pixelBaseUrl })` and, in
 * production, warns once when it is set but not `https:`: `@repo/email` then renders
 * no pixel (a mail client cannot reach an internal `http://` URL), so opens would
 * silently stop being counted.
 *
 * @param input - `HOSPEDA_UMAMI_URL`, `NODE_ENV` and a logger
 * @returns The Umami URL, unchanged
 */
export function checkEmailPixelBaseUrl(input: {
    readonly umamiUrl: string | undefined;
    readonly nodeEnv: string | undefined;
    readonly logger: WarnLogger;
}): string | undefined {
    const { umamiUrl, nodeEnv, logger } = input;
    if (nodeEnv === 'production' && umamiUrl && !umamiUrl.trim().startsWith('https:')) {
        logger.warn(
            { umamiUrl },
            'HOSPEDA_UMAMI_URL is not https: emails render no open pixel (HOS-2359)'
        );
    }
    return umamiUrl;
}
