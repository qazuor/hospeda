/**
 * Guard: every surface that enumerates AI features must cover the whole enum.
 *
 * HOS-400 widened `AiFeatureSchema` with `chat_gastronomy` and `chat_experience`
 * and updated `AiFeatureId` and `FEATURE_LABELS` — but not the settings page's
 * own lists. Nothing failed: the enum is the type, and the lists were typed as
 * `AiFeatureId[]`, which a SHORT list satisfies perfectly. Types cannot express
 * "this array is exhaustive", so only an assertion can.
 *
 * What that cost (HOS-1220): `AiFeaturesMapSchema` is a FULL `z.record` over the
 * enum and `readAiSettings` parses the stored blob through it on EVERY read, so
 * the two keys nobody had configured took down the seven that were — every AI
 * feature answered 400 in staging, and production was one promotion away from
 * the same. The blob could not be repaired from the admin UI either, because
 * these are the lists that render and submit it.
 *
 * These tests are pinned to `AiFeatureSchema.options` — the enum itself, not a
 * hand-copied count — so a tenth member fails here instead of in production.
 */

import { AiFeatureSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { FEATURE_LABELS } from '@/features/ai-settings';
import {
    ALL_FEATURES,
    DEFAULT_SETTINGS,
    toFormValues
} from '../../../../src/routes/_authed/ai/-components/ai-settings-features.utils';
import {
    isPlaygroundSupportedFeature,
    PLAYGROUND_UNSUPPORTED_REASON
} from '../../../../src/routes/_authed/ai/-components/playground-features.utils';

/** The authoritative feature list: the Zod enum every schema is keyed by. */
const ENUM_FEATURES = [...AiFeatureSchema.options].sort();

describe('AI settings feature coverage', () => {
    describe('ALL_FEATURES', () => {
        it('covers exactly the AiFeature enum, with no extras and no gaps', () => {
            expect([...ALL_FEATURES].sort()).toEqual(ENUM_FEATURES);
        });

        it('includes the two per-vertical chats HOS-400 added', () => {
            expect(ALL_FEATURES).toContain('chat_gastronomy');
            expect(ALL_FEATURES).toContain('chat_experience');
        });

        it('lists each feature once', () => {
            expect(new Set(ALL_FEATURES).size).toBe(ALL_FEATURES.length);
        });
    });

    describe('DEFAULT_SETTINGS.features', () => {
        it('carries a config for every enum member', () => {
            expect(Object.keys(DEFAULT_SETTINGS.features).sort()).toEqual(ENUM_FEATURES);
        });

        it('defaults every feature to disabled, so a default never spends money', () => {
            for (const feature of AiFeatureSchema.options) {
                expect(DEFAULT_SETTINGS.features[feature]?.enabled).toBe(false);
            }
        });

        it('gives each feature its own object, so editing one cannot mutate another', () => {
            const first = DEFAULT_SETTINGS.features.chat;
            const second = DEFAULT_SETTINGS.features.chat_gastronomy;

            expect(first).not.toBe(second);
        });
    });

    describe('FEATURE_LABELS', () => {
        it('has a non-empty label for every enum member', () => {
            for (const feature of AiFeatureSchema.options) {
                expect(FEATURE_LABELS[feature]?.length ?? 0).toBeGreaterThan(0);
            }
        });
    });

    describe('toFormValues', () => {
        it('returns every feature key when the server sends a partial blob', () => {
            const partial = {
                providers: { stub: { enabled: true } },
                features: {
                    chat: {
                        enabled: true,
                        primaryProvider: 'openai',
                        fallbackChain: [],
                        model: 'gpt-4o-mini',
                        params: {}
                    }
                }
            };

            const result = toFormValues(partial);

            expect(Object.keys(result.features).sort()).toEqual(ENUM_FEATURES);
        });

        it('preserves the operator values it did receive', () => {
            const partial = {
                providers: { stub: { enabled: true } },
                features: {
                    chat: {
                        enabled: true,
                        primaryProvider: 'openai',
                        fallbackChain: [],
                        model: 'gpt-4o-mini',
                        params: {}
                    }
                }
            };

            const result = toFormValues(partial);

            expect(result.features.chat?.enabled).toBe(true);
            expect(result.features.chat?.primaryProvider).toBe('openai');
        });

        it('fills a feature the server omitted from the defaults', () => {
            const partial = {
                providers: { stub: { enabled: true } },
                features: {}
            };

            const result = toFormValues(partial);

            expect(result.features.chat_gastronomy?.enabled).toBe(false);
        });

        it('falls back to the full defaults when there is no blob at all', () => {
            expect(Object.keys(toFormValues(undefined).features).sort()).toEqual(ENUM_FEATURES);
        });
    });

    describe('playground feature coverage', () => {
        it('explains every feature it cannot drive', () => {
            for (const feature of AiFeatureSchema.options) {
                if (isPlaygroundSupportedFeature(feature)) {
                    continue;
                }
                expect(PLAYGROUND_UNSUPPORTED_REASON[feature]?.length ?? 0).toBeGreaterThan(0);
            }
        });
    });
});
