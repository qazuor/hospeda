import { type CatalogEntry, hasEntriesArray, isUnpublished, parseCatalog } from './catalog.ts';

/** What dropping a set of ids would do, once it is known to be legal. */
export interface DropPlan {
    /** The catalog source with those entries removed. */
    readonly content: string;
    /** The entries that would be removed, in declared order. */
    readonly dropped: readonly CatalogEntry[];
    /**
     * Every PR the dropped entries were written for, deduplicated.
     *
     * These are the PRs whose decision becomes `whats-new-none`: the change
     * was evaluated, and the answer turned out to be "not news". Empty when
     * none of the dropped entries carries an `// origin:` comment, which the
     * caller must report rather than treat as "no PRs to relabel".
     */
    readonly originPrs: readonly number[];
    /** Dropped entries that recorded no originating PR at all. */
    readonly withoutOrigin: readonly CatalogEntry[];
}

/** Either a plan, or the one reason it is refused. */
export type DropOutcome =
    | { readonly ok: true; readonly plan: DropPlan }
    | { readonly ok: false; readonly reason: string };

/**
 * Plans the removal of entries by id, refusing anything that is not a
 * withdrawal of an unpublished entry (HOS-1214 D-7).
 *
 * Pure: it computes the new file content and the PRs to relabel, and writes
 * nothing. Every refusal is a single reason, the first one that applies, so
 * the operator fixes one thing rather than reading a list.
 *
 * ## Why a PUBLISHED entry is refused
 *
 * Removing an entry that already has a real `publishedAt` is a RETIREMENT, not
 * a withdrawal: it was served to users, so its id may sit in somebody's
 * `seenIds`, and it must go into `RETIRED_WHATS_NEW_IDS` to keep that id from
 * ever being reused. That is a deliberate, different gesture with a different
 * consequence, and quietly doing it here would skip the ledger — the exact
 * silent collision `check-whats-new-catalog.sh` exists to catch.
 *
 * An entry still carrying the marker was never visible to anyone (its
 * `publishedAt` parses to `NaN`, so the visibility filter excludes it), so
 * nobody's `seenIds` can reference it and its id stays available. That is why
 * a dropped id does NOT go into the retired ledger.
 *
 * @param input.content - The catalog source.
 * @param input.ids     - Ids to withdraw.
 * @returns The {@link DropOutcome}.
 */
export function planDrop({
    content,
    ids
}: {
    readonly content: string;
    readonly ids: readonly string[];
}): DropOutcome {
    if (ids.length === 0) {
        return { ok: false, reason: 'No me pasaste ningún id para retirar.' };
    }
    if (!hasEntriesArray({ content })) {
        return {
            ok: false,
            reason:
                'No encontré `export const whatsNewEntries` en el catálogo. ' +
                '¿Se renombró la declaración? No toco un archivo que no puedo leer.'
        };
    }

    const wanted = [...new Set(ids)];
    const entries = parseCatalog({ content });
    const byId = new Map(entries.map((entry) => [entry.id, entry]));

    const unknown = wanted.filter((id) => !byId.has(id));
    if (unknown.length > 0) {
        return {
            ok: false,
            reason:
                `No existe(n) en el catálogo: ${unknown.join(', ')}. ` +
                'No retiro nada si alguno de los ids no está — un id mal tipeado ' +
                'que borre otra entrada es peor que no borrar ninguna.'
        };
    }

    const published = wanted
        .map((id) => byId.get(id) as CatalogEntry)
        .filter((entry) => !isUnpublished({ entry }));
    if (published.length > 0) {
        return {
            ok: false,
            reason:
                `Ya está(n) publicada(s): ${published.map((entry) => entry.id).join(', ')}. ` +
                'Retirar una entrada publicada es otra cosa: su id puede estar en el ' +
                '`seenIds` de alguien, así que va a RETIRED_WHATS_NEW_IDS a mano, ' +
                'no por acá.'
        };
    }

    const dropped = entries.filter((entry) => wanted.includes(entry.id));

    // Cut from the end backwards so each span's indices stay valid.
    let updated = content;
    for (const entry of [...dropped].sort((a, b) => b.start - a.start)) {
        updated = updated.slice(0, entry.start) + updated.slice(entry.end);
    }

    const originPrs: number[] = [];
    for (const entry of dropped) {
        for (const pr of entry.originPrs) if (!originPrs.includes(pr)) originPrs.push(pr);
    }

    return {
        ok: true,
        plan: {
            content: updated,
            dropped,
            originPrs,
            withoutOrigin: dropped.filter((entry) => entry.originPrs.length === 0)
        }
    };
}

/**
 * The branch name a drop opens its PR from.
 *
 * Derived from the ids so two drops of the same set collide instead of piling
 * up branches, and so the branch itself says what it does.
 *
 * @param input.ids - The ids being withdrawn.
 * @returns A branch name under `chore/`.
 */
export function dropBranchName({ ids }: { readonly ids: readonly string[] }): string {
    const slug = [...ids]
        .sort()
        .join('-')
        .replace(/[^a-z0-9-]/gi, '-')
        .replace(/-+/g, '-')
        .slice(0, 60)
        .replace(/-$/, '');
    return `chore/whats-new-drop-${slug}`;
}

/**
 * The drop PR's body.
 *
 * States the exemption reason in the PR itself, not only in code: this PR
 * carries `whats-new-none` because a PR that only WITHDRAWS novelty entries
 * cannot itself be a novelty for a user. Leaving that implicit is what makes
 * the next reader delete it as a hole in the gate.
 *
 * @param input.dropped   - Ids withdrawn.
 * @param input.originPrs - PRs relabelled to `whats-new-none`.
 * @returns The PR body, in English like the rest of the repo's PR prose.
 */
export function dropPrBody({
    dropped,
    originPrs
}: {
    readonly dropped: readonly string[];
    readonly originPrs: readonly number[];
}): string {
    const lines: string[] = [
        "Withdraws What's New entries the owner reviewed and did not want, before",
        'they were ever published. Every entry removed here still carried',
        "`publishedAt: 'on-promotion'`, so it was invisible to users and its id is",
        'not added to `RETIRED_WHATS_NEW_IDS` — nobody can have it in `seenIds`.',
        '',
        'Withdrawn:',
        ...dropped.map((id) => `- \`${id}\``),
        ''
    ];

    if (originPrs.length > 0) {
        lines.push(
            'The PRs these entries were written for are relabelled `whats-new-none`:',
            originPrs.map((number) => `#${number}`).join(', '),
            '',
            'That records the decision that was actually taken — evaluated, not a',
            'novelty — instead of leaving them claiming an entry that no longer exists.',
            ''
        );
    }

    lines.push(
        'This PR carries `whats-new-none` itself, and that is not an exemption: a PR',
        "that only withdraws What's New entries cannot itself be a novelty for a",
        'user. The gate asks for a recorded decision, and this is one.'
    );
    return lines.join('\n');
}
