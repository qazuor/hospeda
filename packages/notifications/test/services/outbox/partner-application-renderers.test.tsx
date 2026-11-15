import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
    createPartnerApplicationRenderers,
    PartnerClaimNoticeNotIssuableError
} from '../../../src/services/outbox/partner-application-renderers.js';
import { row } from './outbox-batch.harness.js';

const claimTemplate = 'verticals.partner-claim-notice';
const rejectedTemplate = 'verticals.partner-application-rejected';
const validClaim = { partnerId: 'partner-1', partnerName: 'Hostería', locale: 'es' };
const secret = 'private-secret';

function makeRenderers() {
    const issueClaimSecret = vi.fn(async () => ({ secret }));
    const resolveCopy = vi.fn(() => ({
        subject: 'Partner subject',
        preview: 'Partner preview',
        heading: 'Approved Partner',
        paragraphs: ['Manage this Partner.'],
        cta: 'Claim Partner'
    }));
    return {
        renderers: createPartnerApplicationRenderers({
            siteUrl: 'https://hospeda.test/',
            issueClaimSecret,
            resolveCopy
        }),
        issueClaimSecret,
        resolveCopy
    };
}

describe('partner application outbox renderers', () => {
    it.each([
        ['partnerId', { partnerId: '' }],
        ['partnerName', { partnerName: '' }],
        ['locale', { locale: 'fr' }],
        ['extra key', { secret: 'unexpected' }]
    ])('rejects invalid claim payload field %s before issuing a secret', async (_field, patch) => {
        const { renderers, issueClaimSecret } = makeRenderers();
        await expect(
            renderers[claimTemplate]!({
                row: row({ template: claimTemplate, payload: { ...validClaim, ...patch } })
            })
        ).rejects.toThrow(TypeError);
        expect(issueClaimSecret).not.toHaveBeenCalled();
    });

    it('throws the not-issuable error when the Partner cannot be claimed', async () => {
        const issueClaimSecret = vi.fn(async () => null);
        const renderers = createPartnerApplicationRenderers({
            siteUrl: 'https://hospeda.test',
            issueClaimSecret,
            resolveCopy: () => ({ subject: '', preview: '', heading: '', paragraphs: [], cta: '' })
        });
        await expect(
            renderers[claimTemplate]!({
                row: row({ template: claimTemplate, payload: validClaim })
            })
        ).rejects.toBeInstanceOf(PartnerClaimNoticeNotIssuableError);
    });

    it('renders the fragment link and resolved copy without putting the secret in the subject', async () => {
        const { renderers, resolveCopy } = makeRenderers();
        const result = await renderers[claimTemplate]!({
            row: row({ template: claimTemplate, payload: validClaim })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe('Partner subject');
        expect(result.subject).not.toContain(secret);
        expect(html).toContain(
            `https://hospeda.test/es/partners/reclamar/#partner=partner-1&amp;secret=${secret}`
        );
        expect(html).toContain('Approved Partner');
        expect(html).toContain('Manage this Partner.');
        expect(resolveCopy).toHaveBeenCalledWith({
            kind: 'claim-notice',
            locale: 'es',
            partnerName: 'Hostería'
        });
    });

    it('rejects an invalid rejected-mail instant', async () => {
        const { renderers } = makeRenderers();
        expect(() =>
            renderers[rejectedTemplate]!({
                row: row({
                    template: rejectedTemplate,
                    payload: {
                        applicationId: 'application-1',
                        reapplyAfter: 'tomorrow',
                        locale: 'es'
                    }
                })
            })
        ).toThrow(TypeError);
    });
});
