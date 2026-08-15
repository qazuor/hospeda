/**
 * Unit tests for `src/lib/cli-flags.ts` — validateCommandFlags() and the argv
 * specs declared in `src/index.ts`.
 *
 * Two things are under test, and they fail in opposite directions:
 *
 * 1. The validator REFUSES what it should. This is the HOS-510 defect: a
 *    misspelled flag that gets dropped while the rest of the command runs.
 * 2. The validator ACCEPTS what it should. This matters more than it looks —
 *    `hops` runs against production, and a validator that rejects an
 *    invocation an operator uses today is a worse regression than the hole it
 *    closes. Six live help-vs-code mismatches were found while writing the
 *    specs (undocumented `-y`, spaced `--app`), and each one is pinned below.
 *
 * The specs themselves are asserted against the real registry rather than
 * against a fixture, so a spec that drifts away from its command's parser
 * fails here rather than in an operator's terminal.
 */

import { describe, expect, it } from 'bun:test';
import {
    type CommandArgvSpec,
    formatUnknownFlagsError,
    validateCommandFlags
} from '../src/lib/cli-flags.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Runs the validator and returns just the offending tokens. */
function unknownFlags(argv: readonly string[], spec: CommandArgvSpec): readonly string[] {
    return validateCommandFlags({ argv, spec }).unknown.map((entry) => entry.flag);
}

/** A minimal spec with one of each flag shape. */
const BASIC_SPEC: CommandArgvSpec = {
    booleanFlags: ['--status', '--yes', '--help', '-h'],
    valueFlags: [
        { name: '--email', syntax: 'both' },
        { name: '--match', syntax: 'space' },
        { name: '--only', syntax: 'equals' }
    ]
};

// ---------------------------------------------------------------------------
// Refusing what it should
// ---------------------------------------------------------------------------

describe('validateCommandFlags — refusal', () => {
    it('refuses a misspelled flag instead of ignoring it', () => {
        expect(unknownFlags(['--statuss'], BASIC_SPEC)).toEqual(['--statuss']);
    });

    it('refuses a flag that belongs to a different command', () => {
        expect(unknownFlags(['--reset'], BASIC_SPEC)).toEqual(['--reset']);
    });

    it('reports every unknown token, in order, not just the first', () => {
        expect(unknownFlags(['--nope', '--status', '--also-nope'], BASIC_SPEC)).toEqual([
            '--nope',
            '--also-nope'
        ]);
    });

    it('refuses `--boolean=value`, because that is a different token', () => {
        // Accepting it would reopen the exact hole this closes: the parser does
        // `includes('--yes')`, so `--yes=true` is NOT seen as --yes and the
        // confirmation prompt would still appear — "looks handled, is not".
        expect(unknownFlags(['--yes=true'], BASIC_SPEC)).toEqual(['--yes=true']);
    });

    it('refuses a value flag given with an empty value', () => {
        expect(unknownFlags(['--email='], BASIC_SPEC)).toEqual(['--email=']);
    });

    it('refuses an `equals`-only flag written in the spaced form', () => {
        // db-superadmin-pass --email is the real case: its parser dies on this
        // shape, so waving it through would only move the error later.
        expect(unknownFlags(['--only', 'x'], BASIC_SPEC)).toEqual(['--only']);
    });

    it('refuses a `space`-only flag written with an equals sign', () => {
        expect(unknownFlags(['--match=abc'], BASIC_SPEC)).toEqual(['--match=abc']);
    });

    it('attaches a near-miss hint when the token is a known footgun', () => {
        const result = validateCommandFlags({
            argv: ['--dry-run'],
            spec: {
                booleanFlags: [],
                valueFlags: [],
                hints: { '--dry-run': 'did you mean --status?' }
            }
        });
        expect(result.unknown[0]?.hint).toBe('did you mean --status?');
    });

    it('falls back to a global hint when the command declares none', () => {
        const result = validateCommandFlags({
            argv: ['--prod'],
            spec: { booleanFlags: [], valueFlags: [] }
        });
        expect(result.unknown[0]?.hint).toContain('--target=prod');
    });
});

// ---------------------------------------------------------------------------
// Accepting what it should
// ---------------------------------------------------------------------------

