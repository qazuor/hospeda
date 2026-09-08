import { type CatalogEntry, isUnpublished } from './catalog.ts';

/**
 * Renders every entry still awaiting the owner's review, in FULL (HOS-1214
 * D-3', AC-19).
 *
 * The review the owner asked for is "I only want to look and delete what I do
 * not want", and that only works if looking is free. A count ("3 entries
 * pending") sends the reviewer to open a file, find three objects among the
 * live ones, and read Spanish prose out of a TypeScript literal. So this
 * prints the text itself — id, audience, title, body — in the gate's own log,
 * next to the one command that removes them.
 *
 * @param input.entries - Every entry in the catalog, in declared order.
 * @returns The rendered listing, without a trailing newline.
 */
export function renderPendingEntries({
    entries
}: {
    readonly entries: readonly CatalogEntry[];
}): string {
    const pending = entries.filter((entry) => isUnpublished({ entry }));
    if (pending.length === 0) {
        return "No What's New entries are awaiting review — nothing carries publishedAt: 'on-promotion'.";
    }

    const lines: string[] = [
        `${pending.length} What's New entr${pending.length === 1 ? 'y is' : 'ies are'} awaiting your review.`,
        '',
        'They are INVISIBLE to users until this promotion merges and resolves their',
        'dates. Reviewing them is reading the text below and deciding what to keep.',
        ''
    ];

    pending.forEach((entry, index) => {
        lines.push('─'.repeat(72));
        lines.push(`${index + 1}. ${entry.id}${entry.highlight ? '   [highlight]' : ''}`);
        lines.push(`   Audience: ${entry.roles === null ? 'everyone' : entry.roles.join(', ')}`);
        lines.push(
            `   Written for: ${
                entry.originPrs.length === 0
                    ? '(no origin recorded)'
                    : entry.originPrs.map((number) => `#${number}`).join(', ')
            }`
        );
        lines.push('');
        lines.push(`   ${entry.titleEs}`);
        for (const paragraph of entry.bodyEs.split('\n')) lines.push(`   ${paragraph}`);
        lines.push('');
    });

    lines.push('─'.repeat(72));
    lines.push('');
    lines.push('Do not want one? Name it — the tool does the rest (branch, PR, labels):');
    lines.push(`  hops whats-new drop ${pending.map((entry) => entry.id).join(' ')}`);
    lines.push('');
    lines.push('Keeping them needs no action at all.');
    return lines.join('\n');
}
