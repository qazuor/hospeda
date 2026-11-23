import { type UtmParams, UtmParamsSchema } from './vocabulary.js';

/**
 * Thrown by {@link withUtm} when the UTM combination is outside the closed vocabulary.
 * It is a programming error (a call site passing a value the vocabulary does not
 * allow), so tests catch it; it is never expected at runtime.
 */
export class InvalidUtmParamsError extends Error {
    /** The Zod issues that rejected the combination. */
    readonly issues: readonly string[];

    constructor({ issues }: { readonly issues: readonly string[] }) {
        super(`Invalid UTM parameters: ${issues.join('; ')}`);
        this.name = 'InvalidUtmParamsError';
        this.issues = issues;
    }
}

/** Input of {@link withUtm}: the URL plus one valid UTM combination. */
export type WithUtmInput = { readonly url: string } & UtmParams;

const RELATIVE_BASE = 'http://relative.invalid';

/**
 * Returns `url` with `utm_source`, `utm_medium`, `utm_campaign` and (when given)
 * `utm_content` appended, in that order.
 *
 * - The combination is validated against the closed vocabulary first; an invalid one
 *   throws {@link InvalidUtmParamsError}.
 * - A URL that already carries ANY `utm_*` param is returned unchanged, so an
 *   operator-set or upstream campaign is never overwritten (AC-8).
 * - Existing params keep their exact original encoding, and the hash is preserved.
 * - A base-relative URL (`/es/x/`) is accepted and returned relative.
 *
 * @param input - URL and UTM combination
 * @returns The decorated URL
 * @throws InvalidUtmParamsError when the combination is not in the vocabulary
 */
export function withUtm(input: WithUtmInput): string {
    const { url, ...params } = input;
    const parsed = UtmParamsSchema.safeParse(params);
    if (!parsed.success) {
        throw new InvalidUtmParamsError({
            issues: parsed.error.issues.map(
                (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
            )
        });
    }

    const hashIndex = url.indexOf('#');
    const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : url.slice(hashIndex);

    const existing = new URL(beforeHash, RELATIVE_BASE).searchParams;
    for (const name of existing.keys()) {
        if (name.toLowerCase().startsWith('utm_')) {
            return url;
        }
    }

    const value = parsed.data;
    const pairs: [string, string][] = [
        ['utm_source', value.source],
        ['utm_medium', value.medium],
        ['utm_campaign', value.campaign]
    ];
    if ('content' in value && value.content !== undefined) {
        pairs.push(['utm_content', value.content]);
    }
    const appended = pairs.map(([name, v]) => `${name}=${encodeURIComponent(v)}`).join('&');

    const queryIndex = beforeHash.indexOf('?');
    let separator = '?';
    if (queryIndex !== -1) {
        separator = queryIndex === beforeHash.length - 1 || beforeHash.endsWith('&') ? '' : '&';
    }
    return `${beforeHash}${separator}${appended}${hash}`;
}
