/**
 * @file collect-template-quasis.ts
 * @description Walks an ESTree program and returns the COOKED quasis of every
 * template literal in it (HOS-807).
 *
 * Used on the compiled output of `.astro` components, where the markup lives in
 * `renderTemplate`\`…\`` literals. Cooked (not raw) values are what the tagged
 * template receives at runtime, i.e. what ends up in the HTML — `<\/script>` in
 * the source is `</script>` in the cooked value, a backtick is a backtick.
 *
 * The walk is structural (every object-valued key) instead of keyed by node
 * type, so it holds across parsers that add or rename non-standard fields.
 */

/** Minimal shape of an ESTree `TemplateElement`. */
interface TemplateElementLike {
    readonly value: { readonly cooked: string | null | undefined; readonly raw: string };
}

interface CollectTemplateQuasisArgs {
    /** The root node (usually a `Program`) produced by an ESTree parser. */
    readonly ast: unknown;
}

interface CollectTemplateQuasisResult {
    /** One entry per template literal: its cooked quasis in source order. */
    readonly templates: readonly (readonly string[])[];
}

/**
 * Collects the cooked quasis of every `TemplateLiteral` under `ast`.
 *
 * A quasi with a `null` cooked value (an invalid escape, only legal in a tagged
 * template) falls back to its raw text — it cannot contain a script body the
 * compiler emitted, and dropping it would shift the expression positions.
 *
 * @param args - ast: the parsed program.
 * @returns The quasis, grouped per template literal.
 */
export function collectTemplateQuasis({
    ast
}: CollectTemplateQuasisArgs): CollectTemplateQuasisResult {
    const templates: string[][] = [];
    const stack: unknown[] = [ast];

    while (stack.length > 0) {
        const node = stack.pop();
        if (node === null || typeof node !== 'object') {
            continue;
        }
        if (Array.isArray(node)) {
            for (const child of node) {
                stack.push(child);
            }
            continue;
        }

        const record = node as Record<string, unknown>;
        if (record.type === 'TemplateLiteral' && Array.isArray(record.quasis)) {
            templates.push(
                (record.quasis as TemplateElementLike[]).map(
                    (quasi) => quasi.value.cooked ?? quasi.value.raw
                )
            );
        }

        for (const [key, value] of Object.entries(record)) {
            if (key === 'quasis' || value === null || typeof value !== 'object') {
                continue;
            }
            stack.push(value);
        }
    }

    return { templates };
}
