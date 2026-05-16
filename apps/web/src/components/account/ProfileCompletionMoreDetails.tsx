/**
 * @file ProfileCompletionMoreDetails.tsx
 * @description Pure presentational subcomponent for the ProfileCompletion island.
 *
 * Renders the collapsible "Más detalles" section containing: bio (with char
 * counter), website, occupation, social-network 6-input grid, and location
 * (country dropdown + region + city).
 *
 * All state lives in `ProfileCompletion.client.tsx`. This component is a
 * pure controlled presentation layer.
 *
 * Not a `.client.tsx` — mounts inside the already-hydrated parent island.
 */

import {
    LOCATION_COUNTRIES,
    type ProfileCompletionFieldErrors,
    SOCIAL_PLATFORMS,
    type SocialPlatform
} from './ProfileCompletion.helpers';
import styles from './ProfileCompletion.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Props for the more-details subcomponent. */
export interface ProfileCompletionMoreDetailsProps {
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
    /** Field-level errors from the parent (bio, website, occupation). */
    readonly errors: ProfileCompletionFieldErrors;
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
    return (
        <div className={styles.detailsSection}>
            {/* ── Toggle button ─────────────────────────────────────── */}
            <button
                type="button"
                className={styles.detailsToggle}
                onClick={onDetailsToggle}
                aria-expanded={detailsOpen}
                aria-controls="pc-details-panel"
            >
                <span>
                    {t('account.profileCompletion.moreDetails.toggle', 'Más detalles')}{' '}
                    <span className={styles.detailsOptional}>
                        ({t('account.profileCompletion.moreDetails.optional', 'opcional')})
                    </span>
                </span>
                <span
                    className={styles.detailsChevron}
                    aria-hidden="true"
                >
                    {detailsOpen ? '▲' : '▼'}
                </span>
            </button>

            {/* ── Collapsible panel ─────────────────────────────────── */}
            {detailsOpen && (
                <div
                    id="pc-details-panel"
                    className={styles.detailsPanel}
                >
                    {/* Bio */}
                    <div className={styles.field}>
                        <label
                            htmlFor="pc-bio"
                            className={styles.label}
                        >
                            {t('account.profileCompletion.fields.bio', 'Bio')}
                        </label>
                        <textarea
                            id="pc-bio"
                            className={
                                errors.bio
                                    ? `${styles.textarea} ${styles.inputError}`
                                    : styles.textarea
                            }
                            value={bio}
                            onChange={(e) => onBioChange(e.target.value)}
                            placeholder={t(
                                'account.profileCompletion.fields.bioPlaceholder',
                                'Contanos un poco sobre vos (10-300 caracteres)'
                            )}
                            maxLength={300}
                            rows={3}
                            disabled={submitting}
                        />
                        <div className={styles.bioFooter}>
                            {errors.bio && (
                                <p
                                    className={styles.errorMsg}
                                    role="alert"
                                >
                                    {errors.bio}
                                </p>
                            )}
                            <span className={styles.charCount}>{bio.length}/300</span>
                        </div>
                    </div>

                    {/* Website */}
                    <div className={styles.field}>
                        <label
                            htmlFor="pc-website"
                            className={styles.label}
                        >
                            {t('account.profileCompletion.fields.website', 'Sitio web')}
                        </label>
                        <input
                            id="pc-website"
                            type="url"
                            className={
                                errors.website
                                    ? `${styles.input} ${styles.inputError}`
                                    : styles.input
                            }
                            value={website}
                            onChange={(e) => onWebsiteChange(e.target.value)}
                            placeholder="https://mipagina.com"
                            autoComplete="url"
                            disabled={submitting}
                        />
                        {errors.website && (
                            <p
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {errors.website}
                            </p>
                        )}
                    </div>

                    {/* Occupation */}
                    <div className={styles.field}>
                        <label
                            htmlFor="pc-occupation"
                            className={styles.label}
                        >
                            {t('account.profileCompletion.fields.occupation', 'Ocupación')}
                        </label>
                        <input
                            id="pc-occupation"
                            type="text"
                            className={
                                errors.occupation
                                    ? `${styles.input} ${styles.inputError}`
                                    : styles.input
                            }
                            value={occupation}
                            onChange={(e) => onOccupationChange(e.target.value)}
                            placeholder={t(
                                'account.profileCompletion.fields.occupationPlaceholder',
                                'Tu trabajo o profesión'
                            )}
                            maxLength={100}
                            disabled={submitting}
                        />
                        {errors.occupation && (
                            <p
                                className={styles.errorMsg}
                                role="alert"
                            >
                                {errors.occupation}
                            </p>
                        )}
                    </div>

                    {/* Social networks */}
                    <fieldset className={styles.socialFieldset}>
                        <legend className={styles.socialLegend}>
                            {t('account.profileCompletion.fields.socialNetworks', 'Redes sociales')}
                        </legend>
                        <div className={styles.socialGrid}>
                            {SOCIAL_PLATFORMS.map((platform) => (
                                <div
                                    key={platform.key}
                                    className={styles.field}
                                >
                                    <label
                                        htmlFor={`pc-social-${platform.key}`}
                                        className={styles.label}
                                    >
                                        {platform.label}
                                    </label>
                                    <input
                                        id={`pc-social-${platform.key}`}
                                        type="url"
                                        className={styles.input}
                                        value={socialNetworks[platform.key] ?? ''}
                                        onChange={(e) =>
                                            onSocialNetworkChange(platform.key, e.target.value)
                                        }
                                        placeholder={platform.placeholder}
                                        disabled={submitting}
                                    />
                                </div>
                            ))}
                        </div>
                    </fieldset>

                    {/* Location */}
                    <fieldset className={styles.socialFieldset}>
                        <legend className={styles.socialLegend}>
                            {t('account.profileCompletion.fields.location', 'Ubicación')}
                        </legend>
                        <div className={styles.locationGrid}>
                            <div className={styles.field}>
                                <label
                                    htmlFor="pc-location-country"
                                    className={styles.label}
                                >
                                    {t('account.profileCompletion.fields.locationCountry', 'País')}
                                </label>
                                <select
                                    id="pc-location-country"
                                    className={styles.select}
                                    value={locationCountry}
                                    onChange={(e) => onLocationCountryChange(e.target.value)}
                                    disabled={submitting}
                                >
                                    <option value="">
                                        {t(
                                            'account.profileCompletion.fields.locationCountryDefault',
                                            '— Seleccioná —'
                                        )}
                                    </option>
                                    {LOCATION_COUNTRIES.map((c) => (
                                        <option
                                            key={c.code}
                                            value={c.code}
                                        >
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.field}>
                                <label
                                    htmlFor="pc-location-region"
                                    className={styles.label}
                                >
                                    {t(
                                        'account.profileCompletion.fields.locationRegion',
                                        'Provincia / Estado'
                                    )}
                                </label>
                                <input
                                    id="pc-location-region"
                                    type="text"
                                    className={styles.input}
                                    value={locationRegion}
                                    onChange={(e) => onLocationRegionChange(e.target.value)}
                                    placeholder={t(
                                        'account.profileCompletion.fields.locationRegionPlaceholder',
                                        'Entre Ríos'
                                    )}
                                    disabled={submitting}
                                />
                            </div>
                            <div className={styles.field}>
                                <label
                                    htmlFor="pc-location-city"
                                    className={styles.label}
                                >
                                    {t('account.profileCompletion.fields.locationCity', 'Ciudad')}
                                </label>
                                <input
                                    id="pc-location-city"
                                    type="text"
                                    className={styles.input}
                                    value={locationCity}
                                    onChange={(e) => onLocationCityChange(e.target.value)}
                                    placeholder={t(
                                        'account.profileCompletion.fields.locationCityPlaceholder',
                                        'Concepción del Uruguay'
                                    )}
                                    disabled={submitting}
                                />
                            </div>
                        </div>
                    </fieldset>
                </div>
            )}
        </div>
    );
}
