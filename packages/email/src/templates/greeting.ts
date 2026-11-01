/**
 * Resolves the text of the opening greeting for a transactional mail.
 *
 * A greeting that echoes the recipient's raw email address ("Hola a@b.com,")
 * reads as machine-generated and is a spam signal, so anything that is empty
 * or looks like an email address falls back to a generic "Hola,".
 *
 * @param input - Object with the optional display name
 * @returns Object with the greeting text, e.g. `Hola Juan,` or `Hola,`
 */
export function resolveGreeting({ name }: { readonly name?: string | null }): {
    readonly text: string;
} {
    const trimmed = name?.trim() ?? '';
    if (trimmed.length === 0 || trimmed.includes('@')) {
        return { text: 'Hola,' };
    }
    return { text: `Hola ${trimmed},` };
}
