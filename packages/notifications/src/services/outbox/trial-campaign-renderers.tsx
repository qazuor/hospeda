import type { EmailOutboxRow } from '@repo/db';
import {
    TrialEnding2Days,
    TrialEnding5Days,
    TrialEnding10Days,
    TrialEndingToday,
    TrialWinBack1Day,
    TrialWinBack5Days,
    TrialWinBack15Days,
    TrialWinBack30Days,
    TrialWinBack60Days
} from '../../templates/trial/index.js';
import type { TrialSeriesEmailProps } from '../../templates/trial/trial-series-shared.js';
import { NotificationType } from '../../types/notification.types.js';
import { getSubject } from '../../utils/subject-builder.js';
import type { OutboxMailRenderer } from './email-outbox-delivery.service.js';

const PRICING_SLUG: Readonly<Record<string, string>> = {
    accommodation: 'anfitriones',
    gastronomy: 'gastronomia',
    experience: 'experiencias',
    tourist: 'turistas'
};

/** Crea renderers tipados para los hitos de las campañas del trial. */
export function createTrialCampaignRenderers(input: {
    readonly siteUrl: string;
}): Readonly<Record<string, OutboxMailRenderer>> {
    function props(row: EmailOutboxRow): TrialSeriesEmailProps {
        const payload: unknown = row.payload;
        if (!payload || typeof payload !== 'object')
            throw new TypeError('El payload de campaña no es válido');
        const data = payload as Record<string, unknown>;
        if (
            (data.campaign !== 'PRE_EXPIRY' && data.campaign !== 'RECOVERY') ||
            typeof data.milestone !== 'string' ||
            typeof data.offsetDays !== 'number' ||
            !Number.isSafeInteger(data.offsetDays) ||
            data.offsetDays < 0 ||
            typeof data.targetDate !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(data.targetDate) ||
            (data.recipientName !== null && typeof data.recipientName !== 'string') ||
            !Array.isArray(data.verticals) ||
            data.verticals.length === 0 ||
            !data.verticals.every(
                (vertical) => typeof vertical === 'string' && Object.hasOwn(PRICING_SLUG, vertical)
            )
        )
            throw new TypeError('Faltan datos requeridos del payload de campaña');
        const target = new Date(`${data.targetDate}T00:00:00.000Z`);
        if (
            Number.isNaN(target.getTime()) ||
            target.toISOString().slice(0, 10) !== data.targetDate
        ) {
            throw new TypeError('La fecha objetivo no es válida');
        }
        const dayDirection = data.campaign === 'PRE_EXPIRY' ? data.offsetDays : -data.offsetDays;
        target.setUTCDate(target.getUTCDate() + dayDirection);
        const trialEndDate = target.toISOString().slice(0, 10);
        const verticals = data.verticals as string[];
        const slug = PRICING_SLUG[verticals[0] ?? ''];
        if (!slug) throw new TypeError('La primera vertical no tiene una ruta de precios');
        return {
            recipientName: typeof data.recipientName === 'string' ? data.recipientName : 'Hola',
            planName: 'tu plan de prueba',
            trialEndDate,
            productDomain: verticals[0],
            upgradeUrl: `${input.siteUrl.replace(/\/$/, '')}/es/planes/${slug}/precios/`,
            verticals
        };
    }
    function renderer(
        component: (props: TrialSeriesEmailProps) => React.ReactElement
    ): OutboxMailRenderer {
        return ({ row }) => {
            const emailProps = props(row);
            return {
                subject: getSubject(row.template as NotificationType, {}),
                react: component(emailProps)
            };
        };
    }
    return {
        [NotificationType.TRIAL_ENDING_10D]: renderer(TrialEnding10Days),
        [NotificationType.TRIAL_ENDING_5D]: renderer(TrialEnding5Days),
        [NotificationType.TRIAL_ENDING_2D]: renderer(TrialEnding2Days),
        [NotificationType.TRIAL_ENDING_TODAY]: renderer(TrialEndingToday),
        [NotificationType.TRIAL_WIN_BACK_1D]: renderer(TrialWinBack1Day),
        [NotificationType.TRIAL_WIN_BACK_5D]: renderer(TrialWinBack5Days),
        [NotificationType.TRIAL_WIN_BACK_15D]: renderer(TrialWinBack15Days),
        [NotificationType.TRIAL_WIN_BACK_30D]: renderer(TrialWinBack30Days),
        [NotificationType.TRIAL_WIN_BACK_60D]: renderer(TrialWinBack60Days)
    };
}
