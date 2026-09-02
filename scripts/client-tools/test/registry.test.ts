import { describe, expect, it } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { COMMANDS, findCommand } from '../src/registry.ts';

const BIN_DIR = join(import.meta.dir, '..', 'bin');

describe('COMMANDS', () => {
    it('should have unique names', () => {
        const names = COMMANDS.map((command) => command.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('should give every command a non-empty summary for the menu', () => {
        for (const command of COMMANDS) {
            expect(command.summary.length).toBeGreaterThan(0);
        }
    });

    it('should expose a standalone binary for every command', () => {
        // A command reachable as `hops <name>` but with no `hops-<name>` on disk
        // is exactly the drift this registry exists to prevent.
        const bins = new Set(readdirSync(BIN_DIR));
        for (const command of COMMANDS) {
            expect(bins.has(`hops-${command.name}`)).toBe(true);
        }
    });

    it('should not ship a binary for a command that does not exist', () => {
        const names = new Set(COMMANDS.map((command) => `hops-${command.name}`));
        for (const bin of readdirSync(BIN_DIR)) {
            if (bin === 'hops') continue;
            expect(names.has(bin)).toBe(true);
        }
    });
});

describe('findCommand', () => {
    it('should find a registered command', () => {
        expect(findCommand({ name: 'wt-clean' })?.name).toBe('wt-clean');
    });

    it('should return undefined for an unknown name', () => {
        expect(findCommand({ name: 'nope' })).toBeUndefined();
    });
});

describe('command modules', () => {
    it('should load every command and expose a matching name', async () => {
        // Catches a registry entry pointing at a module that was renamed,
        // moved, or never written — without running any of them.
        for (const entry of COMMANDS) {
            const command = await entry.load();
            expect(command.name).toBe(entry.name);
            expect(typeof command.run).toBe('function');
        }
    });
});
