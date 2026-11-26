function normalize(value?: string | null): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[\p{P}\s]+/gu, ' ')
        .trim();
}

/** Whether the first text is equal to or a whole-word prefix of the second. */
export function isRedundantText({
    a,
    b
}: {
    readonly a?: string | null;
    readonly b?: string | null;
}): boolean {
    const first = normalize(a);
    const second = normalize(b);
    return first !== '' && (first === second || second.startsWith(`${first} `));
}
