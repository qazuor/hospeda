import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createTrialCampaignRenderers } from '../../../src/services/outbox/trial-campaign-renderers.js';
import { NotificationType } from '../../../src/types/notification.types.js';
import { row } from './outbox-batch.harness.js';

const types = [
    NotificationType.TRIAL_ENDING_10D,
    NotificationType.TRIAL_ENDING_5D,
    NotificationType.TRIAL_ENDING_2D,
    NotificationType.TRIAL_ENDING_TODAY,
    NotificationType.TRIAL_WIN_BACK_1D,
    NotificationType.TRIAL_WIN_BACK_5D,
    NotificationType.TRIAL_WIN_BACK_15D,
    NotificationType.TRIAL_WIN_BACK_30D,
    NotificationType.TRIAL_WIN_BACK_60D
];
const renderers = createTrialCampaignRenderers({ siteUrl: 'https://hospeda.test' });

function campaignRow(
    template: string,
    campaign: 'PRE_EXPIRY' | 'RECOVERY',
    offsetDays: number,
    targetDate: string
) {
    const milestone = campaign === 'PRE_EXPIRY' ? `pre:-${offsetDays}d` : `rec:+${offsetDays}d`;
    return row({
        template,
        payload: {
            campaign,
            milestone,
            offsetDays,
            targetDate,
            recipientName: 'Ana',
            verticals: ['accommodation', 'venue', 'experience']
        }
    });
}

describe('trial campaign outbox renderers', () => {
    it('registers only the nine scheduled templates', () => {
        expect(Object.keys(renderers).sort()).toEqual([...types].sort());
    });

    it('renders every template with a subject and all consolidated verticals', async () => {
        const cases = [
            [types[0]!, 'PRE_EXPIRY', 10, '2026-10-10'],
            [types[1]!, 'PRE_EXPIRY', 5, '2026-10-10'],
            [types[2]!, 'PRE_EXPIRY', 2, '2026-10-10'],
            [types[3]!, 'PRE_EXPIRY', 0, '2026-10-10'],
            [types[4]!, 'RECOVERY', 1, '2026-10-10'],
            [types[5]!, 'RECOVERY', 5, '2026-10-10'],
            [types[6]!, 'RECOVERY', 15, '2026-10-10'],
            [types[7]!, 'RECOVERY', 30, '2026-10-10'],
            [types[8]!, 'RECOVERY', 60, '2026-10-10']
        ] as const;
        for (const [template, campaign, offset, target] of cases) {
            const result = await renderers[template]!({
                row: campaignRow(template, campaign, offset, target)
            });
            const html = renderToStaticMarkup(result.react);
            expect(result.subject.length).toBeGreaterThan(0);
            expect(html).toContain('Alojamiento');
            expect(html).toContain('Gastronomía');
            expect(html).toContain('Experiencias');
        }
    });

    it('uses the scheduled target date arithmetic and the first vertical pricing route', async () => {
        const before = await renderers[NotificationType.TRIAL_ENDING_2D]!({
            row: campaignRow(NotificationType.TRIAL_ENDING_2D, 'PRE_EXPIRY', 2, '2026-10-18')
        });
        const recovery = await renderers[NotificationType.TRIAL_WIN_BACK_15D]!({
            row: campaignRow(NotificationType.TRIAL_WIN_BACK_15D, 'RECOVERY', 15, '2026-11-04')
        });
        expect(renderToStaticMarkup(before.react)).toContain('20 de octubre de 2026');
        expect(renderToStaticMarkup(recovery.react)).toContain('20 de octubre de 2026');
        expect(renderToStaticMarkup(before.react)).toContain(
            'https://hospeda.test/es/planes/anfitriones/precios/'
        );
    });

    it.each([
        { verticals: undefined },
        { verticals: [] },
        { targetDate: undefined }
    ])('rejects incomplete campaign payloads', (override) => {
        const payload = {
            campaign: 'PRE_EXPIRY',
            milestone: 'pre:-2d',
            offsetDays: 2,
            targetDate: '2026-10-18',
            recipientName: 'Ana',
            verticals: ['accommodation'],
            ...override
        };
        expect(() =>
            renderers[NotificationType.TRIAL_ENDING_2D]!({
                row: row({ template: NotificationType.TRIAL_ENDING_2D, payload })
            })
        ).toThrow();
    });
});
