/**
 * Template selectors of the trial notification types.
 *
 * Covers: The legacy trial reminder and the Hospeda-owned trial series (HOS-1012).
 *
 * Moved verbatim out of `NotificationService.selectTemplate` (HOS-2519 D6), so
 * the production send and the admin email preview map a payload to the same
 * component with the same props. A type with a template but no selector here
 * renders nothing and the email is silently never sent.
 *
 * @module services/notification-templates/trial
 */

import {
    TrialEnding1Day,
    TrialEnding5Days,
    TrialEnding10Days,
    TrialEndingReminder,
    TrialExpired,
    TrialWinBack1Day,
    TrialWinBack5Days,
    TrialWinBack10Days,
    TrialWinBack30Days,
    TrialWinBack60Days
} from '../../templates/index.js';
import type { TrialEventPayload, TrialSeriesPayload } from '../../types/notification.types.js';
import type { NotificationTemplateSelectors } from './types.js';

/** Selectors of the trial notification types. */
export const TRIAL_NOTIFICATION_TEMPLATES: NotificationTemplateSelectors = {
    trial_ending_reminder: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialEventPayload;
        return TrialEndingReminder({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            daysRemaining: p.daysRemaining,
            upgradeUrl: p.upgradeUrl
        });
    },
    // ── HOS-1012: the nine sends of the Hospeda-owned trial series ───
    //
    // Nine cases and nine templates, not one case switching on a day
    // count. The whole point of the redesign is that these read as nine
    // different messages; routing them through one component would make
    // that impossible to hold, and the ninefold repetition below is the
    // cheapest possible way to keep each send's copy independently
    // editable. The argument list is identical because the payload
    // shape is (`TrialSeriesPayload`) — the difference lives in the
    // template, which is where a reader looks for it.
    trial_ending_10d: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialEnding10Days({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    },
    trial_ending_5d: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialEnding5Days({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    },
    trial_ending_1d: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialEnding1Day({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    },
    trial_expired: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialExpired({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    },
    trial_win_back_1d: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialWinBack1Day({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    },
    trial_win_back_5d: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialWinBack5Days({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    },
    trial_win_back_10d: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialWinBack10Days({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    },
    trial_win_back_30d: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialWinBack30Days({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    },
    trial_win_back_60d: ({ payload }) => {
        const { recipientName } = payload;
        const p = payload as TrialSeriesPayload;
        return TrialWinBack60Days({
            recipientName,
            planName: p.planName,
            trialEndDate: p.trialEndDate,
            upgradeUrl: p.upgradeUrl,
            productDomain: p.productDomain
        });
    }
};
