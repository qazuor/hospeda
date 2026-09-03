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
 * ## One page, two tiers
 *
 * Owner decision (2026-09-01): the meeting point ships from the BASIC tier.
 * Knowing where to show up cannot be a paid feature — without it the listing
 * does not do its job. That covers the address field and both coordinates: they
 * are the data, not the drawing.
 *
 * The how-to-get-there instructions added by HOS-1049 are the paid half, and
 * they live on this same page rather than a new one: "where do we meet, and how
 * do you get there" is one errand, and a separate nav item would have made the
 * entitlement look like a different subject instead of a deeper tier.
 *
 * The gate is `data.meetingPointDirectionsEnabled`, resolved live by the
 * protected `getById` off the provider's CURRENT plan. An unentitled provider
 * still SEES the field, read-only, with what they had written: hiding it would
 * make a downgrade look like data loss, and hiding it from someone who never
 * had it would make a paid feature invisible to the only person who could buy
 * it. The API refuses the write independently (`manage_experience_directions`),
 * so this control being read-only is an affordance, not the enforcement.
 *
 * ## Why the coordinates are typed in by hand
 *
 * There is no map PICKER on this surface. HOS-1049 draws a map on the public
 * ficha, not an editor widget, so the owner pastes the pair they can copy out
 * of any maps app, and both stay optional: an owner who describes the spot in
 * words and never pins it leaves a perfectly valid listing. Null is "no
 * coordinate", not an error, all the way down to the column.
 */

import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { CommerceEditData, CommerceFieldChange } from './commerce-edit-data';
import styles from './editor-fields.module.css';
import { COMMERCE_FIELD_PREFIX } from './field-ids';
import { checklistItemsToLines, linesToChecklistItems } from './PracticalInfoSection.client';

export interface MeetingPointSectionProps {
    readonly locale: SupportedLocale;
    readonly data: CommerceEditData;
    readonly errors: Readonly<{
        meetingPoint?: string;
        meetingPointLat?: string;
        meetingPointLong?: string;
        meetingPointDirections?: string;
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
                    'Si cargás las coordenadas, mostramos el punto en un mapa. Podés dejarlas vacías.'
                )}
            </p>

            {/*
             * HOS-1049 — the paid half. Rendered for every experience provider,
             * `disabled` for the ones whose plan does not grant it, so a
             * downgrade does not read as data loss and the capability is
             * visible to the person who could buy it. The API refuses the write
             * on its own; this attribute is the affordance, not the gate.
             */}
            <TextField
                as="textarea"
                prefix={COMMERCE_FIELD_PREFIX}
                name="meetingPointDirections"
                label={t('commerce.owner.editor.sections.meetingPointDirections', 'Cómo llegar')}
                labelClassName={styles.label}
                className={styles.textarea}
                error={errors.meetingPointDirections}
                rows={4}
                disabled={!data.meetingPointDirectionsEnabled}
                value={checklistItemsToLines({ items: data.meetingPointDirections })}
                placeholder={t(
                    'commerce.owner.editor.sections.meetingPointDirectionsPlaceholder',
                    'Estacioná en la bajada municipal, sobre la costanera\nEl colectivo 4 te deja en la rotonda\nSon 300 m por camino de ripio, buscá el muelle de madera'
                )}
                onChange={(event) => {
                    onFieldChange(
                        'meetingPointDirections',
                        linesToChecklistItems({ raw: event.target.value })
                    );
                }}
            />

            <p className={styles.hint}>
                {data.meetingPointDirectionsEnabled
                    ? t(
                          'commerce.owner.editor.sections.meetingPointDirectionsHint',
                          'Una indicación por línea. Dónde estacionar, qué colectivo, cuánto se camina desde la ruta, qué referencia buscar.'
                      )
                    : t(
                          'commerce.owner.editor.sections.meetingPointDirectionsLocked',
                          'El mapa y las indicaciones de cómo llegar no están incluidos en tu plan. El punto de encuentro sí, y se sigue publicando.'
                      )}
            </p>
        </section>
    );
}
