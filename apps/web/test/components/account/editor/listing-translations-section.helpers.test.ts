import { describe, expect, it } from 'vitest';
import {
    aiButtonStateFor,
    isSaveEnabled,
    isSaveVisible,
    type ListingTranslationPairState,
    needsReview,
    pillLabelKeyFor,
    pillToneFor
} from '@/components/account/editor/listing-translations-section.helpers';

const STATES: readonly ListingTranslationPairState[] = [
    'auto',
    'manual',
    'stale',
    'pending',
    'noQuota',
    'noEntitlement',
    'noSource'
];

describe('listing translations section helpers (spec §6.1)', () => {
    it.each([
        ['auto', 'success'],
        ['manual', 'info'],
        ['stale', 'warning'],
        ['pending', 'neutral'],
        ['noQuota', 'warning'],
        ['noEntitlement', 'neutral'],
        ['noSource', 'neutral']
    ] as const)('pill tone of %s is %s', (state, tone) => {
        expect(pillToneFor({ state })).toEqual({ tone });
    });

    it.each(STATES)('pill label of %s is its state key', (state) => {
        expect(pillLabelKeyFor({ state, value: 'Some text' })).toEqual({
            key: `account.editorTranslations.state.${state}`
        });
    });

    it('an empty manual pair says the Spanish text is shown', () => {
        expect(pillLabelKeyFor({ state: 'manual', value: '  ' })).toEqual({
            key: 'account.editorTranslations.state.manualEmpty'
        });
    });

    it.each([
        'auto',
        'manual',
        'stale',
        'pending'
    ] as const)('AI button is enabled for %s when AI is available', (state) => {
        expect(aiButtonStateFor({ state, aiStatus: 'available' })).toEqual({ enabled: true });
    });

    it('AI button is disabled with the quota reason', () => {
        expect(aiButtonStateFor({ state: 'noQuota', aiStatus: 'quota' })).toEqual({
            enabled: false,
            reasonKey: 'account.editorTranslations.action.translateAiDisabled.noQuota'
        });
        expect(aiButtonStateFor({ state: 'manual', aiStatus: 'quota' })).toEqual({
            enabled: false,
            reasonKey: 'account.editorTranslations.action.translateAiDisabled.noQuota'
        });
    });

    it('AI button is disabled with the entitlement reason', () => {
        expect(aiButtonStateFor({ state: 'noEntitlement', aiStatus: 'entitlement' })).toEqual({
            enabled: false,
            reasonKey: 'account.editorTranslations.action.translateAiDisabled.noEntitlement'
        });
    });

    it('a missing Spanish source wins over the plan reasons', () => {
        expect(aiButtonStateFor({ state: 'noSource', aiStatus: 'entitlement' })).toEqual({
            enabled: false,
            reasonKey: 'account.editorTranslations.action.translateAiDisabled.noSource'
        });
        expect(aiButtonStateFor({ state: 'noSource', aiStatus: 'available' })).toEqual({
            enabled: false,
            reasonKey: 'account.editorTranslations.action.translateAiDisabled.noSource'
        });
    });

    it.each([
        'auto',
        'manual',
        'pending',
        'noQuota',
        'noEntitlement'
    ] as const)('save of %s follows the draft dirtiness', (state) => {
        expect(isSaveEnabled({ state, dirty: false })).toEqual({ enabled: false });
        expect(isSaveEnabled({ state, dirty: true })).toEqual({ enabled: true });
    });

    it('a stale pair can be saved without changes (confirms the review)', () => {
        expect(isSaveEnabled({ state: 'stale', dirty: false })).toEqual({ enabled: true });
        expect(isSaveEnabled({ state: 'stale', dirty: true })).toEqual({ enabled: true });
    });

    it('save is hidden and disabled without a Spanish source', () => {
        expect(isSaveVisible({ state: 'noSource' })).toEqual({ visible: false });
        expect(isSaveEnabled({ state: 'noSource', dirty: true })).toEqual({ enabled: false });
        for (const state of STATES.filter((value) => value !== 'noSource')) {
            expect(isSaveVisible({ state })).toEqual({ visible: true });
        }
    });

    it('only behind or stale pairs count for review', () => {
        expect(STATES.filter((state) => needsReview({ state }).needsReview)).toEqual([
            'stale',
            'pending',
            'noQuota',
            'noEntitlement'
        ]);
    });
});
