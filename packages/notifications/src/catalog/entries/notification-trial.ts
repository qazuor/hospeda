/**
 * Catalog entries of the trial notifications
 * (`services/notification-templates/trial.ts`): the legacy trial reminder and
 * the Hospeda-owned trial series (HOS-1012).
 *
 * @module catalog/entries/notification-trial
 */

import {
    NotificationType,
    type TrialEventPayload,
    type TrialSeriesPayload
} from '../../types/notification.types.js';
import type { EmailScenarioList } from '../define-entry.js';
import { defineNotificationEntry } from '../define-entry.js';
import { SAMPLE_RECIPIENT } from '../sample-data.js';
import type { EmailCatalogEntry } from '../types.js';

/** The trial series types, i.e. the subset of `TrialSeriesPayload['type']` the catalog covers. */
type TrialSeriesType = TrialSeriesPayload['type'];

/**
 * Builds the scenarios of one trial-series send: the accommodation copy (the
 * default) and the venue copy, the two verticals whose wording differs.
 *
 * @param input - The notification type of the send.
 * @returns The scenario list.
 */
function buildTrialSeriesScenarios(input: {
    readonly type: TrialSeriesType;
}): EmailScenarioList<TrialSeriesPayload> {
    return [
        {
            id: 'accommodation',
            label: 'Alojamiento',
            input: {
                ...SAMPLE_RECIPIENT,
                type: input.type,
                planName: 'Plan Profesional',
                trialEndDate: '2026-02-15',
                upgradeUrl: 'https://hospeda.com.ar/es/planes/anfitriones/precios/',
                productDomain: 'accommodation'
            }
        },
        {
            id: 'venue',
            label: 'Comer y salir',
            input: {
                ...SAMPLE_RECIPIENT,
                type: input.type,
                planName: 'Plan Profesional',
                trialEndDate: '2026-02-15',
                upgradeUrl: 'https://hospeda.com.ar/es/planes/comer-y-salir/precios/',
                productDomain: 'venue'
            }
        }
    ];
}

/** The trial notifications. */
export const NOTIFICATION_TRIAL_ENTRIES: readonly EmailCatalogEntry[] = [
    defineNotificationEntry<TrialEventPayload>({
        type: NotificationType.TRIAL_ENDING_REMINDER,
        name: 'Recordatorio de fin de prueba',
        domain: 'trial',
        scenarios: [
            {
                id: 'with-days-remaining',
                label: 'Con días restantes',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.TRIAL_ENDING_REMINDER,
                    planName: 'Plan Profesional',
                    trialEndDate: '2026-02-15',
                    daysRemaining: 3,
                    upgradeUrl: 'https://hospeda.com.ar/es/planes/anfitriones/precios/'
                }
            },
            {
                id: 'without-days-remaining',
                label: 'Sin días restantes',
                input: {
                    ...SAMPLE_RECIPIENT,
                    type: NotificationType.TRIAL_ENDING_REMINDER,
                    planName: 'Plan Profesional',
                    trialEndDate: '2026-02-15',
                    upgradeUrl: 'https://hospeda.com.ar/es/planes/anfitriones/precios/'
                }
            }
        ]
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_ENDING_10D,
        name: 'Prueba: faltan 10 días',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_ENDING_10D })
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_ENDING_5D,
        name: 'Prueba: faltan 5 días',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_ENDING_5D })
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_ENDING_1D,
        name: 'Prueba: falta 1 día',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_ENDING_1D })
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_EXPIRED,
        name: 'Prueba vencida',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_EXPIRED })
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_WIN_BACK_1D,
        name: 'Reconquista: 1 día después',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_WIN_BACK_1D })
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_WIN_BACK_5D,
        name: 'Reconquista: 5 días después',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_WIN_BACK_5D })
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_WIN_BACK_10D,
        name: 'Reconquista: 10 días después',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_WIN_BACK_10D })
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_WIN_BACK_30D,
        name: 'Reconquista: 30 días después',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_WIN_BACK_30D })
    }),
    defineNotificationEntry<TrialSeriesPayload>({
        type: NotificationType.TRIAL_WIN_BACK_60D,
        name: 'Reconquista: 60 días después',
        domain: 'trial',
        scenarios: buildTrialSeriesScenarios({ type: NotificationType.TRIAL_WIN_BACK_60D })
    })
];
