/**
 * Catalog entries of the trial campaign outbox mails
 * (`createTrialCampaignRenderers`): the pre-expiry reminders and the
 * win-back series.
 *
 * The keys are `NotificationType` values reused by the outbox, so the catalog
 * key of each entry is `outbox.<notification-type>`. Each milestone gets two
 * scenarios: a named accommodation host and an anonymous tourist, which covers
 * the greeting and the vertical-dependent wording.
 *
 * @module catalog/entries/outbox-trial
 */

import { defineOutboxEntry } from '../define-entry.js';
import type { EmailCatalogEntry } from '../types.js';

type TrialCampaign = 'PRE_EXPIRY' | 'RECOVERY';

interface TrialMilestone {
    readonly template: string;
    readonly name: string;
    readonly campaign: TrialCampaign;
    readonly milestone: string;
    readonly offsetDays: number;
    readonly targetDate: string;
}

const MILESTONES: readonly TrialMilestone[] = [
    {
        template: 'trial_ending_10d',
        name: 'Prueba gratuita: faltan 10 días',
        campaign: 'PRE_EXPIRY',
        milestone: 'ENDING_10D',
        offsetDays: 10,
        targetDate: '2026-12-05'
    },
    {
        template: 'trial_ending_5d',
        name: 'Prueba gratuita: faltan 5 días',
        campaign: 'PRE_EXPIRY',
        milestone: 'ENDING_5D',
        offsetDays: 5,
        targetDate: '2026-12-10'
    },
    {
        template: 'trial_ending_2d',
        name: 'Prueba gratuita: faltan 2 días',
        campaign: 'PRE_EXPIRY',
        milestone: 'ENDING_2D',
        offsetDays: 2,
        targetDate: '2026-12-13'
    },
    {
        template: 'trial_ending_today',
        name: 'Prueba gratuita: termina hoy',
        campaign: 'PRE_EXPIRY',
        milestone: 'ENDING_TODAY',
        offsetDays: 0,
        targetDate: '2026-12-15'
    },
    {
        template: 'trial_win_back_1d',
        name: 'Recuperación de prueba: 1 día después',
        campaign: 'RECOVERY',
        milestone: 'WIN_BACK_1D',
        offsetDays: 1,
        targetDate: '2026-12-16'
    },
    {
        template: 'trial_win_back_5d',
        name: 'Recuperación de prueba: 5 días después',
        campaign: 'RECOVERY',
        milestone: 'WIN_BACK_5D',
        offsetDays: 5,
        targetDate: '2026-12-20'
    },
    {
        template: 'trial_win_back_15d',
        name: 'Recuperación de prueba: 15 días después',
        campaign: 'RECOVERY',
        milestone: 'WIN_BACK_15D',
        offsetDays: 15,
        targetDate: '2026-12-30'
    },
    {
        template: 'trial_win_back_30d',
        name: 'Recuperación de prueba: 30 días después',
        campaign: 'RECOVERY',
        milestone: 'WIN_BACK_30D',
        offsetDays: 30,
        targetDate: '2027-01-14'
    },
    {
        template: 'trial_win_back_60d',
        name: 'Recuperación de prueba: 60 días después',
        campaign: 'RECOVERY',
        milestone: 'WIN_BACK_60D',
        offsetDays: 60,
        targetDate: '2027-02-13'
    }
];

function trialEntry(milestone: TrialMilestone): EmailCatalogEntry {
    const base = {
        campaign: milestone.campaign,
        milestone: milestone.milestone,
        offsetDays: milestone.offsetDays,
        targetDate: milestone.targetDate
    };
    return defineOutboxEntry({
        template: milestone.template,
        name: milestone.name,
        domain: 'trial',
        scenarios: [
            {
                id: 'host-with-name',
                label: 'Anfitrión de alojamiento con nombre',
                input: {
                    payload: {
                        ...base,
                        recipientName: 'Ana Ejemplo',
                        verticals: ['accommodation']
                    }
                }
            },
            {
                id: 'tourist-without-name',
                label: 'Turista sin nombre',
                input: {
                    payload: {
                        ...base,
                        recipientName: null,
                        verticals: ['tourist']
                    }
                }
            }
        ]
    });
}

/** The nine trial campaign mails (four pre-expiry, five win-back). */
export const OUTBOX_TRIAL_ENTRIES: readonly EmailCatalogEntry[] = MILESTONES.map(trialEntry);
