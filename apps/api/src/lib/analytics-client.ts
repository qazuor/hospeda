/**
 * Analytics server client backed by self-hosted Umami (HOS-2119, T-021).
 *
 * Replaces `lib/posthog.ts` (removed in T-059). Same shape: a lazily-initialised
 * singleton, a typed capture wrapper that runs catalog validation + PII filtering
 * (`createServerAnalytics`), and an idempotent shutdown that flushes within a 3 s
 * budget. Direct cut, no fan-out (spec OQ-2).
 *
 * ## Surface selection
 *
 * Umami has one website per surface. Every capture may carry an explicit
 * `surface` (`'web'` default, or `'admin'`):
 * - `web`: website id `HOSPEDA_UMAMI_WEBSITE_ID_WEB`, hostname from `HOSPEDA_SITE_URL`.
 * - `admin`: website id `HOSPEDA_UMAMI_WEBSITE_ID_ADMIN`, hostname from `HOSPEDA_ADMIN_URL`.
 *   When no admin website id is configured the event falls back to the web surface.
 *
 * Each effective surface owns one lazy client; the client is `null` (analytics
 * disabled, same as posthog.ts) when `HOSPEDA_UMAMI_URL` or the website id is unset.
 *
 * @module lib/analytics-client
 */

import type {
    AnalyticsEventName,
    AnalyticsEventProperties,
    AnalyticsVisitor,
    UmamiServerClient,
    UmamiServerLogger
} from '@repo/analytics';
import { createServerAnalytics, createUmamiServerClient } from '@repo/analytics';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';

/** Surfaces an event can describe. */
export type AnalyticsSurface = 'web' | 'admin';

/** Timeout in ms for the shutdown flush call. */
const SHUTDOWN_FLUSH_TIMEOUT_MS = 3_000;

/** Per-surface client state: absent = not initialised, null = disabled. */
const _clients = new Map<AnalyticsSurface, UmamiServerClient | null>();
/** Set once {@link shutdownAnalytics} ran; clients are no longer (re)created. */
let _shutDown = false;

function resolveServerEnvironment(): 'development' | 'test' | 'preview' | 'staging' | 'production' {
    if (env.NODE_ENV === 'test') return 'test';
    if (env.NODE_ENV === 'development') return 'development';
    if (env.HOSPEDA_API_URL.includes('staging')) return 'staging';
    if (env.HOSPEDA_API_URL.includes('preview')) return 'preview';
    return 'production';
}

/** Adapts the api logger (context-first signature) to the Umami client logger. */
const umamiLogger: UmamiServerLogger = {
    warn: (message, context) => apiLogger.warn(context ?? {}, message),
    error: (message, context) => apiLogger.error(context ?? {}, message)
};

/**
 * Resolves the effective surface: `admin` only when requested AND an admin website
 * id is configured, otherwise `web`.
 */
function resolveEffectiveSurface(surface: AnalyticsSurface): AnalyticsSurface {
    return surface === 'admin' && env.HOSPEDA_UMAMI_WEBSITE_ID_ADMIN ? 'admin' : 'web';
}

function resolveHostname(surface: AnalyticsSurface): string {
    const siteUrl = surface === 'admin' ? env.HOSPEDA_ADMIN_URL : env.HOSPEDA_SITE_URL;
    return new URL(siteUrl).hostname;
}

/**
 * Returns the lazy Umami server client for a surface, or `null` when analytics are
 * disabled (`HOSPEDA_UMAMI_URL` or the surface website id unset) or after shutdown.
 *
 * @param input - Optional `surface` (default `'web'`; `'admin'` falls back to web
 *   when no admin website id is configured).
 * @returns The Umami client, or `null` when disabled.
 *
 * @example
 * ```ts
 * const umami = getAnalyticsClient({ surface: 'admin' });
 * ```
 */
