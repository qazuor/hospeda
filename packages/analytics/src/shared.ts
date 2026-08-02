import { z } from 'zod';
import {
    type AnalyticsEventName,
    type AnalyticsEventProperties,
    AnalyticsEventSchemas
} from './catalog.js';

const FORBIDDEN_PROPERTY_KEY_REGEX =
    /(^|_)(email|phone|tel|message|password|token|secret|address|full_name|guest_name|guest_email|guest_phone|card)(_|$)/i;

const FORBIDDEN_DISTINCT_ID_VALUES = new Set([
    '0',
    'anonymous',
    'distinct_id',
    'distinctid',
    'email',
    'false',
    'guest',
    'id',
    'nan',
    'none',
    'not_authenticated',
    'null',
    'true',
    'undefined',
    '[object object]'
]);

export const AnalyticsAppSchema = z.enum(['web', 'admin', 'api']);
export type AnalyticsApp = z.infer<typeof AnalyticsAppSchema>;

export const AnalyticsEnvironmentSchema = z.enum([
    'development',
    'test',
    'preview',
    'staging',
    'production'
]);
export type AnalyticsEnvironment = z.infer<typeof AnalyticsEnvironmentSchema>;

export const AnalyticsGlobalPropertiesSchema = z.object({
    app: AnalyticsAppSchema,
    app_version: z.string().min(1).optional(),
    environment: AnalyticsEnvironmentSchema,
    locale: z.string().min(2).max(8).optional(),
    plan: z.string().min(1).optional(),
    role: z.string().min(1).optional(),
    roles: z.array(z.string().min(1)).optional(),
    user_type: z.string().min(1).optional()
});

export type AnalyticsGlobalProperties = z.infer<typeof AnalyticsGlobalPropertiesSchema>;

export const AnalyticsPersonPropertiesSchema = z.object({
    account_status: z.string().min(1).optional(),
    accommodation_count: z.number().int().nonnegative().optional(),
    created_at: z.string().min(1).optional(),
    emailDomain: z.string().min(1).optional(),
    has_published_accommodation: z.boolean().optional(),
    is_commerce_owner: z.boolean().optional(),
    is_host: z.boolean().optional(),
    is_staff: z.boolean().optional(),
    last_checkout_outcome: z.string().min(1).optional(),
    last_conversion_interval: z.enum(['monthly', 'annual']).nullable().optional(),
    locale: z.string().min(2).max(8).optional(),
    plan: z.string().min(1).optional(),
    plan_status: z.string().min(1).optional(),
    preferred_language: z.string().min(2).max(8).optional(),
    role: z.string().min(1).optional(),
    roles: z.array(z.string().min(1)).optional(),
    user_type: z.string().min(1).optional(),
    converted_from_trial: z.boolean().optional()
});

export type AnalyticsPersonProperties = z.infer<typeof AnalyticsPersonPropertiesSchema>;

type Primitive = boolean | null | number | string;
type AnalyticsValue = Primitive | readonly Primitive[] | Record<string, Primitive | undefined>;

type AnalyticsPropertiesRecord = Record<string, AnalyticsValue | undefined>;

function sanitizeObject(
    input: AnalyticsPropertiesRecord
): Record<string, Primitive | readonly Primitive[] | Record<string, Primitive>> {
    const output: Record<string, Primitive | readonly Primitive[] | Record<string, Primitive>> = {};

    for (const [key, value] of Object.entries(input)) {
        if (value === undefined) continue;
        if (FORBIDDEN_PROPERTY_KEY_REGEX.test(key)) {
            throw new Error(`Forbidden analytics property key: ${key}`);
        }
        if (Array.isArray(value)) {
            output[key] = value.filter((entry): entry is Primitive => entry !== undefined);
            continue;
        }
        if (value !== null && typeof value === 'object') {
            const nested: Record<string, Primitive> = {};
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
                if (nestedValue === undefined) continue;
                if (FORBIDDEN_PROPERTY_KEY_REGEX.test(nestedKey)) {
                    throw new Error(`Forbidden analytics property key: ${nestedKey}`);
                }
                nested[nestedKey] = nestedValue;
            }
            output[key] = nested;
            continue;
        }
        output[key] = value;
    }

    return output;
}

export function buildAnalyticsGlobalProperties(
    input: AnalyticsGlobalProperties
): Record<string, Primitive | readonly Primitive[] | Record<string, Primitive>> {
    return sanitizeObject(AnalyticsGlobalPropertiesSchema.parse(input));
}

export function buildAnalyticsPersonProperties(
    input: AnalyticsPersonProperties
): Record<string, Primitive | readonly Primitive[] | Record<string, Primitive>> {
    return sanitizeObject(AnalyticsPersonPropertiesSchema.parse(input));
}

export function validateDistinctId(distinctId: string): string {
    const parsed = z.string().min(1).trim().parse(distinctId);
    if (FORBIDDEN_DISTINCT_ID_VALUES.has(parsed.toLowerCase())) {
        throw new Error(`Forbidden analytics distinct_id: ${parsed}`);
    }
    return parsed;
}

export function prepareAnalyticsEvent<TName extends AnalyticsEventName>(input: {
    name: TName;
    properties: AnalyticsEventProperties<TName>;
    globalProperties?: AnalyticsGlobalProperties;
}): Record<string, Primitive | readonly Primitive[] | Record<string, Primitive>> {
    const rawEventProperties = sanitizeObject(input.properties as AnalyticsPropertiesRecord);
    const eventProperties = sanitizeObject(
        AnalyticsEventSchemas[input.name].parse(rawEventProperties) as AnalyticsPropertiesRecord
    );

    if (!input.globalProperties) {
        return eventProperties;
    }

    return {
        ...buildAnalyticsGlobalProperties(input.globalProperties),
        ...eventProperties
    };
}
