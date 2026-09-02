import { describe, expect, it } from 'bun:test';
import { formatDuration, renderClose, renderOpen } from '../src/lib/statusbar.ts';
import {
    extractTarget,
    isRemoteTarget,
    supports256,
    supportsColor,
    targetStyle
} from '../src/lib/target.ts';

/** Strips ANSI so assertions read against visible text. */
function plain(text: string): string {
    // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escapes is the point
    return text.replace(/\x1b\[[0-9;]*m/g, '');
}

describe('extractTarget', () => {
    it('should default to local when no flag is given', () => {
        // This is the safety-critical default: a missing flag must never be
        // read as production.
        expect(extractTarget({ argv: [] }).target).toBe('local');
        expect(extractTarget({ argv: ['--yes', 'foo'] }).target).toBe('local');
    });

    it('should read both --target=x and --target x', () => {
        expect(extractTarget({ argv: ['--target=prod'] }).target).toBe('prod');
        expect(extractTarget({ argv: ['--target', 'staging'] }).target).toBe('staging');
    });

    it('should ignore an unknown target rather than guessing', () => {
        expect(extractTarget({ argv: ['--target=produccion'] }).target).toBe('local');
    });

    it('should remove the flag and its value from the remaining arguments', () => {
        expect(extractTarget({ argv: ['--target', 'prod', '--yes'] }).rest).toEqual(['--yes']);
        expect(extractTarget({ argv: ['--target=prod', '--yes'] }).rest).toEqual(['--yes']);
    });

    it('should leave unrelated arguments untouched', () => {
        expect(extractTarget({ argv: ['db-stop', '--yes'] }).rest).toEqual(['db-stop', '--yes']);
    });
});

describe('isRemoteTarget', () => {
    it('should treat only local as this machine', () => {
        expect(isRemoteTarget({ target: 'local' })).toBe(false);
        expect(isRemoteTarget({ target: 'staging' })).toBe(true);
        expect(isRemoteTarget({ target: 'prod' })).toBe(true);
    });
});

describe('supports256 / supportsColor', () => {
    it('should accept a truecolor terminal', () => {
        expect(supports256({ env: { COLORTERM: 'truecolor' } })).toBe(true);
    });

    it('should accept a 256-colour TERM', () => {
        expect(supports256({ env: { TERM: 'xterm-256color' } })).toBe(true);
    });

    it('should refuse a plain terminal, so orange degrades instead of garbling', () => {
        expect(supports256({ env: { TERM: 'xterm' } })).toBe(false);
    });

    it('should honour NO_COLOR over everything', () => {
        expect(supports256({ env: { COLORTERM: 'truecolor', NO_COLOR: '1' } })).toBe(false);
        expect(supportsColor({ env: { NO_COLOR: '1' }, isTTY: true })).toBe(false);
    });

    it('should emit no colour when the destination is not a terminal', () => {
        expect(supportsColor({ env: {}, isTTY: false })).toBe(false);
    });
});

describe('targetStyle', () => {
    it('should paint each target a different colour', () => {
        const env = { COLORTERM: 'truecolor' };
        const local = targetStyle({ target: 'local', env, isTTY: true });
        const staging = targetStyle({ target: 'staging', env, isTTY: true });
        const prod = targetStyle({ target: 'prod', env, isTTY: true });

        expect(local.open).toContain('48;5;44');
        expect(staging.open).toContain('48;5;208');
        expect(prod.open).toContain('48;5;196');
        expect(new Set([local.open, staging.open, prod.open]).size).toBe(3);
    });

    it('should fall back to ANSI-16 backgrounds on a plain terminal', () => {
        const style = targetStyle({ target: 'staging', env: { TERM: 'xterm' }, isTTY: true });

        expect(style.open).not.toContain('48;5;');
        expect(style.open).toContain('\x1b[43m');
    });

    it('should still carry the label with colour disabled', () => {
        const style = targetStyle({ target: 'prod', env: { NO_COLOR: '1' }, isTTY: true });

        expect(style.open).toBe('');
        expect(style.label).toBe('PRODUCCIÓN');
    });

    it('should label production unmistakably', () => {
        expect(targetStyle({ target: 'prod', env: {}, isTTY: false }).label).toBe('PRODUCCIÓN');
        expect(targetStyle({ target: 'local', env: {}, isTTY: false }).label).toBe('local');
    });
});

describe('formatDuration', () => {
    it('should use milliseconds under a second', () => {
        expect(formatDuration({ ms: 480 })).toBe('480ms');
    });

    it('should use seconds with one decimal under a minute', () => {
        expect(formatDuration({ ms: 3200 })).toBe('3.2s');
    });

    it('should use minutes and padded seconds beyond one', () => {
        expect(formatDuration({ ms: 125_000 })).toBe('2m 05s');
    });
});

describe('renderOpen / renderClose', () => {
    it('should name the target in both bars', () => {
        const context = { target: 'prod' as const, lines: ['algo'] };
        const open = plain(renderOpen({ context, columns: 80 }));
        const close = plain(
            renderClose({ target: 'prod', ok: true, durationMs: 100, columns: 80 })
        );

        expect(open).toContain('hops · PRODUCCIÓN');
        // The closing bar repeats it on purpose: a long run is read from the
        // bottom, and that is exactly when you need to know where it ran.
        expect(close).toContain('hops · PRODUCCIÓN');
    });

    it('should print every context line under the opening bar', () => {
        const open = plain(
            renderOpen({ context: { target: 'local', lines: ['uno', 'dos'] }, columns: 80 })
        );

        expect(open).toContain('uno');
        expect(open).toContain('dos');
    });

    it('should mark failure differently from success', () => {
        const ok = plain(renderClose({ target: 'local', ok: true, durationMs: 1, columns: 80 }));
        const bad = plain(renderClose({ target: 'local', ok: false, durationMs: 1, columns: 80 }));

        expect(ok).toContain('✓');
        expect(bad).toContain('✗');
    });

    it('should paint the subject inside the badge, not on a line below', () => {
        // Splitting "where does this run" between the coloured band and the
        // plain text under it makes the reader assemble it themselves.
        const open = plain(
            renderOpen({
                context: { target: 'local', subject: 'hos-1010-algo', lines: ['db  x'] },
                columns: 100
            })
        );
        const firstLine = open.split('\n')[0] ?? '';

        expect(firstLine).toContain('hops · local · hos-1010-algo');
    });

    it('should repeat the subject in the closing bar', () => {
        const close = plain(
            renderClose({
                target: 'local',
                subject: 'hos-1010-algo',
                ok: true,
                durationMs: 10,
                columns: 100
            })
        );

        expect(close).toContain('hops · local · hos-1010-algo');
    });

    it('should truncate a long subject instead of wrapping the bar', () => {
        const open = plain(
            renderOpen({
                context: {
                    target: 'local',
                    subject: 'hos-959-login-y-registro-en-pestanas-del-navegador',
                    lines: []
                },
                columns: 100
            })
        );
        const firstLine = open.split('\n')[0] ?? '';

        expect(firstLine).toContain('…');
        expect(firstLine.length).toBeLessThanOrEqual(100);
    });

    it('should omit the separator entirely when there is no subject', () => {
        const open = plain(renderOpen({ context: { target: 'prod', lines: [] }, columns: 80 }));

        expect(open).toContain('hops · PRODUCCIÓN ');
        expect(open).not.toContain('PRODUCCIÓN · ');
    });

    it('should not overflow a narrow terminal', () => {
        const line = plain(
            renderClose({ target: 'prod', ok: true, durationMs: 125_000, columns: 40 })
        ).trimEnd();

        expect(line.length).toBeLessThanOrEqual(40);
    });
});
