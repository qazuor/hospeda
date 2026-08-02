import type { AnalyticsEventName, AnalyticsEventProperties } from './catalog.js';
import {
    type AnalyticsGlobalProperties,
    type AnalyticsPersonProperties,
    buildAnalyticsGlobalProperties,
    buildAnalyticsPersonProperties,
    prepareAnalyticsEvent,
    validateDistinctId
} from './shared.js';

export interface BrowserAnalyticsClient {
    capture(name: string, properties?: Record<string, unknown>): void;
    group?(groupType: string, groupKey: string, groupProperties?: Record<string, unknown>): void;
    identify?(distinctId: string, properties?: Record<string, unknown>): void;
    register?(properties: Record<string, unknown>): void;
    reset(resetDeviceId?: boolean): void;
    resetGroups?(): void;
    setPersonProperties?(properties: Record<string, unknown>): void;
}

export interface BrowserAnalyticsDiagnostics {
    message: string;
    payload?: Record<string, unknown>;
}

export interface CreateBrowserAnalyticsOptions {
    debug?: boolean;
    enabled: boolean;
    getClient: () => BrowserAnalyticsClient | undefined;
    getGlobalProperties?: () => AnalyticsGlobalProperties;
    onDiagnostic?: (diagnostic: BrowserAnalyticsDiagnostics) => void;
}

function emitDiagnostic(
    options: CreateBrowserAnalyticsOptions,
    message: string,
    payload?: Record<string, unknown>
): void {
    if (!options.debug) return;
    options.onDiagnostic?.({ message, payload });
}

export function createBrowserAnalytics(options: CreateBrowserAnalyticsOptions) {
    return {
        capture<TName extends AnalyticsEventName>(
            name: TName,
            properties: AnalyticsEventProperties<TName>
        ): void {
            try {
                const client = options.getClient();
                const payload = prepareAnalyticsEvent({
                    name,
                    properties,
                    ...(options.getGlobalProperties
                        ? { globalProperties: options.getGlobalProperties() }
                        : {})
                });

                if (!options.enabled || !client) {
                    emitDiagnostic(options, 'analytics capture skipped', { name, payload });
                    return;
                }

                client.capture(name, payload);
            } catch (error) {
                emitDiagnostic(options, 'analytics capture rejected', {
                    name,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        },
        group(
            groupType: string,
            groupKey: string,
            groupProperties?: Record<string, unknown>
        ): void {
            const client = options.getClient();
            if (!options.enabled || !client?.group) {
                emitDiagnostic(options, 'analytics group skipped', {
                    groupType,
                    groupKey,
                    groupProperties
                });
                return;
            }
            client.group(groupType, groupKey, groupProperties);
        },
        identify(distinctId: string, properties?: AnalyticsPersonProperties): void {
            try {
                const client = options.getClient();
                const payload = properties ? buildAnalyticsPersonProperties(properties) : undefined;
                const safeDistinctId = validateDistinctId(distinctId);

                if (!options.enabled || !client?.identify) {
                    emitDiagnostic(options, 'analytics identify skipped', {
                        distinctId: safeDistinctId,
                        properties: payload
                    });
                    return;
                }

                client.identify(safeDistinctId, payload);
            } catch (error) {
                emitDiagnostic(options, 'analytics identify rejected', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        },
        registerGlobalProperties(): void {
            try {
                const client = options.getClient();
                if (!options.enabled || !client?.register || !options.getGlobalProperties) {
                    return;
                }
                client.register(buildAnalyticsGlobalProperties(options.getGlobalProperties()));
            } catch (error) {
                emitDiagnostic(options, 'analytics register rejected', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        },
        reset(): void {
            const client = options.getClient();
            if (!client) return;
            client.reset();
        },
        resetGroups(): void {
            const client = options.getClient();
            client?.resetGroups?.();
        },
        setPersonProperties(properties: AnalyticsPersonProperties): void {
            try {
                const client = options.getClient();
                const payload = buildAnalyticsPersonProperties(properties);

                if (!options.enabled || !client?.setPersonProperties) {
                    emitDiagnostic(options, 'analytics setPersonProperties skipped', {
                        properties: payload
                    });
                    return;
                }

                client.setPersonProperties(payload);
            } catch (error) {
                emitDiagnostic(options, 'analytics setPersonProperties rejected', {
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    };
}
