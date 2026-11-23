/**
 * Tests for the kit help anchors (HOS-2413 T-003).
 *
 * Pins the anchor grammar (`section:<vertical>.<slug>`, the same shape
 * `parseHelpAnchor` of `@repo/help` accepts) and that `helpAttr` never renders `data-help="undefined"`.
 */

import { describe, expect, it } from 'vitest';
import { parseHelpAnchor } from '../../../../../../packages/help/src/anchors';
import { helpAttr, isHelpAnchor } from '../../../../src/components/account/ui';

describe('isHelpAnchor', () => {
    it.each([
        'section:venue.carta',
        'section:accommodation.fotos-de-la-propiedad',
        'section:hosttrade.benefits',
        'section:tourist.alerts'
    ])('accepts %s', (value) => {
        // Arrange + Act
        const result = isHelpAnchor(value);

        // Assert
        expect(result).toBe(true);
    });

    it.each([
        ['an empty string', ''],
        ['no prefix', 'venue.carta'],
        ['the wrong prefix', 'page:venue.carta'],
        ['no slug', 'section:venue'],
        ['an empty slug', 'section:venue.'],
        ['an empty vertical', 'section:.carta'],
        ['uppercase', 'section:Venue.carta'],
        ['camelCase', 'section:venue.saveDisabled'],
        ['underscores', 'section:venue.save_disabled'],
        ['a trailing hyphen', 'section:venue.carta-'],
        ['a double hyphen', 'section:venue.ca--rta'],
        ['an element suffix', 'section:venue.carta#save-disabled'],
        ['a hyphenated vertical', 'section:host-trade.datos'],
        ['a dotted-hyphen vertical', 'section:owner-messages.list'],
        ['a third dot segment', 'section:venue.carta.extra'],
        ['spaces', 'section:venue.carta #x'],
        ['surrounding whitespace', ' section:venue.carta']
    ])('rejects %s', (_label, value) => {
        // Arrange + Act
        const result = isHelpAnchor(value);

        // Assert
        expect(result).toBe(false);
    });

    it.each([
        undefined,
        null,
        42,
        {},
        ['section:venue.carta']
    ])('rejects non-string %j', (value) => {
        expect(isHelpAnchor(value)).toBe(false);
    });
});

describe('helpAttr', () => {
    it('returns the data-help attribute when a help id is given', () => {
        // Arrange
        const helpId = 'section:venue.carta' as const;

        // Act
        const attr = helpAttr({ helpId });

        // Assert
        expect(attr).toEqual({ 'data-help': 'section:venue.carta' });
    });

    it('returns an empty object without a help id, never data-help="undefined"', () => {
        // Arrange + Act
        const attr = helpAttr({});

        // Assert
        expect(attr).toEqual({});
        expect('data-help' in attr).toBe(false);
    });
});

describe('isHelpAnchor agrees with parseHelpAnchor', () => {
    it.each([
        'section:venue.carta',
        'section:venue.carta#save-disabled',
        'section:host-trade.datos',
        'section:messages.owner-list',
        'section:hosttrade.datos',
        'section:venue.',
        'section:.carta',
        'section:a.b.c',
        'section:Venue.carta',
        'section:venue.ca--rta'
    ])('on %s', (value) => {
        // Arrange + Act
        const expected = parseHelpAnchor({ anchor: value })?.kind === 'section';

        // Assert
        expect(isHelpAnchor(value)).toBe(expected);
    });
});
