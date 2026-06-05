/**
 * @file moderate-text.test.ts
 *
 * Unit tests for the `moderateText` stub engine.
 *
 * ## Test seam strategy (no public contract change)
 *
 * `_blockedWords` and `_blockedDomains` are module-level variables parsed once
 * at module load. The public `index.ts` barrel does NOT export `_testResetBlocklists`
 * — tests import it directly from `../src/moderate-text.js` to force a re-read
 * of env vars after calling `vi.stubEnv`. This keeps the public API unchanged.
 *
 * Pattern per test group that needs a custom blocklist:
 * 1. `vi.stubEnv(...)` to set the env var.
 * 2. `_testResetBlocklists()` to re-parse the env var into the module arrays.
 * 3. Call `moderateText(...)` and assert.
 * 4. `afterEach` calls `vi.unstubAllEnvs()` and `_testResetBlocklists()` to
 *    restore the empty-blocklist state for subsequent tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { _testResetBlocklists, moderateText } from '../src/moderate-text.js';
import type { ModerationResult } from '../src/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Assert the zero/clean result shape. */
function expectCleanResult(result: ModerationResult): void {
    expect(result.score).toBe(0);
    expect(result.matchedTerms).toHaveLength(0);
    expect(result.categories.spam).toBe(0);
    expect(result.categories.sexual).toBe(0);
    expect(result.categories.violence).toBe(0);
    expect(result.categories.hate).toBe(0);
    expect(result.categories.harassment).toBe(0);
    expect(result.categories.other).toBe(0);
}

/** Assert the blocked result shape. */
function expectBlockedResult(result: ModerationResult, expectedTerms: string[]): void {
    expect(result.score).toBe(1.0);
    expect(result.categories.other).toBe(1.0);
    expect(result.categories.spam).toBe(0);
    expect(result.categories.sexual).toBe(0);
    expect(result.categories.violence).toBe(0);
    expect(result.categories.hate).toBe(0);
    expect(result.categories.harassment).toBe(0);
    expect([...result.matchedTerms]).toEqual(expect.arrayContaining(expectedTerms));
    expect(result.matchedTerms.length).toBe(expectedTerms.length);
}

// Restore empty blocklists after every test that may have mutated them
afterEach(() => {
    vi.unstubAllEnvs();
    _testResetBlocklists();
});

// ---------------------------------------------------------------------------
// Default behavior — no env vars set (empty blocklists)
// ---------------------------------------------------------------------------

