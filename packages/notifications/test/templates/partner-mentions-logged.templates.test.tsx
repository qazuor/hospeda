/**
 * PartnerMentionsLogged Email Template Test Suite (HOS-377 AC-9 / AC-3).
 *
 * The copy contract is the point of this feature, so that is what this pins
 * hardest. Hospeda logs what the team DID and measures nothing about how it
 * performed, so the email may never speak the language of metrics — not the
 * banned words, and not softer phrasings that promise the same thing.
 *
 * The rendering assertions matter for one reason: the link per channel IS the
 * verification the whole feature promises. A template that renders the channel
 * but drops the link keeps the promise in the copy and breaks it in the HTML.
 *
 * @module test/templates/partner-mentions-logged.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    PartnerMentionsLogged,
    type PartnerMentionsLoggedProps
} from '../../src/templates/alliance/partner-mentions-logged';

const batch: PartnerMentionsLoggedProps = {
    recipientName: 'Juan Pérez',
    partnerName: 'Acme Turismo',
    mentionedAtLabel: '1 de agosto de 2026',
    mentions: [
        { channelLabel: 'Instagram', url: 'https://instagram.test/p/abc' },
        { channelLabel: 'Facebook', url: 'https://facebook.test/posts/123' },
        { channelLabel: 'Newsletter', url: 'https://hospeda.test/newsletter/8' },
        { channelLabel: 'WhatsApp' }
    ]
};

const single: PartnerMentionsLoggedProps = {
    ...batch,
    mentions: [{ channelLabel: 'Instagram', url: 'https://instagram.test/p/abc' }]
};

describe('PartnerMentionsLogged — AC-3 copy constraint', () => {
    /**
     * The four words the spec bans outright. Checked case-insensitively and on
     * the RENDERED HTML, so a word introduced in a style, an alt text or a
     * preview string fails too.
     */
    const BANNED = ['alcance', 'impresion', 'clic', 'estadística', 'estadistica'];

    it('never speaks the language of metrics', () => {
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch)).toLowerCase();

        for (const word of BANNED) {
            expect(html).not.toContain(word);
        }
    });

    it('never promises a measurement in softer words either', () => {
        // The banned list catches the obvious phrasing. These are the ones that
        // slip past it while making exactly the same promise — a partner who
        // reads any of them will ask for the number behind it, and there is
        // none.
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch)).toLowerCase();

        for (const phrase of ['cuánta gente', 'cuanta gente', 'el impacto', 'rendimiento']) {
            expect(html).not.toContain(phrase);
        }
    });

    it('states what was DONE, and offers the link as the verification', () => {
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch));

        expect(html).toContain('difundimos');
        expect(html.toLowerCase()).toContain('verificar');
    });
});

describe('PartnerMentionsLogged — the links are the promise', () => {
    it('renders one link per channel that has one', () => {
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch));

        expect(html).toContain('https://instagram.test/p/abc');
        expect(html).toContain('https://facebook.test/posts/123');
        expect(html).toContain('https://hospeda.test/newsletter/8');
    });

    it('names every channel in the submission, including the linkless one', () => {
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch));

        for (const label of ['Instagram', 'Facebook', 'Newsletter', 'WhatsApp']) {
            expect(html).toContain(label);
        }
    });

    it('renders a linkless channel as a plain line, not a dead link', () => {
        // A WhatsApp broadcast has no public permalink. An <a> pointing nowhere
        // on an email whose promise is "go and check" is worse than no link.
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch));

        expect(html).not.toContain('href=""');
        expect(html).not.toContain('href="undefined"');
        expect(html).not.toContain('href="null"');
        // Exactly three anchors for four channels.
        expect(html.match(/<a\s/g) ?? []).toHaveLength(3);
    });

    it('names the partner and the date the promotion happened', () => {
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch));

        expect(html).toContain('Acme Turismo');
        expect(html).toContain('1 de agosto de 2026');
        expect(html).toContain('Juan Pérez');
    });
});

describe('PartnerMentionsLogged — one email covers the whole submission', () => {
    it('lists every channel of a four-network campaign in ONE email', () => {
        // AC-9 is enforced at the send site, but the template has to be able to
        // carry the whole batch or the caller would be pushed into sending one
        // email per row to say everything.
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch));

        expect(html.match(/<a\s/g) ?? []).toHaveLength(3);
        expect(html).toContain('los siguientes canales');
    });

    it('reads correctly for a single-channel submission', () => {
        const html = renderToStaticMarkup(PartnerMentionsLogged(single));

        expect(html).toContain('el siguiente canal');
        expect(html).not.toContain('los siguientes canales');
    });
});

describe('PartnerMentionsLogged — transactional behaviour', () => {
    it('does not render an unsubscribe link', () => {
        const html = renderToStaticMarkup(PartnerMentionsLogged(batch));

        expect(html).not.toContain('Administrar preferencias de notificaciones');
        expect(html).not.toContain('unsubscribe_url');
    });

    it('renders without errors', () => {
        expect(() => renderToStaticMarkup(PartnerMentionsLogged(batch))).not.toThrow();
    });
});
