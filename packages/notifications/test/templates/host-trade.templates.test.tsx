/**
 * The six benefit-usage and review email templates (HOS-376 T-040).
 *
 * Beyond "it renders", each test here pins a copy decision the spec argued for,
 * because copy is the one artefact where a well-meaning edit can quietly break
 * a rule the code still enforces:
 *
 * - The confirmation request must say what happens if it is IGNORED, and must
 *   not read as an accusation — rejecting has to stay as cheap as confirming.
 * - The reminder must say it is the only one.
 * - The confirmed email invites a review only when the recipient may actually
 *   write one.
 * - The moderated-reply email is the ONLY place a rejected provider ever sees
 *   the moderator's reason.
 *
 * @module test/templates/host-trade.templates.test
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
    ReplyModerated,
    ReviewReceived,
    UsageConfirmationReminder,
    UsageConfirmationRequest,
    UsageConfirmed,
    UsageRejected
} from '../../src/templates/host-trade/index.js';

const ACTION_URL = 'https://hospeda.com.ar/es/mi-cuenta/usos-de-beneficio';

describe('UsageConfirmationRequest', () => {
    const props = {
        recipientName: 'Marta Giménez',
        counterpartName: 'Plomería Acme',
        servicedAtLabel: '1 de agosto de 2026',
        expiresAtLabel: '31 de agosto de 2026',
        actionUrl: ACTION_URL
    };

    it('renders without throwing', () => {
        expect(() => renderToStaticMarkup(UsageConfirmationRequest(props))).not.toThrow();
    });

    it('names the counterpart, the date and the link to answer', () => {
        const html = renderToStaticMarkup(UsageConfirmationRequest(props));

        expect(html).toContain('Plomería Acme');
        expect(html).toContain('1 de agosto de 2026');
        expect(html).toContain(ACTION_URL);
    });

    /**
     * The one thing a recipient must not have to guess. Without it, silence
     * looks like an obligation left open forever instead of a record that
     * expires on its own.
     */
    it('says what happens if nobody answers', () => {
        const html = renderToStaticMarkup(UsageConfirmationRequest(props));

        expect(html).toContain('vence');
        expect(html).toContain('31 de agosto de 2026');
    });

    /**
     * Rejecting must stay as cheap as confirming (§6.5). The copy offers both
     * without loading either — a first contact written as a dispute would make
     * confirming feel like conceding.
     */
    it('offers rejecting as an ordinary answer', () => {
        const html = renderToStaticMarkup(UsageConfirmationRequest(props));

        expect(html.toLowerCase()).toContain('rechaz');
    });
});

describe('UsageConfirmationReminder', () => {
    const props = {
        recipientName: 'Marta Giménez',
        counterpartName: 'Plomería Acme',
        expiresAtLabel: '31 de agosto de 2026',
        actionUrl: ACTION_URL
    };

    it('renders without throwing', () => {
        expect(() => renderToStaticMarkup(UsageConfirmationReminder(props))).not.toThrow();
    });

    /**
     * AC-8 is one nudge, not a sequence. Saying so is what stops the recipient
     * reading silence as "they will keep writing until I answer".
     */
    it('says it is the only reminder', () => {
        const html = renderToStaticMarkup(UsageConfirmationReminder(props));

        expect(html).toContain('único recordatorio');
    });
});

describe('UsageConfirmed', () => {
    const base = {
        recipientName: 'Marta Giménez',
        counterpartName: 'Plomería Acme'
    };

    it('renders without throwing', () => {
        expect(() =>
            renderToStaticMarkup(UsageConfirmed({ ...base, canReview: false }))
        ).not.toThrow();
    });

    /**
     * THE CONDITIONAL INVITATION. Only a host may review, so a provider who
     * declared on his own listing must not be sent to a form that will refuse
     * him — copy must never promise behaviour the software does not have.
     */
    it('invites a review only when the recipient may write one', () => {
        const withReview = renderToStaticMarkup(
            UsageConfirmed({ ...base, canReview: true, reviewUrl: 'https://hospeda.com.ar/review' })
        );
        const without = renderToStaticMarkup(UsageConfirmed({ ...base, canReview: false }));

        expect(withReview).toContain('https://hospeda.com.ar/review');
        expect(withReview.toLowerCase()).toContain('valoración');
        expect(without).not.toContain('https://hospeda.com.ar/review');
    });

    /** A `canReview` with no URL must not render a broken button. */
    it('renders no invitation when the url is missing', () => {
        const html = renderToStaticMarkup(UsageConfirmed({ ...base, canReview: true }));

        expect(html).not.toContain('Dejar una valoración');
    });
});

