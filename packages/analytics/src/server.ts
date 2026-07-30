import type { AnalyticsEventName, AnalyticsEventProperties } from './catalog.js';
import {
    type AnalyticsGlobalProperties,
    prepareAnalyticsEvent,
    validateDistinctId
} from './shared.js';

export interface ServerAnalyticsClient {
    capture(input: {
        distinctId: string;
        event: string;
        properties?: Record<string, unknown>;
    }): void;
}

export function createServerAnalytics(options: {
    enabled: boolean;
    getClient: () => ServerAnalyticsClient | null | undefined;
    getGlobalProperties?: () => AnalyticsGlobalProperties;
    onError?: (error: unknown, context: Record<string, unknown>) => void;
}) {
    return {
        capture<TName extends AnalyticsEventName>(input: {
            distinctId: string;
            name: TName;
            properties: AnalyticsEventProperties<TName>;
        }): void {
            try {
                const client = options.getClient();
                if (!options.enabled || !client) {
                    return;
                }

                client.capture({
                    distinctId: validateDistinctId(input.distinctId),
                    event: input.name,
                    properties: prepareAnalyticsEvent({
                        name: input.name,
                        properties: input.properties,
                        ...(options.getGlobalProperties
                            ? { globalProperties: options.getGlobalProperties() }
                            : {})
                    })
                });
            } catch (error) {
                options.onError?.(error, { distinctId: input.distinctId, name: input.name });
            }
        }
    };
}
