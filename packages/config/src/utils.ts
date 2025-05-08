export const getBooleanOrUndefined = (value: string | undefined) => {
    return value === 'true' ? true : value === 'false' ? false : undefined;
};
