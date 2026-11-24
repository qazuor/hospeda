/**
 * @file template-tag.test.ts
 * @description The `template:<key>` Brevo tag round trip (HOS-2583).
 */
import { describe, expect, it } from 'vitest';
import {
    buildEmailTemplateTag,
    EMAIL_TEMPLATE_TAG_PREFIX,
    parseEmailTemplateTag
} from '../src/template-tag.js';

describe('template tag', () => {
    it('builds the tag from a catalog key', () => {
        expect(buildEmailTemplateTag({ templateKey: 'auth.reset-password' })).toBe(
            'template:auth.reset-password'
        );
    });

    it('round-trips a key through the tags array a Brevo webhook echoes', () => {
        const tags = [
            'category:transactional',
            buildEmailTemplateTag({ templateKey: 'conversation.verify' })
        ];

        expect(parseEmailTemplateTag({ tags })).toBe('conversation.verify');
    });

    it.each([
        ['undefined', undefined],
        ['a string', 'template:x'],
        ['an empty array', []],
        ['tags without ours', ['transac_messages', 'env:prod']],
        ['an empty key', [EMAIL_TEMPLATE_TAG_PREFIX]],
        ['non-string entries', [42, null, { a: 1 }]]
    ])('answers null for %s', (_label, tags) => {
        expect(parseEmailTemplateTag({ tags })).toBeNull();
    });
});