describe('UsageRejected', () => {
    const base = { recipientName: 'Plomería Acme', counterpartName: 'Marta Giménez' };

    it('renders with and without a note', () => {
        expect(() => renderToStaticMarkup(UsageRejected(base))).not.toThrow();
        expect(() =>
            renderToStaticMarkup(UsageRejected({ ...base, note: 'Nunca vino a casa.' }))
        ).not.toThrow();
    });

    it('quotes the note when there is one, and shows no empty box when there is not', () => {
        const withNote = renderToStaticMarkup(
            UsageRejected({ ...base, note: 'Nunca vino a casa.' })
        );
        const without = renderToStaticMarkup(UsageRejected(base));

        expect(withNote).toContain('Nunca vino a casa.');
        expect(without).not.toContain('Nos dejaron esta nota');
    });

    /**
     * There is no dispute flow, so the copy points at a conversation and at the
     * undo that DOES exist, rather than at a button nobody built.
     */
    it('does not promise an appeal that does not exist', () => {
        const html = renderToStaticMarkup(UsageRejected(base)).toLowerCase();

        expect(html).not.toContain('apelar');
        expect(html).not.toContain('disputar');
    });
});

describe('ReviewReceived', () => {
    const base = {
        recipientName: 'Plomería Acme',
        listingName: 'Plomería Acme',
        overallRating: 4,
        actionUrl: ACTION_URL
    };

    it('renders without throwing', () => {
        expect(() =>
            renderToStaticMarkup(ReviewReceived({ ...base, respectedBenefit: true }))
        ).not.toThrow();
    });

    it('carries the rating and the link', () => {
        const html = renderToStaticMarkup(ReviewReceived({ ...base, respectedBenefit: true }));

        expect(html).toContain('4');
        expect(html).toContain(ACTION_URL);
    });

    /**
     * The answer the directory exists to collect (§6.3). It says one thing or
     * the opposite — never nothing — because a provider who ignored the benefit
     * is the failure mode this system has to surface.
     */
    it('states the benefit answer either way', () => {
        const honoured = renderToStaticMarkup(ReviewReceived({ ...base, respectedBenefit: true }));
        const not = renderToStaticMarkup(ReviewReceived({ ...base, respectedBenefit: false }));

        expect(honoured).toContain('respetaste el beneficio');
        expect(not).toContain('no se respetó el beneficio');
    });
});

describe('ReplyModerated', () => {
    const base = { recipientName: 'Plomería Acme', actionUrl: ACTION_URL };

    it('renders both outcomes', () => {
        expect(() =>
            renderToStaticMarkup(ReplyModerated({ ...base, outcome: 'approved' }))
        ).not.toThrow();
        expect(() =>
            renderToStaticMarkup(ReplyModerated({ ...base, outcome: 'rejected' }))
        ).not.toThrow();
    });

    /**
     * AC-24, and the reason this template cannot be simplified: the protected
     * read schema deliberately withholds the moderator's reason, so this email
     * is the ONLY place a rejected provider ever learns why.
     */
    it('carries the reason on a rejection', () => {
        const html = renderToStaticMarkup(
            ReplyModerated({ ...base, outcome: 'rejected', reason: 'Incluía un domicilio.' })
        );

        expect(html).toContain('Incluía un domicilio.');
    });

    /** An approval has nothing to explain, so it shows no reason box. */
    it('shows no reason box on an approval', () => {
        const html = renderToStaticMarkup(
            ReplyModerated({ ...base, outcome: 'approved', reason: 'no debería aparecer' })
        );

        expect(html).not.toContain('no debería aparecer');
        expect(html).not.toContain('El motivo fue');
    });

    /**
     * A rejected reply can be rewritten — editing returns it to the queue. The
     * copy says so because the reading a worried provider reaches for is the
     * wrong one: that he lost his only chance to answer a complaint.
     */
    it('tells a rejected provider they can try again', () => {
        const html = renderToStaticMarkup(ReplyModerated({ ...base, outcome: 'rejected' }));

        expect(html).toContain('No perdiste la posibilidad de responder');
    });
});
