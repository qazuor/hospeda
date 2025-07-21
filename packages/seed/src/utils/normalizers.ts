/**
 * Creates a field mapper normalizer that maps JSON fields to service input fields
 */
export const createFieldMapper = (fieldMappings: Record<string, string>) => {
    return (data: Record<string, unknown>) => {
        const result: Record<string, unknown> = {};
        for (const [outputField, inputField] of Object.entries(fieldMappings)) {
            result[outputField] = data[inputField];
        }
        return result;
    };
};

/**
 * Creates a normalizer that excludes specified fields
 */
export const createExcludingNormalizer = (excludeFields: string[]) => {
    return (data: Record<string, unknown>) => {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
            if (!excludeFields.includes(key)) {
                result[key] = value;
            }
        }
        return result;
    };
};

/**
 * Creates a normalizer that includes only specified fields
 */
export const createIncludingNormalizer = (includeFields: string[]) => {
    return (data: Record<string, unknown>) => {
        const result: Record<string, unknown> = {};
        for (const field of includeFields) {
            if (data[field] !== undefined) {
                result[field] = data[field];
            }
        }
        return result;
    };
};

/**
 * Creates a normalizer that transforms date strings to Date objects
 */
export const createDateTransformer = (dateFields: string[]) => {
    return (data: Record<string, unknown>) => {
        const result: Record<string, unknown> = { ...data };
        for (const field of dateFields) {
            if (result[field] && typeof result[field] === 'string') {
                result[field] = new Date(result[field] as string);
            }
        }
        return result;
    };
};

/**
 * Creates a normalizer that combines multiple normalizers
 */
export const createCombinedNormalizer = (
    ...normalizers: Array<(data: Record<string, unknown>) => Record<string, unknown>>
) => {
    return (data: Record<string, unknown>) => {
        let result = data;
        for (const normalizer of normalizers) {
            result = normalizer(result);
        }
        return result;
    };
};
