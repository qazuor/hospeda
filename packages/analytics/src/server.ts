import type { AnalyticsEventName, AnalyticsEventProperties } from './catalog.js';
import {
    type AnalyticsGlobalProperties,
    type AnalyticsVisitor,
    prepareAnalyticsEvent,
    sanitizeAnalyticsVisitor,
    validateDistinctId
} from './shared.js';

export interface ServerAnalyticsClient {
    capture(input: {
        distinctId: string;
        event: string;
        properties?: Record<string, unknown>;
        uuid?: string;
        timestamp?: Date;
        /**
         * Visitor IP and User-Agent for session attribution. Never sent as event
         * properties. Providers that do not attribute sessions ignore it.
         */
        visitor?: AnalyticsVisitor;
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
            uuid?: string;
            timestamp?: Date;
            /** Optional visitor identity; an invalid one is dropped, not fatal. */
            visitor?: AnalyticsVisitor;
        }): void {
            try {
                const client = options.getClient();
                if (!options.enabled || !client) {
                    return;
                }

                const visitor = sanitizeAnalyticsVisitor(input.visitor);
                client.capture({
                    distinctId: validateDistinctId(input.distinctId),
                    event: input.name,
                    properties: prepareAnalyticsEvent({
                        name: input.name,
                        properties: input.properties,
                        ...(options.getGlobalProperties
                            ? { globalProperties: options.getGlobalProperties() }
                            : {})
                    }),
                    ...(input.uuid === undefined ? {} : { uuid: input.uuid }),
                    ...(input.timestamp === undefined ? {} : { timestamp: input.timestamp }),
                    ...(visitor === undefined ? {} : { visitor })
                });
            } catch (error) {
                options.onError?.(error, { distinctId: input.distinctId, name: input.name });
            }
        }
    };
}
