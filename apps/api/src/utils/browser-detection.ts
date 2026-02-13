/**
 * Detects the browser from the user agent string.
 * Returns a Linear label name like `browser:chrome`.
 */
export function detectBrowser({ userAgent }: { userAgent: string }): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('edg/')) return 'browser:edge';
    if (ua.includes('chrome') || ua.includes('chromium')) return 'browser:chrome';
    if (ua.includes('firefox')) return 'browser:firefox';
    if (ua.includes('safari')) return 'browser:safari';
    return 'browser:other';
}

/**
 * Detects the platform from the user agent and screen resolution.
 * Returns a Linear label name like `platform:web-desktop`.
 */
export function detectPlatform({
    userAgent,
    screenResolution
}: {
    userAgent: string;
    screenResolution: string;
}): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('android')) return 'platform:android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'platform:ios';
    const width = Number.parseInt(screenResolution.split('x')[0] ?? '0', 10);
    if (width <= 768) return 'platform:web-mobile';
    return 'platform:web-desktop';
}
