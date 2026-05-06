/**
 * @file extract-toc.ts
 * @description Extracts table-of-contents headings from sanitized HTML.
 * Only h2/h3 elements with an `id` attribute are included.
 * Used by the post detail page to build the PostTableOfContents sidebar.
 */

/** A single heading entry for the table of contents. */
export interface TocHeading {
    readonly level: 2 | 3;
    readonly text: string;
    readonly id: string;
}

/** Parameters for {@link extractToc}. */
interface ExtractTocParams {
    /** Sanitized HTML string (output of sanitizeHtml). */
    readonly html: string;
}

/** HTML entity decode map for common entities found in heading text. */
const ENTITY_MAP: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' '
};

/**
 * Decodes common HTML entities in a plain-text string.
 */
function decodeEntities(text: string): string {
    return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => ENTITY_MAP[entity] ?? entity);
}

/**
 * Parses `html` and returns an ordered list of h2/h3 headings that carry an `id`.
 *
 * The sanitizer guarantees that heading `id` values are slug-safe ASCII strings
 * so they can be used directly in `<a href="#id">` links.
 *
 * Headings without an `id` attribute are silently skipped.
 * h1, h4, h5, h6 headings are ignored.
 *
 * @param params - Object with the sanitized HTML string.
 * @returns Ordered array of TOC heading entries.
 *
 * @example
 * ```ts
 * const toc = extractToc({ html: '<h2 id="intro">Intro</h2><h3 id="sub">Sub</h3>' });
 * // [{ level: 2, text: 'Intro', id: 'intro' }, { level: 3, text: 'Sub', id: 'sub' }]
 * ```
 */
export function extractToc({ html }: ExtractTocParams): TocHeading[] {
    if (!html) return [];

    const results: TocHeading[] = [];

    // Match <h2 ...> or <h3 ...> with any attributes, capturing the id.
    // We allow attributes in any order before/after id.
    const headingPattern = /<h([23])\s[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi;

    let match: RegExpExecArray | null = headingPattern.exec(html);
    while (match !== null) {
        const level = Number(match[1]) as 2 | 3;
        const id = match[2];
        const rawText = match[3];

        // Strip any remaining HTML tags inside the heading text, then decode entities
        const text = decodeEntities(rawText.replace(/<[^>]+>/g, '').trim());

        if (id && text) {
            results.push({ level, text, id });
        }

        match = headingPattern.exec(html);
    }

    return results;
}
