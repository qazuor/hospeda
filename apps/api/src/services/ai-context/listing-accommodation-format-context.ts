import type { IaDataEntry, NameOnlyEntity } from '../accommodation-ai-context.js';
import { sanitizeOwnerDelimiters, truncateAtWord } from './owner-data-fence.js';

/** Hard cap on each IA data entry's title (HOS-2095 review: was unbounded). */
const CONTEXT_IADATA_TITLE_MAX_CHARS = 120;
/** Hard cap on each IA data entry's content length in the context block. */
export const CONTEXT_IADATA_CONTENT_MAX_CHARS = 500;

/**
 * Orders amenity/feature rows so a cap keeps the most relevant ones (HOS-2095):
 * featured entries first, then higher `displayWeight`, preserving the input
 * order among ties. These are the catalog's own curation signals, the same ones
 * the public pages sort by — no relevance list is invented here.
 *
 * @param entries - The rows as loaded.
 * @returns A new, sorted array (the input is not mutated).
 */
export function prioritizeCatalogEntries(
    entries: ReadonlyArray<NameOnlyEntity>
): ReadonlyArray<NameOnlyEntity> {
    return entries
        .map((entry, index) => ({ entry, index }))
        .sort((a, b) => {
            const featured =
                Number(b.entry.isFeatured ?? false) - Number(a.entry.isFeatured ?? false);
            if (featured !== 0) return featured;
            const weight = (b.entry.displayWeight ?? 50) - (a.entry.displayWeight ?? 50);
            return weight === 0 ? a.index - b.index : weight;
        })
        .map(({ entry }) => entry);
}

/**
 * Renders one IA data entry's title and content exactly as the Información
 * Especial block prints them (sanitized, then cut at a word). Shared by the
 * render loop and the pets-absent scan (HOS-2102) so the two cannot drift:
 * the scan must read the text the model sees, not a near-copy of it.
 */
export function renderIaDataTexts(entry: IaDataEntry): [string, string] {
    return [
        truncateAtWord(sanitizeOwnerDelimiters(entry.title), CONTEXT_IADATA_TITLE_MAX_CHARS),
        truncateAtWord(sanitizeOwnerDelimiters(entry.content), CONTEXT_IADATA_CONTENT_MAX_CHARS)
    ];
}

/**
 * Groups IA data entries by category, preserving insertion order.
 * Entries with no category are grouped under "Otros" at the end.
 */
export function groupIaDataByCategory(
    entries: ReadonlyArray<IaDataEntry>
): Map<string, IaDataEntry[]> {
    const grouped = new Map<string, IaDataEntry[]>();
    const uncategorized: IaDataEntry[] = [];

    for (const entry of entries) {
        const cat = entry.category?.trim();
        if (!cat) {
            uncategorized.push(entry);
            continue;
        }
        const existing = grouped.get(cat);
        if (existing) {
            existing.push(entry);
        } else {
            grouped.set(cat, [entry]);
        }
    }

    if (uncategorized.length > 0) {
        grouped.set('Otros', uncategorized);
    }

    return grouped;
}
