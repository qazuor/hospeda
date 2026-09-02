/**
 * @file MeetingPointSection.client.tsx
 * @description Meeting-point fields of the commerce owner editor (HOS-1048).
 *
 * Where the experience STARTS — the address or the landmark the traveller has
 * to show up at. Neither of the two fields that look like they already answer
 * this actually does: `destinationId` is the city (it lists and filters, it
 * does not tell anyone where to stand) and `contactInfo` is the provider's own
 * phone and mail.
 *
 * ## Experience-only, by shape not by gate
 *
 * The orchestrator mounts this section only for the `experience` vertical, and
 * that is a SHAPE decision, not an entitlement one: `meetingPoint` exists on
 * `ExperienceOwnerUpdateInputSchema` and not on the gastronomy one, because a
 * restaurant's address is its address — it has no separate gathering spot. Do
 * not "generalise" it to both verticals without adding the columns on the
 * gastronomy side first; a field the schema strips saves nothing and reports
 * success.
 *
 * ## Nothing here is paid
 *
 * Owner decision (2026-09-01): the meeting point ships from the BASIC tier.
 * Knowing where to show up cannot be a paid feature — without it the listing
 * does not do its job. The paid half is the MAP that draws the coordinates and
 * the how-to-get-there instructions (HOS-1049), which is why the two lat/long
 * inputs live here and unpaid: they are the data, not the drawing.
 *
 * ## Why the coordinates are typed in by hand
 *
 * There is no map picker on this surface — a map is precisely what HOS-1049
 * adds, and it is gated. So the owner pastes the pair they can copy out of any
 * maps app, and both are optional: an owner who describes the spot in words and
 * never pins it leaves a perfectly valid listing. Null is "no coordinate", not
 * an error, all the way down to the column.
 */

import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { CommerceEditData, CommerceFieldChange } from './commerce-edit-data';
import styles from './editor-fields.module.css';
import { COMMERCE_FIELD_PREFIX } from './field-ids';

export interface MeetingPointSectionProps {
    readonly locale: SupportedLocale;
    readonly data: CommerceEditData;
    readonly errors: Readonly<{
        meetingPoint?: string;
        meetingPointLat?: string;
        meetingPointLong?: string;
    }>;
    readonly onFieldChange: CommerceFieldChange;
}

/**
 * Parses a coordinate input back to the form state's `number | null`.
 *
 * An empty box is `null` (the owner cleared the pin), NOT `0` — the equator off
 * the coast of Africa is a real place, and `Number('')` returning `0` would
 * silently drop a listing there. Anything unparseable is also `null`: the field
 * is `type="number"`, so the only way to reach this with junk is a browser that
 * hands over a partial value mid-typing.
 *
 * @param raw - The raw input value.
 * @returns The parsed coordinate, or `null` when the field is empty/unparseable.
 */
export function parseCoordinateInput({ raw }: { readonly raw: string }): number | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Renders a coordinate as an input value.
 *
 * `null` renders as an empty string rather than `'null'` or `'0'`, which keeps
 * the control genuinely empty when there is no pin.
 *
 * @param value - The stored coordinate, or `null`.
 * @returns A string safe to hand a controlled `<input type="number">`.
 */
export function coordinateInputValue({ value }: { readonly value: number | null }): string {
    return value === null ? '' : String(value);
}

export function MeetingPointSection({
    locale,
    data,
    errors,
    onFieldChange
}: MeetingPointSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <section
            className={styles.section}
            id="editor-meetingPoint"
        >
            <TextField
                prefix={COMMERCE_FIELD_PREFIX}
                name="meetingPoint"
                label={t('commerce.owner.editor.sections.meetingPoint', 'Punto de encuentro')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors.meetingPoint}
                type="text"
                maxLength={300}
                value={data.meetingPoint}
                placeholder={t(
                    'commerce.owner.editor.sections.meetingPointPlaceholder',
                    'Ej: Muelle 3 del puerto, frente a la caseta azul'
                )}
                onChange={(event) => {
                    onFieldChange('meetingPoint', event.target.value);
                }}
            />

            <p className={styles.hint}>
                {t(
                    'commerce.owner.editor.sections.meetingPointHint',
                    'Dónde arranca la experiencia. Puede ser una dirección o una referencia del lugar.'
                )}
            </p>

            <TextField
                prefix={COMMERCE_FIELD_PREFIX}
                name="meetingPointLat"
                label={t('commerce.owner.editor.sections.meetingPointLat', 'Latitud (opcional)')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors.meetingPointLat}
                type="number"
                step="any"
                min={-90}
                max={90}
                value={coordinateInputValue({ value: data.meetingPointLat })}
                placeholder="-32.4825"
                onChange={(event) => {
                    onFieldChange(
                        'meetingPointLat',
                        parseCoordinateInput({ raw: event.target.value })
                    );
                }}
            />

            <TextField
                prefix={COMMERCE_FIELD_PREFIX}
                name="meetingPointLong"
                label={t('commerce.owner.editor.sections.meetingPointLong', 'Longitud (opcional)')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors.meetingPointLong}
                type="number"
                step="any"
                min={-180}
                max={180}
                value={coordinateInputValue({ value: data.meetingPointLong })}
                placeholder="-58.2333"
                onChange={(event) => {
                    onFieldChange(
                        'meetingPointLong',
                        parseCoordinateInput({ raw: event.target.value })
                    );
                }}
            />

            <p className={styles.hint}>
                {t(
                    'commerce.owner.editor.sections.meetingPointCoordsHint',
                    'Si cargás las coordenadas, más adelante podemos mostrar el punto en un mapa. Podés dejarlas vacías.'
                )}
            </p>
        </section>
    );
}
