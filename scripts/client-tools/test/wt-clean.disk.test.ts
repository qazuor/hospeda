import { describe, expect, it } from 'bun:test';
import { freedMb, parseDf } from '../src/commands/wt-clean/disk.ts';

const HEADER = 'Filesystem     1024-blocks      Used Available Capacity Mounted on';

describe('parseDf', () => {
    it('should read the available column and the mount point', () => {
        const stdout = `${HEADER}\n/dev/nvme0n1p6   237917696 205520896  20516352      91% /`;

        expect(parseDf({ stdout })).toEqual({ mount: '/', availableKb: 20_516_352 });
    });

    it('should tolerate a trailing newline', () => {
        const stdout = `${HEADER}\n/dev/sda1 100 60 40 60% /home\n`;

        expect(parseDf({ stdout })).toEqual({ mount: '/home', availableKb: 40 });
    });

    it('should keep a mount point that contains spaces', () => {
        const stdout = `${HEADER}\n/dev/sdb1 100 60 40 60% /media/My Backup Drive`;

        expect(parseDf({ stdout })?.mount).toBe('/media/My Backup Drive');
    });

    it('should return null when the output is not a df report', () => {
        expect(parseDf({ stdout: 'df: /nope: No such file or directory' })).toBeNull();
    });

    it('should return null on empty output', () => {
        expect(parseDf({ stdout: '   \n  ' })).toBeNull();
    });

    /**
     * A truncated report: five fields, the fourth of them a perfectly good
     * number, and no mount point. Without the mount check this parses as
     * `{ mount: '', availableKb: 40 }` and silently becomes a phantom
     * filesystem that never appears in the second reading.
     */
    it('should return null when the mount point is missing', () => {
        const stdout = `${HEADER}\n/dev/sda1 100 60 40 60%`;

        expect(parseDf({ stdout })).toBeNull();
    });

    it('should return null when the available column is not a number', () => {
        const stdout = `${HEADER}\n/dev/sda1 100 60 - 60% /`;

        expect(parseDf({ stdout })).toBeNull();
    });
});

describe('freedMb', () => {
    it('should report the space the filesystem actually gave back', () => {
        const before = new Map([['/', 1_000_000]]);
        const after = new Map([['/', 14_632_000]]);

        // 13_632_000 KiB ≈ 13_313 MiB
        expect(freedMb({ before, after })).toBe(13_313);
    });

    it('should add up across separate filesystems', () => {
        const before = new Map([
            ['/', 1_024],
            ['/home', 2_048]
        ]);
        const after = new Map([
            ['/', 2_048],
            ['/home', 5_120]
        ]);

        expect(freedMb({ before, after })).toBe(4);
    });

    /**
     * A filesystem that LOST space during the run had something else writing to
     * it — a dev server, a build. Subtracting that would report less than was
     * freed; attributing it would be a guess. It contributes zero either way.
     */
    it('should ignore a filesystem that lost space during the run', () => {
        const before = new Map([
            ['/', 1_024],
            ['/home', 10_240]
        ]);
        const after = new Map([
            ['/', 2_048],
            ['/home', 5_120]
        ]);

        expect(freedMb({ before, after })).toBe(1);
    });

    it('should report zero, not null, when nothing was actually freed', () => {
        // The hardlink case: every inode survived elsewhere. Zero is the honest
        // answer and it is NOT the same as "could not measure".
        const before = new Map([['/', 1_024]]);
        const after = new Map([['/', 1_024]]);

        expect(freedMb({ before, after })).toBe(0);
    });

    it('should return null when no mount point could be read at all', () => {
        expect(freedMb({ before: new Map(), after: new Map() })).toBeNull();
    });

    it('should return null when the after reading lost every mount point', () => {
        const before = new Map([['/', 1_024]]);

        expect(freedMb({ before, after: new Map() })).toBeNull();
    });

    it('should skip a mount point missing from the after reading', () => {
        const before = new Map([
            ['/', 1_024],
            ['/mnt/gone', 9_999_999]
        ]);
        const after = new Map([['/', 2_048]]);

        expect(freedMb({ before, after })).toBe(1);
    });
});
