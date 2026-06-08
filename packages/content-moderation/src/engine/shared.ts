import type { ModerationCategory, ModerationResult } from '../types.js';

export const URL_PATTERN = /https?:\/\/[^\s]+/gi;

export function parseBlocklist(raw: string | undefined): readonly string[] {
    if (!raw) return Object.freeze([]);

    return Object.freeze(
        raw
            .split(',')
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0)
    );
}

export function createZeroCategories(): Readonly<Record<ModerationCategory, number>> {
    return Object.freeze({
        spam: 0,
        sexual: 0,
        violence: 0,
        hate: 0,
        harassment: 0,
        other: 0
    });
}

export function createModerationResult(params: {
    score: number;
    categories: Record<ModerationCategory, number>;
    matchedTerms: readonly string[];
}): ModerationResult {
    return {
        score: params.score,
        categories: Object.freeze({ ...params.categories }),
        matchedTerms: Object.freeze([...params.matchedTerms])
    };
}

export function uniquePush(target: string[], value: string): void {
    if (!target.includes(value)) {
        target.push(value);
    }
}

export function extractHostnames(text: string): string[] {
    const urlMatches = text.match(URL_PATTERN) ?? [];
    const hostnames: string[] = [];

    for (const urlMatch of urlMatches) {
        try {
            hostnames.push(new URL(urlMatch).hostname.toLowerCase());
        } catch {
            // Ignore malformed URLs.
        }
    }

    return hostnames;
}
