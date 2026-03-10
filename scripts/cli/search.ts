// fuse.js uses default export - documented exception to named-exports-only policy
import Fuse from 'fuse.js';
import type { IFuseOptions } from 'fuse.js';

import type { CliCommand } from './types.js';

/**
 * Fuse.js configuration for fuzzy-searching CLI commands.
 *
 * Weights prioritize command ID (0.5) over description (0.3) and source (0.2).
 * A threshold of 0.3 keeps results relevant without being too strict.
 */
export const FUSE_OPTIONS: IFuseOptions<CliCommand> = {
    keys: [
        { name: 'id', weight: 0.5 },
        { name: 'description', weight: 0.3 },
        { name: 'source', weight: 0.2 }
    ],
    threshold: 0.3,
    distance: 200,
    ignoreLocation: true,
    ignoreDiacritics: true,
    includeScore: true,
    minMatchCharLength: 2
};

/**
 * Creates a Fuse.js search index from an array of CLI commands.
 *
 * The returned instance is ready to use with {@link searchCommands}.
 * Rebuild the index whenever the command registry changes.
 *
 * @param input - Object containing the commands to index
 * @returns A configured Fuse instance for fuzzy searching
 *
 * @example
 * ```ts
 * const fuse = createSearchIndex({ commands: registry });
 * const results = searchCommands({ fuse, query: 'db start' });
 * ```
 */
export function createSearchIndex({
    commands
}: { commands: readonly CliCommand[] }): Fuse<CliCommand> {
    return new Fuse(commands as CliCommand[], FUSE_OPTIONS);
}

/**
 * Searches the command index with a fuzzy query and returns matching commands.
 *
 * Results are returned in ascending score order (lower score = better match).
 * An empty query (or one consisting only of whitespace) returns an empty array
 * so callers can distinguish "no input" from "no matches". Queries exceeding
 * 200 characters are also rejected and return an empty array to guard against
 * excessively long inputs.
 *
 * @param input - Object containing the Fuse index and the search query
 * @returns Matching {@link CliCommand} objects sorted by relevance
 *
 * @example
 * ```ts
 * const results = searchCommands({ fuse, query: 'test watch' });
 * // results[0] is the best match
 * ```
 */
export function searchCommands({
    fuse,
    query
}: {
    fuse: Fuse<CliCommand>;
    query: string;
}): CliCommand[] {
    if (query.trim().length === 0 || query.length > 200) {
        return [];
    }

    return fuse
        .search(query)
        .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
        .map((result) => result.item);
}
