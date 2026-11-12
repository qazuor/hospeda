import { getLocalDateString } from '@repo/utils';
import { formatDate } from '../../templates/utils/index.js';

/** Parses and formats the optional scheduled change in a grace notice payload. */
export function parseGraceScheduledChange(input: {
    readonly value: unknown;
    readonly errorMessage: string;
}): { readonly planName: string; readonly effectiveDate: string } | undefined {
    if (input.value === undefined) return undefined;
    const value: unknown = input.value;
    if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        !('planName' in value) ||
        typeof value.planName !== 'string' ||
        value.planName.trim() === '' ||
        !('effectiveAt' in value) ||
        typeof value.effectiveAt !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value.effectiveAt)
    )
        throw new TypeError(input.errorMessage);
    const instant = new Date(value.effectiveAt);
    if (!Number.isFinite(instant.getTime())) throw new TypeError(input.errorMessage);
    return {
        planName: value.planName,
        effectiveDate: formatDate({ dateString: getLocalDateString({ instant }) })
    };
}
