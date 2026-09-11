import { run } from '../../lib/exec.ts';

/** Free space on one mounted filesystem, in kibibytes. */
export interface MountFree {
    /** Mount point, as reported by `df`. Identifies the filesystem. */
    readonly mount: string;
    /** Blocks available to a non-root user, in KiB. */
    readonly availableKb: number;
}

/**
 * Parses one `df -Pk` report into a mount point and its free space.
 *
 * POSIX output mode (`-P`) is what makes this parseable: it guarantees the
 * report is ONE line per filesystem, where the default format wraps a long
 * device name onto its own line and shifts every column. Nothing here tries to
 * handle a wrapped line — with `-P` it cannot happen, and guessing at a format
 * we never produce would be untested code on a path that matters.
 *
 * The report is read from the LAST line so a notice printed ahead of it cannot
 * be parsed as data.
 *
 * The mount point is every field from the sixth onward, not just the sixth,
 * because a mount point may contain spaces while none of the five numeric
 * columns can.
 *
 * @param input.stdout - Raw output of `df -Pk <path>`.
 * @returns The parsed entry, or `null` when the output is not a df report.
 *
 * @example
 * ```ts
 * parseDf({ stdout: 'Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/sda1 100 60 40 60% /home' });
 * // { mount: '/home', availableKb: 40 }
 * ```
 */
export function parseDf({ stdout }: { readonly stdout: string }): MountFree | null {
    const line = stdout.trim().split('\n').at(-1);
    if (line === undefined) return null;

    const fields = line.trim().split(/\s+/);

    // Two checks, and a field-count check would be a third that can never
    // decide anything: below six fields `slice(5)` is empty and the mount
    // check already rejects the line. Mutation-tested — it survived.
    const availableKb = Number(fields[3]);
    if (!Number.isFinite(availableKb)) return null;

    const mount = fields.slice(5).join(' ');
    if (mount.length === 0) return null;

    return { mount, availableKb };
}

/**
 * Reads free space for every distinct filesystem the given paths live on.
 *
 * Keyed by mount point rather than by path on purpose: several worktrees
 * usually share one filesystem, and reading it once per worktree would count
 * the same free space repeatedly.
 *
 * @param input.paths - Absolute paths to inspect.
 * @returns Free space per mount point. Paths that cannot be read are skipped.
 */
export async function readFree({
    paths
}: {
    readonly paths: readonly string[];
}): Promise<ReadonlyMap<string, number>> {
    const free = new Map<string, number>();

    for (const path of paths) {
        const result = await run({
            command: 'df',
            args: ['-Pk', '--', path],
            timeoutMs: 15_000
        });
        if (!result.ok) continue;

        const parsed = parseDf({ stdout: result.stdout });
        if (parsed === null) continue;

        free.set(parsed.mount, parsed.availableKb);
    }

    return free;
}

/**
 * How much space was actually returned to the filesystems, in MiB.
 *
 * This is the only honest way to answer "how much did that free up". Adding up
 * `du` per worktree cannot: `du` de-duplicates hardlinks WITHIN one run but not
 * across runs, and — the part that bites harder — a file whose inode is still
 * linked from a surviving tree frees nothing at all when its worktree copy is
 * unlinked. Measured here: one `semver/index.js` inode was linked from six
 * separate clones plus the pnpm store, so deleting five of them would have
 * returned zero bytes while `du` happily charged for all five.
 *
 * Only mount points present in BOTH readings count, and only positive deltas:
 * a filesystem that lost space during the run had something else writing to it,
 * and attributing that to the removal would be a guess.
 *
 * @param input.before - Free space per mount point, read before removing.
 * @param input.after  - Free space per mount point, read after removing.
 * @returns MiB returned to disk, or `null` when nothing could be measured.
 *
 * @example
 * ```ts
 * freedMb({ before: new Map([['/', 1_000]]), after: new Map([['/', 3_048]]) });
 * // 2
 * ```
 */
export function freedMb({
    before,
    after
}: {
    readonly before: ReadonlyMap<string, number>;
    readonly after: ReadonlyMap<string, number>;
}): number | null {
    let totalKb = 0;
    let measured = false;

    for (const [mount, beforeKb] of before) {
        const afterKb = after.get(mount);
        if (afterKb === undefined) continue;
        measured = true;
        const delta = afterKb - beforeKb;
        if (delta > 0) totalKb += delta;
    }

    if (!measured) return null;
    return Math.round(totalKb / 1024);
}
