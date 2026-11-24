/**
 * Spanish copy of the `details` lines of a provider watch alert (HOS-2580 §F).
 *
 * The lines come in English from `@repo/payments` (`battery/shape.ts` and
 * `battery/run-watch-battery.ts`), which logs and stores them as they are. They are
 * translated here, at render time, by a keyed map of their stable prefixes: the field path
 * and the types after the prefix are provider values and are copied verbatim. A line that
 * matches no key (a measurement error message, a future prefix) is shown raw.
 *
 * @module templates/billing/provider-watch-details
 */

/** Spanish text of each fixed line, keyed by the exact English line. */
const FIXED_LINES: Readonly<Record<string, string>> = {
    'no accepted baseline for this measurement: review and accept its shape':
        'Esta medición no tiene una forma aceptada: revisala y aceptala en el panel.'
};

/** Spanish prefix of each `<prefix>: <rest>` line, keyed by the English prefix. */
const PREFIXES: Readonly<Record<string, string>> = {
    removed: 'Campo eliminado',
    added: 'Campo nuevo',
    retyped: 'Cambió el tipo',
    collapsed: 'Pasó a venir vacío (null)',
    expanded: 'Dejó de venir vacío (null)',
    'new request': 'Pedido nuevo',
    'request no longer observed': 'Pedido que ya no se observa'
};

/**
 * Translates one detail line of a provider watch alert.
 *
 * @param input.line - The line as `@repo/payments` produced it
 * @returns The Spanish line, or the line unchanged when no key matches
 *
 * @example
 * ```ts
 * translateProviderWatchDetail({ line: 'removed: body.status (string)' });
 * // 'Campo eliminado: body.status (string)'
 * ```
 */
export function translateProviderWatchDetail(input: { readonly line: string }): string {
    const fixed = FIXED_LINES[input.line];
    if (fixed) return fixed;
    const separator = input.line.indexOf(': ');
    if (separator <= 0) return input.line;
    const prefix = input.line.slice(0, separator);
    const spanish = Object.hasOwn(PREFIXES, prefix) ? PREFIXES[prefix] : undefined;
    return spanish ? `${spanish}: ${input.line.slice(separator + 2)}` : input.line;
}
