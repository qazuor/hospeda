/**
 * Where a command is acting.
 *
 * `local` is this machine's checkout; `staging` and `prod` are the VPS, reached
 * over SSH. The value drives the status bar's colour, so it is the one thing
 * that must never be wrong or absent.
 */
export type Target = 'local' | 'staging' | 'prod';

/** Human label painted in the status bar. */
const LABEL: Record<Target, string> = {
    local: 'local',
    staging: 'STAGING',
    prod: 'PRODUCCIÓN'
};

/**
 * 256-colour palette entries, one per target.
 *
 * Orange has no ANSI-16 equivalent, which is the whole reason for reaching into
 * the 256-colour palette: staging must not look like either of its neighbours.
 */
const XTERM: Record<Target, number> = {
    local: 44,
    staging: 208,
    prod: 196
};

/** ANSI-16 background codes, used when 256 colours are not available. */
const BASIC: Record<Target, number> = {
    local: 46,
    staging: 43,
    prod: 41
};

/**
 * Whether the terminal can render the 256-colour palette.
 *
 * Checked rather than assumed: on a terminal that cannot, a 256-colour escape
 * degrades to something unreadable instead of to nothing, which is worse than
 * the plain yellow fallback.
 *
 * @param input.env - Environment to inspect.
 * @returns `true` when 256 colours are safe to emit.
 */
export function supports256({
    env = process.env
}: {
    readonly env?: NodeJS.ProcessEnv;
} = {}): boolean {
    if (env['NO_COLOR'] !== undefined && env['NO_COLOR'] !== '') return false;
    const colorterm = env['COLORTERM'] ?? '';
    if (/truecolor|24bit/i.test(colorterm)) return true;
    const term = env['TERM'] ?? '';
    return /256color|kitty|alacritty|wezterm|ghostty/i.test(term);
}

/**
 * Whether colour should be emitted at all.
 *
 * @param input.env    - Environment to inspect.
 * @param input.isTTY  - Whether the destination is a terminal.
 * @returns `true` when escapes should be written.
 */
export function supportsColor({
    env = process.env,
    isTTY = process.stdout.isTTY === true
}: {
    readonly env?: NodeJS.ProcessEnv;
    readonly isTTY?: boolean;
} = {}): boolean {
    if (env['NO_COLOR'] !== undefined && env['NO_COLOR'] !== '') return false;
    if (env['FORCE_COLOR'] !== undefined && env['FORCE_COLOR'] !== '0') return true;
    return isTTY;
}

/** The escape codes that paint one target's badge. */
export interface TargetStyle {
    /** Escape sequence that opens the styled run. */
    readonly open: string;
    /** Escape sequence that closes it. */
    readonly close: string;
    /** The label to print inside. */
    readonly label: string;
}

/**
 * Resolves the escape codes for a target's status bar.
 *
 * @param input.target - The active target.
 * @param input.env    - Environment to inspect for colour support.
 * @param input.isTTY  - Whether the destination is a terminal.
 * @returns The {@link TargetStyle}; `open`/`close` are empty without colour.
 */
export function targetStyle({
    target,
    env = process.env,
    isTTY = process.stdout.isTTY === true
}: {
    readonly target: Target;
    readonly env?: NodeJS.ProcessEnv;
    readonly isTTY?: boolean;
}): TargetStyle {
    const label = LABEL[target];
    if (!supportsColor({ env, isTTY })) return { open: '', close: '', label };
    // Black text on a filled background: the point is a badge you cannot skim
    // past, not a tinted word.
    const bg = supports256({ env }) ? `\x1b[48;5;${XTERM[target]}m` : `\x1b[${BASIC[target]}m`;
    return { open: `${bg}\x1b[30m\x1b[1m`, close: '\x1b[0m', label };
}

/**
 * Whether acting on this target can affect anyone but the developer.
 *
 * @param input.target - The target to assess.
 * @returns `true` for the shared environments.
 */
export function isRemoteTarget({ target }: { readonly target: Target }): boolean {
    return target !== 'local';
}

/**
 * Parses `--target=<x>` / `--target <x>` out of an argument list.
 *
 * Defaults to `local`: this CLI runs on the developer's machine, and a missing
 * flag must never be read as "production".
 *
 * @param input.argv - Arguments to scan.
 * @returns The requested target and the arguments with the flag removed.
 */
export function extractTarget({ argv }: { readonly argv: readonly string[] }): {
    readonly target: Target;
    readonly rest: readonly string[];
} {
    const rest: string[] = [];
    let target: Target = 'local';
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i] ?? '';
        const inline = /^--target=(.+)$/.exec(arg);
        const value = inline?.[1] ?? (arg === '--target' ? argv[i + 1] : undefined);
        if (value === undefined) {
            rest.push(arg);
            continue;
        }
        if (value === 'local' || value === 'staging' || value === 'prod') target = value;
        if (inline === null) i += 1;
    }
    return { target, rest };
}
