import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdMapper } from '../../src/utils/idMapper.js';
import { createSeedContext, defaultSeedContext } from '../../src/utils/seedContext.js';

describe('defaultSeedContext', () => {
    it('has continueOnError set to false', () => {
        expect(defaultSeedContext.continueOnError).toBe(false);
    });

    it('has validateManifests set to true', () => {
        expect(defaultSeedContext.validateManifests).toBe(true);
    });

    it('has resetDatabase set to false', () => {
        expect(defaultSeedContext.resetDatabase).toBe(false);
    });

    it('has an empty exclude array', () => {
        expect(Array.isArray(defaultSeedContext.exclude)).toBe(true);
        expect(defaultSeedContext.exclude).toHaveLength(0);
    });

    it('has an idMapper instance', () => {
        expect(defaultSeedContext.idMapper).toBeInstanceOf(IdMapper);
    });

    it('has no actor by default', () => {
        expect(defaultSeedContext.actor).toBeUndefined();
    });
});

describe('createSeedContext', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-context-'));
        vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns a context with default values when no overrides provided', () => {
        const context = createSeedContext();

        expect(context.continueOnError).toBe(false);
        expect(context.validateManifests).toBe(true);
        expect(context.resetDatabase).toBe(false);
        expect(context.exclude).toHaveLength(0);
    });

    it('applies provided overrides', () => {
        const context = createSeedContext({
            continueOnError: true,
            resetDatabase: true,
            exclude: ['Users', 'Destinations']
        });

        expect(context.continueOnError).toBe(true);
        expect(context.resetDatabase).toBe(true);
        expect(context.exclude).toEqual(['Users', 'Destinations']);
    });

    it('preserves defaults for fields not in overrides', () => {
        const context = createSeedContext({ continueOnError: true });

        expect(context.validateManifests).toBe(true);
        expect(context.resetDatabase).toBe(false);
    });

    it('creates a new context object (not a shared reference)', () => {
        const ctx1 = createSeedContext({ continueOnError: true });
        const ctx2 = createSeedContext({ continueOnError: false });

        expect(ctx1.continueOnError).not.toBe(ctx2.continueOnError);
    });
});
