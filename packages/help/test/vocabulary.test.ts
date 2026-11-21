/**
 * HOS-2410 (`docs/data-model.md` §2.2, §5) — the shape rules the catalog is
 * written in: anchors, tokens, link targets and the vertical list.
 *
 * @module test/vocabulary
 */

import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { parseHelpAnchor } from '../src/anchors';
import { HELP_VERTICALS } from '../src/constants';
import { helpDestinationTemplate } from '../src/destination-template';
import { HELP_LINK_TARGETS, resolveHelpLinkTarget } from '../src/link-targets';
import { parseHelpTokens, replaceHelpTokens } from '../src/tokens';

describe('parseHelpAnchor', () => {
    it.each([
        ['page:mi-cuenta/suscripcion', 'page'],
        ['page:mi-cuenta/consultas-propietario/[conversationId]', 'page'],
        ['section:accommodation.politicas', 'section'],
        ['entitlement:manage_venue_menu', 'entitlement'],
        ['limit:max_photos_per_accommodation', 'limit'],
        ['enum:PublicationStatus.MODERATED', 'enum'],
        ['enum:SubscriptionStatus.GRACE_PERIOD', 'enum'],
        ['tool:get_help', 'tool'],
        ['activation:venue', 'activation'],
        ['file:apps/web/src/components/host/editor/forms/PoliciesForm.client.tsx', 'file']
    ])('accepts %s', (anchor, kind) => {
        expect(parseHelpAnchor({ anchor })?.kind).toBe(kind);
    });

    it.each([
        'nope:x',
        'page:/mi-cuenta',
        'page:mi-cuenta/',
        'page:es/mi-cuenta/Suscripcion',
        'section:venue',
        'enum:Other.X',
        'enum:PublicationStatus.moderated',
        'file:../secret',
        'file:/etc/passwd',
        'tool:',
        'page'
    ])('rejects %s', (anchor) => {
        expect(parseHelpAnchor({ anchor })).toBeUndefined();
    });
});

describe('parseHelpTokens', () => {
    it('splits a text into tokens with kind, args and label', () => {
        // Act
        const { tokens, errors } = parseHelpTokens({
            text: 'Ver {{link:plans:venue|los planes}} y {{article:photos:problemas-comunes}}.'
        });

        // Assert
        expect(errors).toEqual([]);
        expect(tokens).toEqual([
            {
                kind: 'link',
                args: ['plans', 'venue'],
                label: 'los planes',
                raw: '{{link:plans:venue|los planes}}'
            },
            {
                kind: 'article',
                args: ['photos', 'problemas-comunes'],
                raw: '{{article:photos:problemas-comunes}}'
            }
        ]);
    });

    it.each([
        ['an unknown kind', '{{price:10}}'],
        ['no argument', '{{link}}'],
        ['an empty argument', '{{link:plans:}}'],
        ['an empty label', '{{link:faq|}}'],
        ['a label over 80 characters', `{{link:faq|${'x'.repeat(81)}}}`],
        ['an unclosed token', 'Ver {{link:faq'],
        ['a stray closing brace pair', 'Ver }} ahora']
    ])('reports %s', (_label, text) => {
        expect(parseHelpTokens({ text }).errors).toHaveLength(1);
    });

    it('replaces only the well-formed tokens', () => {
        expect(
            replaceHelpTokens({
                text: 'a {{link:faq}} b {{nope}} c',
                replace: (token) => token.kind
            })
        ).toBe('a link b {{nope}} c');
    });
});

describe('resolveHelpLinkTarget', () => {
    it('resolves every target of the table to a destination with a page template', () => {
        for (const name of Object.keys(HELP_LINK_TARGETS) as Array<
            keyof typeof HELP_LINK_TARGETS
        >) {
            // Arrange
            const arity = HELP_LINK_TARGETS[name].arity;
            const args =
                arity === 'none'
                    ? [name]
                    : arity === 'vertical'
                      ? [name, 'venue']
                      : [name, 'venue', 'carta'];

            // Act
            const resolved = resolveHelpLinkTarget({ args });

            // Assert
            expect(resolved.ok, name).toBe(true);
            if (resolved.ok) {
                expect(helpDestinationTemplate({ destination: resolved.destination })).not.toBe('');
            }
        }
    });

    it.each([
        [['section', 'venue', 'carta'], 'mi-cuenta/comercio/[vertical]/[id]/editar/carta'],
        [['section', 'accommodation', 'fotos'], 'mi-cuenta/propiedades/[id]/editar/fotos'],
        [['plans', 'accommodation'], 'planes/anfitriones'],
        [['list', 'experience'], 'mi-cuenta/comercio'],
        [['create', 'venue'], 'publicar/comer-y-salir'],
        [['inquiries'], 'mi-cuenta/consultas-propietario'],
        [['help'], 'mi-cuenta/ayuda']
    ])('resolves %j to the page %s', (args, template) => {
        const resolved = resolveHelpLinkTarget({ args });
        expect(resolved.ok && helpDestinationTemplate({ destination: resolved.destination })).toBe(
            template
        );
    });

    it.each([
        [['nowhere']],
        [['plans']],
        [['plans', 'tourist']],
        [['plans', 'venue', 'extra']],
        [['faq', 'extra']],
        [['section', 'venue']],
        [['section', 'venue', 'calendario']],
        [['section', 'accommodation', 'politicas']]
    ])('rejects %j', (args) => {
        expect(resolveHelpLinkTarget({ args }).ok).toBe(false);
    });
});

describe('HELP_VERTICALS', () => {
    it('is every VerticalEnum value but tourist', () => {
        expect([...HELP_VERTICALS].sort()).toEqual(
            Object.values(VerticalEnum)
                .filter((vertical) => vertical !== VerticalEnum.TOURIST)
                .sort()
        );
    });
});
