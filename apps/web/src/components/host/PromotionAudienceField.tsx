/**
 * @file PromotionAudienceField.tsx
 * @description Who sees a promotion (HOS-2589 M-1, US-1): a two-option radio group
 * shared by the accommodation and venue promotion forms.
 *
 * - «Para todos» (default) explains the random free quota with X read from the
 *   catalog; «Solo VIP» explains the VIP-only reach (and names the VIP plan when the
 *   catalog has it). No number or plan name is written in code (G7, AC-1, AC-4).
 * - Without `vip_only_promotions` the «Solo VIP» radio is disabled with a lock, the
 *   «Disponible en planes superiores» text and a link to the plans page (AC-25). An
 *   existing «Solo VIP» promotion keeps its value (D-8); the API refuses a new one.
 */

import { LockIcon } from '@repo/icons';
import { TouristAudienceEnum } from '@repo/schemas';
import { Radio, RadioGroup } from '@/components/account/ui';
import type { SupportedLocale } from '@/lib/i18n';
import styles from './PromotionAudienceField.module.css';

/** Translator signature the forms use (`t(key, fallback, params)`). */
type Translate = (key: string, fallback?: string, params?: Record<string, unknown>) => string;

/** The two audiences a host can pick. */
export type PromotionAudience = `${TouristAudienceEnum}`;

/** Props of {@link PromotionAudienceField}. */
export interface PromotionAudienceFieldProps {
    readonly locale: SupportedLocale;
    readonly t: Translate;
    /** Name of the radio group (unique per form). */
    readonly name: string;
    readonly value: PromotionAudience;
    readonly onChange: (value: PromotionAudience) => void;
    /** X, the TOURIST floor plan's `max_free_visible_promotions`; `null` when unreadable. */
    readonly freeQuota: number | null;
    /** The tourist plan that makes a tourist VIP; `null` when unreadable. */
    readonly vipPlanName: string | null;
    /** Whether the owner's plan grants `vip_only_promotions` in this vertical. */
    readonly vipOnlyAllowed: boolean;
    /** The owner plans page, for the locked state's link. */
    readonly plansHref: string;
}

/**
 * Renders the audience radio group.
 *
 * @param props - See {@link PromotionAudienceFieldProps}.
 * @returns The radio group.
 */
export function PromotionAudienceField({
    locale,
    t,
    name,
    value,
    onChange,
    freeQuota,
    vipPlanName,
    vipOnlyAllowed,
    plansHref
}: PromotionAudienceFieldProps) {
    const plusDescription =
        freeQuota === null
            ? t('host.promotions.audience.plusDescriptionNoQuota')
            : t(
                  `host.promotions.audience.plusDescription${freeQuota === 1 ? '_one' : '_other'}`,
                  undefined,
                  { count: freeQuota }
              );
    const vipDescription = vipPlanName
        ? t('host.promotions.audience.vipDescriptionPlan', undefined, { plan: vipPlanName })
        : t('host.promotions.audience.vipDescription');
    // D-8: a «Solo VIP» promotion of an owner who lost the key keeps showing its value.
    const vipDisabled = !vipOnlyAllowed && value !== TouristAudienceEnum.VIP;

    return (
        <RadioGroup
            legend={t('host.promotions.audience.legend')}
            locale={locale}
            name={name}
            value={value}
            onValueChange={(next) =>
                onChange(
                    next === TouristAudienceEnum.VIP
                        ? TouristAudienceEnum.VIP
                        : TouristAudienceEnum.PLUS
                )
            }
        >
            <Radio
                value={TouristAudienceEnum.PLUS}
                label={t('host.promotions.audience.plusLabel')}
                description={plusDescription}
            />
            <Radio
                value={TouristAudienceEnum.VIP}
                label={t('host.promotions.audience.vipLabel')}
                description={vipDescription}
                disabled={vipDisabled}
            />
            {vipOnlyAllowed ? null : (
                <p
                    className={styles.locked}
                    data-testid="promotion-audience-vip-locked"
                >
                    <LockIcon
                        size="sm"
                        aria-hidden="true"
                    />
                    <span>{t('host.promotions.audience.vipLocked')}</span>
                    <a href={plansHref}>{t('host.promotions.audience.vipLockedLink')}</a>
                </p>
            )}
        </RadioGroup>
    );
}
