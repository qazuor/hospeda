/**
 * @file MeetingPointSection.client.tsx
 * @description Meeting-point fields of the listing owner editor (HOS-1048).
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
 * `ExperienceOwnerUpdateInputSchema` and not on the venue one, because a
 * restaurant's address is its address — it has no separate gathering spot. Do
 * not "generalise" it to both verticals without adding the columns on the
 * venue side first; a field the schema strips saves nothing and reports
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
import fieldStyles from '@/components/account/editor-fields/EditorFields.module.css';
import { EditorMapPin } from '@/components/account/editor-fields/EditorMapPin';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Textarea } from '@/components/account/ui/Textarea';
import { TextInput } from '@/components/account/ui/TextInput';
import { LISTING_FIELD_PREFIX } from '@/components/listing/editor/field-ids';
import type {
    ListingEditData,
    ListingFieldChange
} from '@/components/listing/editor/listing-edit-data';
import {
    checklistItemsToLines,
    linesToChecklistItems
} from '@/components/listing/editor/PracticalInfoSection.client';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { sectionHelpId } from '@/lib/help/section-help-id';
import { createT, type SupportedLocale } from '@/lib/i18n';

/** Props of {@link MeetingPointSection}. */
export interface MeetingPointSectionProps {
    readonly locale: SupportedLocale;
    readonly data: ListingEditData;
    readonly errors: Readonly<{
        meetingPoint?: string;
        meetingPointLat?: string;
        meetingPointLong?: string;
        meetingPointDirections?: string;
    }>;
    readonly onFieldChange: ListingFieldChange;
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
 * @returns A string safe to hand a controlled input.
 */
export function coordinateInputValue({ value }: { readonly value: number | null }): string {
    return value === null ? '' : String(value);
}

/**
 * The experience meeting point: where it starts, its map pin and, on plans
 * that grant it, how to get there (HOS-1049). On the kit since HOS-2496.
 *
 * @param props - Locale, form state, field errors and the change callback.
 * @returns A kit `Section`.
 */
export function MeetingPointSection({
    locale,
    data,
    errors,
    onFieldChange
}: MeetingPointSectionProps): JSX.Element {
    const t = createT(locale);
    const directionsEnabled = data.meetingPointDirectionsEnabled;

    return (
        <Section
            id="editor-meetingPoint"
            title={t('account.editorFields.location.meetingPointTitle')}
            helpId={sectionHelpId({ vertical: 'experience', slug: 'punto-de-encuentro' })}
        >
            <div className={fieldStyles.stack}>
                <Field
                    locale={locale}
                    label={t('account.editorFields.location.meetingPoint')}
                    hint={t('account.editorFields.location.meetingPointHint')}
                    id={buildFieldId({ prefix: LISTING_FIELD_PREFIX, name: 'meetingPoint' })}
                    error={errors.meetingPoint}
                >
                    <TextInput
                        type="text"
                        maxLength={300}
                        value={data.meetingPoint}
                        onChange={(event) => onFieldChange('meetingPoint', event.target.value)}
                    />
                </Field>
                {/* The pin is data, so it ships from the basic tier (owner decision 2026-09-01). */}
                <EditorMapPin
                    locale={locale}
                    idPrefix={LISTING_FIELD_PREFIX}
                    mapLabel={t('account.editorFields.location.meetingPointMapLabel')}
                    lat={{
                        name: 'meetingPointLat',
                        value: coordinateInputValue({ value: data.meetingPointLat }),
                        error: errors.meetingPointLat
                    }}
                    long={{
                        name: 'meetingPointLong',
                        value: coordinateInputValue({ value: data.meetingPointLong }),
                        error: errors.meetingPointLong
                    }}
                    onChange={(next) => {
                        onFieldChange('meetingPointLat', parseCoordinateInput({ raw: next.lat }));
                        onFieldChange('meetingPointLong', parseCoordinateInput({ raw: next.long }));
                    }}
                />
                {/*
                 * HOS-1049: the directions are the paid half. They render for
                 * every provider and lock when the plan does not grant them, so
                 * a downgrade does not read as data loss. The API refuses the
                 * write on its own; this is the affordance.
                 */}
                <Field
                    locale={locale}
                    label={t('account.editorFields.location.directions')}
                    hint={
                        directionsEnabled
                            ? t('account.editorFields.location.directionsHint')
                            : t('account.editorFields.location.directionsLocked')
                    }
                    id={buildFieldId({
                        prefix: LISTING_FIELD_PREFIX,
                        name: 'meetingPointDirections'
                    })}
                    error={errors.meetingPointDirections}
                    optional
                >
                    <Textarea
                        rows={4}
                        disabled={!directionsEnabled}
                        value={checklistItemsToLines({ items: data.meetingPointDirections })}
                        onChange={(event) =>
                            onFieldChange(
                                'meetingPointDirections',
                                linesToChecklistItems({ raw: event.target.value })
                            )
                        }
                    />
                </Field>
            </div>
        </Section>
    );
}
