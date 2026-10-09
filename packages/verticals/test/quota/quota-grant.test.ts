import { describe, expect, it } from 'vitest';
import { selectQuotaGrant } from '../../src/quota/quota-grant';
import { at, KEY, source } from './fixtures';

describe('AC:V3:8 — quota grant and anchor', () => {
    it('a complement adds quota but never anchors, and is discarded without a live non-trial title', () => {
        expect(
            selectQuotaGrant({
                key: KEY,
                sources: [
                    source('SUBSCRIPTION', at('2026-01-15'), 100),
                    source('ADDON', at('2026-01-01'), 50)
                ]
            })
        ).toEqual({ quota: 150, anchor: at('2026-01-15') });
        expect(
            selectQuotaGrant({
                key: KEY,
                sources: [
                    source('TRIAL', at('2026-01-10'), 100),
                    source('ADDON', at('2026-01-01'), 50)
                ]
            })
        ).toEqual({ quota: 100, anchor: at('2026-01-10') });
    });

    it('two live titles sum quota and the oldest anchors', () => {
        expect(
            selectQuotaGrant({
                key: KEY,
                sources: [
                    source('SUBSCRIPTION', at('2026-01-20'), 300),
                    source('TRIAL', at('2026-01-05'), 100)
                ]
            })
        ).toEqual({ quota: 400, anchor: at('2026-01-05') });
    });

    it('BASE anchors at account signup only when it grants a measured key', () => {
        expect(
            selectQuotaGrant({ key: KEY, sources: [source('BASE', at('2026-01-03'), 20)] })
        ).toEqual({ quota: 20, anchor: at('2026-01-03') });
        expect(
            selectQuotaGrant({
                key: KEY,
                sources: [{ ...source('BASE', at('2026-01-03'), 20), grants: [] }]
            })
        ).toBeNull();
    });

    it('NOT_STARTED and unmetered infinity never anchor', () => {
        expect(
            selectQuotaGrant({ key: KEY, sources: [source('TRIAL', 'NOT_STARTED', 100)] })
        ).toBeNull();
        expect(
            selectQuotaGrant({ key: KEY, sources: [source('BASE', at('2026-01-03'), Infinity)] })
        ).toBeNull();
    });
});