describe('moderateText — empty blocklists (no env vars)', () => {
    it('should return score 0 and empty matchedTerms for plain text', async () => {
        // Arrange
        const input = { text: 'This is a perfectly normal review.', context: 'review' as const };

        // Act
        const result = await moderateText(input);

        // Assert
        expectCleanResult(result);
    });

    it('should return score 0 for text containing a URL when no domain blocklist', async () => {
        // Arrange
        const input = {
            text: 'Visit https://example.com for details',
            context: 'message' as const
        };

        // Act
        const result = await moderateText(input);

        // Assert
        expectCleanResult(result);
    });

    it('should return score 0 for single-character text', async () => {
        // Arrange
        const input = { text: 'A' };

        // Act
        const result = await moderateText(input);

        // Assert
        expectCleanResult(result);
    });

    it('should return score 0 for text with only whitespace characters', async () => {
        // Arrange — all-whitespace passes Zod (min 1) since spaces count as chars
        const input = { text: '   ' };

        // Act
        const result = await moderateText(input);

        // Assert
        expectCleanResult(result);
    });

    it('should return score 0 for very long clean text', async () => {
        // Arrange
        const input = { text: 'a'.repeat(10_000) };

        // Act
        const result = await moderateText(input);

        // Assert
        expectCleanResult(result);
    });

    it('should work without a context field', async () => {
        // Arrange
        const input = { text: 'No context provided here.' };

        // Act
        const result = await moderateText(input);

        // Assert
        expectCleanResult(result);
    });

    it('should throw ZodError for empty string text', async () => {
        // Arrange + Act + Assert
        await expect(moderateText({ text: '' })).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Blocked words — using _testResetBlocklists to set env mid-test
// ---------------------------------------------------------------------------

describe('moderateText — blocked words', () => {
    beforeEach(() => {
        // Ensure clean state before each test in this group
        vi.unstubAllEnvs();
        _testResetBlocklists();
    });

    it('should detect a single blocked word and return score 1.0', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'badword');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', '');
        _testResetBlocklists();

        // Act
        const result = await moderateText({ text: 'This contains badword here.' });

        // Assert
        expectBlockedResult(result, ['badword']);
    });

    it('should be case-insensitive (uppercase in text, lowercase in blocklist)', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'badword');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', '');
        _testResetBlocklists();

        // Act
        const result = await moderateText({ text: 'This contains BADWORD here.' });

        // Assert
        expectBlockedResult(result, ['badword']);
    });

    it('should be case-insensitive (uppercase in blocklist, lowercase in text)', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'BADWORD');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', '');
        _testResetBlocklists();

        // Act
        const result = await moderateText({ text: 'this contains badword here.' });

        // Assert
        expectBlockedResult(result, ['badword']);
    });

    it('should detect multiple blocked words in one pass', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'spam,evil');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', '');
        _testResetBlocklists();

        // Act
        const result = await moderateText({ text: 'This is spam and evil.' });

        // Assert
        expectBlockedResult(result, ['spam', 'evil']);
    });

    it('should only add each matched term once even if it appears multiple times in text', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'badword');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', '');
        _testResetBlocklists();

        // Act
        const result = await moderateText({ text: 'badword badword badword' });

        // Assert — matchedTerms has exactly one entry even with repeated occurrences
        expect(result.matchedTerms).toHaveLength(1);
        expect(result.matchedTerms[0]).toBe('badword');
    });

    it('should return clean result when text does not contain any blocked word', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'badword,evil');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', '');
        _testResetBlocklists();

        // Act
        const result = await moderateText({ text: 'This is a completely clean message.' });

        // Assert
        expectCleanResult(result);
    });

    it('should handle trailing comma in HOSPEDA_MESSAGING_BLOCKED_WORDS without blocking clean text', async () => {
        // Arrange — trailing comma must NOT produce an empty entry that matches every string
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'spam,evil,');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', '');
        _testResetBlocklists();

        // Act — clean text
        const result = await moderateText({ text: 'This is a perfectly fine message.' });

        // Assert
        expectCleanResult(result);
    });
});

// ---------------------------------------------------------------------------
// Blocked domains — using _testResetBlocklists to set env mid-test
// ---------------------------------------------------------------------------

