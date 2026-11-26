/**
 * @file ListingLocationSection.tsx
 * @description The ONE location section of both owner editors (HOS-2496, spec
 * HOS-2415 §6.8, D7 «fusión», D12 «mapa en ubicación y punto de encuentro»).
 *
 * It serves the accommodation `ubicacion` page, the venue `ubicacion` page and
 * the experience `punto-de-encuentro` page. What differs by vertical is a
 * parameter, never a branch on a vertical:
 *
 * - `address` is optional: an accommodation and a venue store a postal address
 *   (street, number, floor, apartment); a meeting point does not. Each member
 *   carries its own Zod key and label, so ids, focus-on-error and the PATCH
 *   contract stay those of the engine that renders it.
 * - `finder` is optional: the accommodation editor keeps its address search and
 *   «use my location» helpers ({@link EditorLocationFinder}).
 * - `lead` and `trail` hold fields only one vertical has (the meeting-point
 *   text before the map, the directions after it).
 * - `description` carries the privacy copy: an accommodation's exact address is
 *   never public (visitors see an approximate pin), a venue's is.
 *
 * The pin itself is always {@link EditorMapPin}: Leaflet behind a touch
 * overlay, with the raw coordinates under «Coordenadas».
 *
 * Without a pin, ONE notice at the top of the section says what it costs and
 * what to do, with a button that scrolls to the map and focuses it (owner
 * decision 12, Mi cuenta UI epic). The map itself no longer repeats it.
 */

import { type JSX, type ReactNode, useRef } from 'react';
import { EditorSection } from '@/components/account/editor-shell/EditorSection';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Field } from '@/components/account/ui/Field';
import type { HelpAnchor } from '@/components/account/ui/help-anchor';
import { TextInput } from '@/components/account/ui/TextInput';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './EditorFields.module.css';
import { EditorLocationFinder, type FoundLocation } from './EditorLocationFinder';
import {
    EditorMapPin,
    focusEditorMap,
    type MapPinCoordinate,
    parseMapCoordinate
} from './EditorMapPin';

/** One postal-address input: its Zod key, label, value and constraints. */
export interface AddressMember {
    /** The Zod key (also the field id name), e.g. `street` or `location.street`. */
    readonly name: string;
    /** Visible label, already translated. */
    readonly label: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly error?: string;
    readonly maxLength?: number;
    /** Shows «(opcional)» next to the label. */
    readonly optional?: boolean;
}

/** The map pin: both coordinates and the setter that receives them together. */
export interface LocationPin {
    readonly lat: MapPinCoordinate;
    readonly long: MapPinCoordinate;
    /** Receives both coordinates together, as strings. */
    readonly onChange: (next: { readonly lat: string; readonly long: string }) => void;
    /** Accessible name of the map. */
    readonly mapLabel: string;
}

/** The address search and «use my location» helpers. */
export interface LocationFinderOptions {
    /**
     * Receives the street and number a picked suggestion carried. Only the
     * parts the geocoder returned are passed; the rest stays as typed (H-117).
     */
    readonly onAddressFound: (found: {
        readonly street?: string;
        readonly number?: string;
    }) => void;
}

/** Props of {@link ListingLocationSection}. */
export interface ListingLocationSectionProps {
    readonly locale: SupportedLocale;
    /** The editor's field id namespace (`acc`, `ce`). */
    readonly idPrefix: string;
    /** DOM id of the section (the editor nav anchor). */
    readonly sectionId?: string;
    readonly title: string;
    /** Copy under the title (what is public and what is not). */
    readonly description?: string;
    readonly helpId: HelpAnchor;
    /** Omit when the vertical stores no postal address. */
    readonly address?: readonly AddressMember[];
    /** Omit when the vertical has no address search. */
    readonly finder?: LocationFinderOptions;
    readonly pin: LocationPin;
    /** Fields rendered before the address (e.g. the meeting-point text). */
    readonly lead?: ReactNode;
    /** Fields rendered after the map (e.g. the directions). */
    readonly trail?: ReactNode;
}

/**
 * The shared location section.
 *
 * @param props - See {@link ListingLocationSectionProps}.
 * @returns A kit `Section` with the vertical's address, finder and map pin.
 */
export function ListingLocationSection({
    locale,
    idPrefix,
    sectionId,
    title,
    description,
    helpId,
    address,
    finder,
    pin,
    lead,
    trail
}: ListingLocationSectionProps): JSX.Element {
    const t = createT(locale);
    const mapFrameRef = useRef<HTMLDivElement>(null);
    const latNumber = parseMapCoordinate({ value: pin.lat.value });
    const longNumber = parseMapCoordinate({ value: pin.long.value });
    const current =
        latNumber !== null && longNumber !== null ? { lat: latNumber, lng: longNumber } : null;

    const handleFound = (found: FoundLocation) => {
        pin.onChange({ lat: String(found.lat), long: String(found.lng) });
        if (finder && (found.street || found.number)) {
            finder.onAddressFound({ street: found.street, number: found.number });
        }
    };

    return (
        <EditorSection
            locale={locale}
            id={sectionId}
            title={title}
            description={description}
            helpId={helpId}
        >
            <div className={styles.stack}>
                {current ? null : (
                    <Alert
                        tone="warning"
                        locale={locale}
                        title={t('account.editorFields.location.noPinNotice.title')}
                    >
                        <div className={styles.stack}>
                            <p>{t('account.editorFields.location.noPinNotice.body')}</p>
                            <div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => focusEditorMap({ frame: mapFrameRef.current })}
                                >
                                    {t('account.editorFields.location.noPinNotice.action')}
                                </Button>
                            </div>
                        </div>
                    </Alert>
                )}
                {lead}
                {address && address.length > 0 ? (
                    <div className={styles.grid}>
                        {address.map((member) => (
                            <Field
                                key={member.name}
                                locale={locale}
                                label={member.label}
                                id={buildFieldId({ prefix: idPrefix, name: member.name })}
                                error={member.error}
                                optional={member.optional}
                            >
                                <TextInput
                                    type="text"
                                    maxLength={member.maxLength}
                                    value={member.value}
                                    onChange={(event) => member.onChange(event.target.value)}
                                />
                            </Field>
                        ))}
                    </div>
                ) : null}
                {finder ? (
                    <EditorLocationFinder
                        locale={locale}
                        idPrefix={idPrefix}
                        pin={current}
                        onFound={handleFound}
                    />
                ) : null}
                <EditorMapPin
                    locale={locale}
                    idPrefix={idPrefix}
                    mapLabel={pin.mapLabel}
                    lat={pin.lat}
                    long={pin.long}
                    onChange={pin.onChange}
                    frameRef={mapFrameRef}
                />
                {trail}
            </div>
        </EditorSection>
    );
}
