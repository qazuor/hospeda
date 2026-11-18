/**
 * @file venue-whatsapp-transform.test.ts
 * @description `toVenueDetailPageProps` keeps the WhatsApp block fail-closed
 * (HOS-2256, AC-18): the number survives only for `PUBLIC`, and an unknown or
 * malformed block means no button.
 */
import { describe, expect, it } from 'vitest';
import { toVenueDetailPageProps } from '@/lib/api/transforms';

const item = (whatsapp: unknown): Record<string, unknown> => ({
    id: 'v-1',
    slug: 'bar',
    name: 'El Bar',
    type: 'BAR',
    whatsapp
});

describe('toVenueDetailPageProps — whatsapp', () => {
    it('keeps the number of a PUBLIC block', () => {
        const props = toVenueDetailPageProps({
            item: item({ mode: 'PUBLIC', number: ' +54 9 343 1234567 ' })
        });

        expect(props.whatsapp).toEqual({ mode: 'PUBLIC', number: '+54 9 343 1234567' });
    });

    it('drops a number smuggled into a LOGGED_IN_ONLY block', () => {
        const props = toVenueDetailPageProps({
            item: item({ mode: 'LOGGED_IN_ONLY', number: '+54 9 343 1234567' })
        });

        expect(props.whatsapp).toEqual({ mode: 'LOGGED_IN_ONLY' });
        expect(JSON.stringify(props.whatsapp)).not.toContain('1234567');
    });

    it.each([
        ['absent', undefined],
        ['null', null],
        ['a string', '+54 9 343 1234567'],
        ['an array', []],
        ['PUBLIC without a number', { mode: 'PUBLIC' }],
        ['PUBLIC with a blank number', { mode: 'PUBLIC', number: '  ' }],
        ['an unknown mode', { mode: 'EVERYONE', number: '+54 9 343 1234567' }]
    ])('yields no button for %s', (_name, raw) => {
        expect(toVenueDetailPageProps({ item: item(raw) }).whatsapp).toBeNull();
    });
});
