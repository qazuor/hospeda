/**
 * @file ProfileCompletionMoreDetails.tsx
 * @description Pure presentational subcomponent for the ProfileCompletion island.
 *
 * Renders the collapsible "Más detalles" block (kit fields, HOS-2501) containing: bio (with char
 * counter), website, occupation, social-network 6-input grid, and location
 * (country dropdown + region + city).
 *
 * All state lives in `ProfileCompletion.client.tsx`. This component is a
 * pure controlled presentation layer.
 *
 * Not a `.client.tsx` — mounts inside the already-hydrated parent island.
 */

import { ChevronDownIcon, ChevronUpIcon } from '@repo/icons';
import type { FieldErrors } from '@/lib/forms/field-errors';
import type { SupportedLocale } from '@/lib/i18n';
import {
    LOCATION_COUNTRIES,
    SOCIAL_PLATFORMS,
    type SocialPlatform
} from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';
import { PcSelectField, PcTextField } from './ProfileCompletionFields';
import { Button, Field, Textarea } from './ui';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the more-details subcomponent. */
export interface ProfileCompletionMoreDetailsProps {
    /** Active locale, for the kit fields' fixed copy. */
    readonly locale: SupportedLocale;
    /** Whether the collapsible panel is open. */
    readonly detailsOpen: boolean;
    /** Bio text value. */
    readonly bio: string;
    /** Website URL value. */
    readonly website: string;
    /** Occupation text value. */
    readonly occupation: string;
    /** Map of social network platform keys to URL strings. */
    readonly socialNetworks: Partial<Record<SocialPlatform, string>>;
    /** ISO country code or empty string. */
    readonly locationCountry: string;
    /** Region/state text or empty string. */
    readonly locationRegion: string;
    /** City text or empty string. */
    readonly locationCity: string;
    /**
     * Field-level errors from the parent, keyed by the real
     * `CompleteProfileBodySchema` field path (`bio`, `website`, `occupation`,
     * `socialNetworks.<platform>`, `location.country`).
     */
    readonly errors: FieldErrors;
    /** Whether the form is currently submitting (disables all inputs). */
    readonly submitting: boolean;
    /** Translation function from the parent island. */
    readonly t: (key: string, fallback: string) => string;
    /** Toggle the collapsible panel open/closed. */
    readonly onDetailsToggle: () => void;
    /** Handler for bio changes. */
    readonly onBioChange: (value: string) => void;
    /** Handler for website changes. */
    readonly onWebsiteChange: (value: string) => void;
    /** Handler for occupation changes. */
    readonly onOccupationChange: (value: string) => void;
    /** Handler for a specific social network URL change. */
    readonly onSocialNetworkChange: (platform: SocialPlatform, value: string) => void;
    /** Handler for location country change. */
    readonly onLocationCountryChange: (value: string) => void;
    /** Handler for location region change. */
    readonly onLocationRegionChange: (value: string) => void;
    /** Handler for location city change. */
    readonly onLocationCityChange: (value: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * More-details collapsible section subcomponent.
 *
 * Renders optional fields (bio, website, occupation, socials, location) inside
 * a toggle-able panel. All state is owned by the parent island.
 *
 * @param props - Component props (see {@link ProfileCompletionMoreDetailsProps})
 */
export function ProfileCompletionMoreDetails({
    locale,
    detailsOpen,
    bio,
    website,
    occupation,
    socialNetworks,
    locationCountry,
    locationRegion,
    locationCity,
    errors,
    submitting,
    t,
    onDetailsToggle,
    onBioChange,
    onWebsiteChange,
    onOccupationChange,
    onSocialNetworkChange,
    onLocationCountryChange,
    onLocationRegionChange,
    onLocationCityChange
}: ProfileCompletionMoreDetailsProps) {
    const Chevron = detailsOpen ? ChevronUpIcon : ChevronDownIcon;
    return (
        <div className={styles.stack}>
            {/* ── Toggle button ─────────────────────────────────────── */}
            <Button
                variant="secondary"
                onClick={onDetailsToggle}
                aria-expanded={detailsOpen}
                aria-controls="pc-details-panel"
                className={styles.detailsToggle}
            >
                {t('account.profileCompletion.moreDetails.toggle', 'Más detalles')}{' '}
                <span className={styles.detailsOptional}>
                    ({t('account.profileCompletion.moreDetails.optional', 'opcional')})
                </span>
                <Chevron
                    size="sm"
                    aria-hidden="true"
                />
            </Button>

            {/* ── Collapsible panel ─────────────────────────────────── */}
            {detailsOpen && (
                <div
                    id="pc-details-panel"
                    className={styles.stack}
                >
                    {/* Bio */}
                    <Field
                        label={t('account.profileCompletion.fields.bio', 'Bio')}
                        locale={locale}
                        idParts={{ prefix: 'pc', name: 'bio' }}
                        error={errors.bio}
                    >
                        <Textarea
                            value={bio}
                            onChange={(e) => onBioChange(e.target.value)}
                            placeholder={t(
                                'account.profileCompletion.fields.bioPlaceholder',
                                'Contanos un poco sobre vos (10-300 caracteres)'
                            )}
                            limit={300}
                            locale={locale}
                            rows={3}
                            disabled={submitting}
                        />
                    </Field>

                    {/* Website */}
                    <PcTextField
                        name="website"
                        type="url"
                        label={t('account.profileCompletion.fields.website', 'Sitio web')}
                        locale={locale}
                        value={website}
                        onChange={onWebsiteChange}
                        error={errors.website}
                        placeholder="https://mipagina.com"
                        autoComplete="url"
                        disabled={submitting}
                    />

                    {/* Occupation */}
                    <PcTextField
                        name="occupation"
                        label={t('account.profileCompletion.fields.occupation', 'Ocupación')}
                        locale={locale}
                        value={occupation}
                        onChange={onOccupationChange}
                        error={errors.occupation}
                        placeholder={t(
                            'account.profileCompletion.fields.occupationPlaceholder',
                            'Tu trabajo o profesión'
                        )}
                        maxLength={100}
                        disabled={submitting}
                    />

                    {/* Social networks */}
                    <fieldset className={styles.fieldset}>
                        <legend className={styles.legend}>
                            {t('account.profileCompletion.fields.socialNetworks', 'Redes sociales')}
                        </legend>
                        <div className={styles.grid}>
                            {SOCIAL_PLATFORMS.map((platform) => (
                                <PcTextField
                                    key={platform.key}
                                    name={`social-${platform.key}`}
                                    type="url"
                                    label={platform.label}
                                    locale={locale}
                                    value={socialNetworks[platform.key] ?? ''}
                                    onChange={(value) => onSocialNetworkChange(platform.key, value)}
                                    error={errors[`socialNetworks.${platform.key}`]}
                                    placeholder={platform.placeholder}
                                    disabled={submitting}
                                />
                            ))}
                        </div>
                    </fieldset>

                    {/* Location */}
                    <fieldset className={styles.fieldset}>
                        <legend className={styles.legend}>
                            {t('account.profileCompletion.fields.location', 'Ubicación')}
                        </legend>
                        <div className={styles.grid}>
                            <PcSelectField
                                name="location-country"
                                label={t(
                                    'account.profileCompletion.fields.locationCountry',
                                    'País'
                                )}
                                locale={locale}
                                value={locationCountry}
                                onChange={onLocationCountryChange}
                                error={errors['location.country']}
                                disabled={submitting}
                                options={[
                                    {
                                        value: '',
                                        label: t(
                                            'account.profileCompletion.fields.locationCountryDefault',
                                            '— Seleccioná —'
                                        )
                                    },
                                    ...LOCATION_COUNTRIES.map((c) => ({
                                        value: c.code,
                                        label: c.label
                                    }))
                                ]}
                            />
                            <PcTextField
                                name="location-region"
                                label={t(
                                    'account.profileCompletion.fields.locationRegion',
                                    'Provincia / Estado'
                                )}
                                locale={locale}
                                value={locationRegion}
                                onChange={onLocationRegionChange}
                                placeholder={t(
                                    'account.profileCompletion.fields.locationRegionPlaceholder',
                                    'Entre Ríos'
                                )}
                                disabled={submitting}
                            />
                            <PcTextField
                                name="location-city"
                                label={t('account.profileCompletion.fields.locationCity', 'Ciudad')}
                                locale={locale}
                                value={locationCity}
                                onChange={onLocationCityChange}
                                placeholder={t(
                                    'account.profileCompletion.fields.locationCityPlaceholder',
                                    'Concepción del Uruguay'
                                )}
                                disabled={submitting}
                            />
                        </div>
                    </fieldset>
                </div>
            )}
        </div>
    );
}