describe('moderateText — blocked domains', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        _testResetBlocklists();
    });

    it('should detect a blocked domain inside an https URL', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', '');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'spam.com');
        _testResetBlocklists();

        // Act
        const result = await moderateText({
            text: 'Check out https://spam.com for deals',
            context: 'message'
        });

        // Assert
        expectBlockedResult(result, ['spam.com']);
    });

    it('should detect a blocked domain inside an http URL', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', '');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'evil.org');
        _testResetBlocklists();

        // Act
        const result = await moderateText({
            text: 'Visit http://evil.org/page to learn more'
        });

        // Assert
        expectBlockedResult(result, ['evil.org']);
    });

    it('should detect a blocked domain via sub-domain suffix match', async () => {
        // Arrange — 'spam.com' should match 'sub.spam.com'
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', '');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'spam.com');
        _testResetBlocklists();

        // Act
        const result = await moderateText({ text: 'Visit https://sub.spam.com/deals' });

        // Assert
        expectBlockedResult(result, ['spam.com']);
    });

    it('should NOT block a URL whose hostname merely contains a blocked domain as a substring', async () => {
        // Arrange — 'spam.com' must NOT match 'notspam.com'
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', '');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'spam.com');
        _testResetBlocklists();

        // Act
        const result = await moderateText({
            text: 'Visit https://notspam.com — this is fine.'
        });

        // Assert — not a sub-domain, not an exact match → clean
        expectCleanResult(result);
    });

    it('should return clean result for text with a URL from a non-blocked domain', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', '');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'spam.com,evil.org');
        _testResetBlocklists();

        // Act
        const result = await moderateText({
            text: 'Visit https://hospeda.com.ar for info'
        });

        // Assert
        expectCleanResult(result);
    });

    it('should return clean result for text with no URLs when domain blocklist is set', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', '');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'spam.com');
        _testResetBlocklists();

        // Act
        const result = await moderateText({ text: 'No links here, just plain text.' });

        // Assert
        expectCleanResult(result);
    });

    it('should not throw on a malformed URL match (graceful skip)', async () => {
        // Arrange — the regex may match a string that new URL() cannot parse;
        //           the engine must skip it and not propagate the error.
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', '');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'spam.com');
        _testResetBlocklists();

        // Act + Assert — must resolve without throwing
        await expect(
            moderateText({ text: 'Check https://not_a_[valid]_url please' })
        ).resolves.not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Combined: both word and domain blocklists active
// ---------------------------------------------------------------------------

describe('moderateText — combined word + domain blocklists', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        _testResetBlocklists();
    });

    it('should collect matched terms from both word and domain blocklists', async () => {
        // Arrange
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_WORDS', 'spam');
        vi.stubEnv('HOSPEDA_MESSAGING_BLOCKED_DOMAINS', 'evil.org');
        _testResetBlocklists();

        // Act
        const result = await moderateText({
            text: 'This is spam and visit https://evil.org to see more'
        });

        // Assert — both entries appear
        expectBlockedResult(result, ['spam', 'evil.org']);
    });
});

// ---------------------------------------------------------------------------
// Return value shape / immutability
// ---------------------------------------------------------------------------

describe('moderateText — result shape', () => {
    it('should return a result with all required category keys', async () => {
        // Arrange
        const input = { text: 'Hello world' };

        // Act
        const result = await moderateText(input);

        // Assert — all 6 categories present
        expect(result.categories).toHaveProperty('spam');
        expect(result.categories).toHaveProperty('sexual');
        expect(result.categories).toHaveProperty('violence');
        expect(result.categories).toHaveProperty('hate');
        expect(result.categories).toHaveProperty('harassment');
        expect(result.categories).toHaveProperty('other');
    });

    it('matchedTerms should be a frozen array (immutable)', async () => {
        // Arrange
        const input = { text: 'Hello world' };

        // Act
        const result = await moderateText(input);

        // Assert — frozen arrays throw on mutation in strict mode
        expect(Object.isFrozen(result.matchedTerms)).toBe(true);
        expect(() => {
            (result.matchedTerms as string[]).push('injected');
        }).toThrow();
    });

    it('categories should be a frozen object (immutable)', async () => {
        // Arrange
        const input = { text: 'Hello world' };

        // Act
        const result = await moderateText(input);

        // Assert
        expect(Object.isFrozen(result.categories)).toBe(true);
    });

    it('should return a Promise (async contract honored)', async () => {
        // Arrange
        const input = { text: 'Hello world' };

        // Act
        const resultPromise = moderateText(input);

        // Assert — the function returns a Promise before awaiting
        expect(resultPromise).toBeInstanceOf(Promise);
        await resultPromise;
    });
});

// ---------------------------------------------------------------------------
// Input validation (Zod)
// ---------------------------------------------------------------------------

describe('moderateText — input validation', () => {
    it('should throw on empty string text', async () => {
        // Arrange + Act + Assert
        await expect(moderateText({ text: '' })).rejects.toThrow();
    });

    it('should accept any string context without throwing', async () => {
        // Arrange + Act + Assert
        await expect(
            moderateText({ text: 'Hello', context: 'future-context' })
        ).resolves.not.toThrow();
    });

    it('should accept undefined context', async () => {
        // Arrange + Act + Assert
        await expect(moderateText({ text: 'Hello' })).resolves.not.toThrow();
    });
});
