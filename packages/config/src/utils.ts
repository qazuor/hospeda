export const getBooleanOrUndefined = (value?: string): boolean | undefined => {
    if (value === undefined) {
        return undefined;
    }
    return value === 'true';
};