export function getAnalyticsClient(
    input: { readonly surface?: AnalyticsSurface } = {}
): UmamiServerClient | null {
    const surface = resolveEffectiveSurface(input.surface ?? 'web');
    if (_clients.has(surface)) return _clients.get(surface) ?? null;
    if (_shutDown) return null;

    const websiteId =
        surface === 'admin' ? env.HOSPEDA_UMAMI_WEBSITE_ID_ADMIN : env.HOSPEDA_UMAMI_WEBSITE_ID_WEB;
    if (!env.HOSPEDA_UMAMI_URL || !websiteId) {
        apiLogger.debug('Umami: URL or website id not set — server analytics disabled');
        _clients.set(surface, null);
        return null;
    }

    try {
        const client = createUmamiServerClient({
            url: env.HOSPEDA_UMAMI_URL,
            websiteId,
            hostname: resolveHostname(surface),
            logger: umamiLogger
        });
        _clients.set(surface, client);
        apiLogger.info({ surface }, 'Umami: server-side analytics client initialised');
        return client;
    } catch (error) {
        apiLogger.warn(
            { error: error instanceof Error ? error.message : String(error) },
            'Umami: failed to initialise client — server analytics disabled'
        );
        _clients.set(surface, null);
        return null;
    }
}

/**
 * Per-surface validating wrappers. The `getClient` indirection is resolved at
 * capture time, so the env is read lazily.
 */
const serverAnalyticsBySurface: Record<
    AnalyticsSurface,
    ReturnType<typeof createServerAnalytics>
> = {
    web: buildServerAnalytics('web'),
    admin: buildServerAnalytics('admin')
};

function buildServerAnalytics(surface: AnalyticsSurface) {
    return createServerAnalytics({
        enabled: true,
        getClient: () => getAnalyticsClient({ surface }),
        getGlobalProperties: () => ({
            app: 'api',
            environment: resolveServerEnvironment()
        }),
        onError: (error, context) => {
            apiLogger.warn(
                {
                    ...context,
                    error: error instanceof Error ? error.message : String(error)
                },
                'Analytics capture rejected (non-blocking)'
            );
        }
    });
}

/**
 * Captures a catalog-validated, PII-filtered server event. Never throws.
 *
 * @param input - `distinctId`, catalog event `name` and `properties`, optional
 *   `uuid`/`timestamp`, optional `visitor` (IP + User-Agent, forwarded for session
 *   attribution only, never part of the properties) and optional `surface`
 *   (default `'web'`).
 *
 * @example
 * ```ts
 * captureServerAnalyticsEvent({
 *   distinctId: user.id,
 *   name: 'ai_feature_used',
 *   properties: { feature: 'text_improve', provider: null }
 * });
 * ```
 */
export function captureServerAnalyticsEvent<TName extends AnalyticsEventName>(input: {
    distinctId: string;
    name: TName;
    properties: AnalyticsEventProperties<TName>;
    uuid?: string;
    timestamp?: Date;
    visitor?: AnalyticsVisitor;
    surface?: AnalyticsSurface;
}): void {
    const { surface, ...rest } = input;
    serverAnalyticsBySurface[surface ?? 'web'].capture(rest);
}

/**
 * Returns `true` when the web-surface Umami client is configured and live.
 * Reflects the web surface ONLY: an unset admin website id falls back to web, but a
 * missing web website id disables analytics here even if the admin one is set.
 *
 * @returns Whether server analytics are enabled.
 */
export function isAnalyticsEnabled(): boolean {
    return getAnalyticsClient() !== null;
}

/**
 * Flushes pending events and shuts down every Umami client within a 3 s budget.
 * Idempotent: subsequent calls are no-ops. Never rejects.
 *
 * @returns Promise resolving when the flush is complete.
 */
export async function shutdownAnalytics(): Promise<void> {
    if (_shutDown) return;
    _shutDown = true;

    // `_clients` is keyed by the EFFECTIVE surface (admin falls back to the web key
    // before lookup), so one instance is never stored under two keys: no dedupe needed.
    const clients = [..._clients.values()].filter(
        (client): client is UmamiServerClient => client !== null
    );
    _clients.clear();

    await Promise.all(
        clients.map(async (client) => {
            try {
                await client.shutdown({ timeoutMs: SHUTDOWN_FLUSH_TIMEOUT_MS });
                apiLogger.debug('Umami: client shut down, pending events flushed');
            } catch (error) {
                apiLogger.warn(
                    { error: error instanceof Error ? error.message : String(error) },
                    'Umami: error during shutdown flush (events may be lost)'
                );
            }
        })
    );
}

/**
 * Resets the singleton state. FOR TESTING ONLY.
 *
 * @internal
 */
export function _resetAnalyticsClientForTests(): void {
    _clients.clear();
    _shutDown = false;
}