describe('validateCommandFlags — acceptance', () => {
    it('accepts an empty argv', () => {
        expect(unknownFlags([], BASIC_SPEC)).toEqual([]);
    });

    it('accepts a declared boolean flag', () => {
        expect(unknownFlags(['--status', '--yes'], BASIC_SPEC)).toEqual([]);
    });

    it('accepts a `both`-syntax value flag in either spelling', () => {
        expect(unknownFlags(['--email=a@b.com'], BASIC_SPEC)).toEqual([]);
        expect(unknownFlags(['--email', 'a@b.com'], BASIC_SPEC)).toEqual([]);
    });

    it('does not validate a value token, even when it looks like a flag', () => {
        // A regex or a negative number is data. Validating it would break
        // `hops logs api -g "--foo"`.
        expect(unknownFlags(['--match', '--weird-looking-regex'], BASIC_SPEC)).toEqual([]);
    });

    it('leaves bare positionals alone', () => {
        // Each command validates its own positionals; this validator is about
        // flags only.
        expect(unknownFlags(['api', 'SOME_KEY', 'some value'], BASIC_SPEC)).toEqual([]);
    });

    it('accepts a lone `--` separator', () => {
        expect(unknownFlags(['--', '--status'], BASIC_SPEC)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Pass-through commands (exec, psql)
// ---------------------------------------------------------------------------

describe('validateCommandFlags — pass-through payloads', () => {
    const EXEC_SPEC: CommandArgvSpec = {
        booleanFlags: ['--shell', '--help', '-h'],
        valueFlags: [{ name: '--env', syntax: 'space' }],
        leadingPositionals: 1,
        payloadAfterPositionals: true
    };

    it('stops validating once the container command begins', () => {
        // `-la` belongs to `ls`, not to hops.
        expect(unknownFlags(['api', 'ls', '-la', '/repo'], EXEC_SPEC)).toEqual([]);
    });

    it('stops at an explicit `--` separator', () => {
        expect(unknownFlags(['api', '--', 'ls', '-la'], EXEC_SPEC)).toEqual([]);
    });

    it('STILL refuses a misspelled flag written before the payload', () => {
        // This is what keeps the pass-through from becoming a blanket exemption:
        // the boundary is the first bare token PAST <kind>, so flags in between
        // are checked normally.
        expect(unknownFlags(['api', '--shel'], EXEC_SPEC)).toEqual(['--shel']);
    });

    it('accepts the kind positional followed by a declared flag', () => {
        expect(unknownFlags(['api', '--shell'], EXEC_SPEC)).toEqual([]);
        expect(unknownFlags(['api', '--env', 'HOSPEDA_'], EXEC_SPEC)).toEqual([]);
    });

    const PSQL_SPEC: CommandArgvSpec = {
        booleanFlags: ['-t', '--csv', '--stdin', '--help', '-h'],
        valueFlags: [
            { name: '-f', syntax: 'space' },
            { name: '--limit', syntax: 'space' }
        ],
        payloadAfterPositionals: true
    };

    it('treats inline SQL as opaque, including its dashes', () => {
        expect(unknownFlags(['SELECT 1 -- a comment'], PSQL_SPEC)).toEqual([]);
        expect(unknownFlags(['-t', 'SELECT 1'], PSQL_SPEC)).toEqual([]);
    });

    it('still refuses a misspelled psql flag written before the SQL', () => {
        expect(unknownFlags(['--limitt', '5', 'SELECT 1'], PSQL_SPEC)).toEqual(['--limitt']);
    });
});

// ---------------------------------------------------------------------------
// The real registry
// ---------------------------------------------------------------------------

describe('the registered command specs', () => {
    it('declares an argv spec for every registered command', async () => {
        // The Command interface makes `argv` required, so a missing spec is a
        // compile error rather than a runtime one. This asserts the count as
        // well, which catches a spec accidentally shared between two entries.
        const source = await Bun.file(`${import.meta.dir}/../src/index.ts`).text();
        const names = [...source.matchAll(/^ {8}name: '([^']+)',$/gm)];
        const specs = [...source.matchAll(/^ {8}argv: \{/gm)];

        expect(names.length).toBeGreaterThan(0);
        expect(specs.length).toBe(names.length);
    });

    it('never declares the global --target, which is stripped before dispatch', () => {
        // resolveTarget() removes it from argv in main(), so a command that
        // declared it would be documenting a token it can never receive.
        const specSource = Bun.file(`${import.meta.dir}/../src/index.ts`);
        return specSource.text().then((source) => {
            const registry = source.slice(
                source.indexOf('const COMMANDS'),
                source.indexOf('const TOP_LEVEL_HELP')
            );
            expect(registry).not.toContain("'--target'");
        });
    });
});

// ---------------------------------------------------------------------------
// The refusal message
// ---------------------------------------------------------------------------

describe('formatUnknownFlagsError', () => {
    it('names the command and states that nothing ran', () => {
        const message = formatUnknownFlagsError({
            commandName: 'db-seed-migrate',
            unknown: [{ flag: '--statuss' }]
        });
        expect(message).toContain("'db-seed-migrate'");
        expect(message).toContain('nothing was executed');
        expect(message).toContain('hops db-seed-migrate --help');
    });

    it('prints the hint next to the flag it belongs to', () => {
        const message = formatUnknownFlagsError({
            commandName: 'db-seed-migrate',
            unknown: [{ flag: '--dry-run', hint: 'did you mean --status?' }]
        });
        expect(message).toContain('--dry-run — did you mean --status?');
    });

    it('pluralises only when there is more than one', () => {
        const one = formatUnknownFlagsError({ commandName: 'x', unknown: [{ flag: '--a' }] });
        const two = formatUnknownFlagsError({
            commandName: 'x',
            unknown: [{ flag: '--a' }, { flag: '--b' }]
        });
        expect(one).toContain('Unrecognized argument for');
        expect(two).toContain('Unrecognized arguments for');
    });
});
