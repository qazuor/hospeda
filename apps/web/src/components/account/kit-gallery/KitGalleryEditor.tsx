/**
 * KitGalleryEditor — the editor shell pieces in the kit gallery (HOS-2486,
 * HOS-2499): the section column, the switcher and the completeness meter.
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGalleryEditor
 */

import { useState } from 'react';
import {
    CompletenessMeter,
    EditorSectionNav,
    EditorSwitcher,
    HoursEditor,
    type HoursWeek
} from '@/components/account/ui';
import type { EditorNavGroup } from '@/lib/editor/editor-route-nav-model';
import { buildEditorSwitcherModel } from '@/lib/editor/editor-switcher-model';
import styles from './KitGallery.module.css';
import type { GalleryGroupProps } from './KitGalleryActions';
import { Visual } from './Visual';

/** A fixture editor nav: two groups, one active section, every status. */
const GROUPS: readonly EditorNavGroup[] = [
    {
        group: 'property',
        headingKey: 'host.properties.editor.group.property',
        links: [
            {
                sectionId: 'basicInfo',
                href: '#datos',
                labelKey: 'host.properties.editor.section.basicInfo',
                isActive: false,
                status: 'complete'
            },
            {
                sectionId: 'location',
                href: '#ubicacion',
                labelKey: 'host.properties.editor.section.location',
                isActive: true,
                status: 'incomplete'
            },
            {
                sectionId: 'contact',
                href: '#contacto',
                labelKey: 'host.properties.editor.section.contactSocial',
                isActive: false
            }
        ]
    },
    {
        group: 'content',
        headingKey: 'host.properties.editor.group.content',
        links: [
            {
                sectionId: 'photos',
                href: '#fotos',
                labelKey: 'host.properties.editor.section.photos',
                isActive: false,
                status: 'locked'
            }
        ]
    }
];

/**
 * The editor shell group of the gallery.
 *
 * @param props - See {@link GalleryGroupProps}.
 * @returns The group.
 */
export function KitGalleryEditor({ locale }: GalleryGroupProps) {
    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Editor shell</h2>
            <div className={styles.grid}>
                <Visual name="EditorSectionNav/statuses">
                    <EditorSectionNav
                        groups={GROUPS}
                        locale={locale}
                    />
                </Visual>
                <Visual name="EditorSwitcher/closed">
                    <EditorSwitcher
                        model={buildEditorSwitcherModel({ groups: GROUPS })}
                        entityName="Casa del Río"
                        locale={locale}
                    />
                </Visual>
                <Visual name="CompletenessMeter/missing">
                    <CompletenessMeter
                        done={1}
                        total={3}
                        missing={[
                            { id: 'capacityPricing', label: 'Capacidad y precio', href: '#cp' },
                            { id: 'photos', label: 'Fotos', href: '#fotos' }
                        ]}
                        locale={locale}
                    />
                </Visual>
                <Visual name="CompletenessMeter/complete">
                    <CompletenessMeter
                        done={3}
                        total={3}
                        missing={[]}
                        locale={locale}
                    />
                </Visual>
                <Visual name="HoursEditor/week">
                    <GalleryHours locale={locale} />
                </Visual>
            </div>
        </section>
    );
}

/** A week with two open days, one of them split, for the HoursEditor entry. */
const CLOSED_DAY = { closed: true, slots: [] } as const;

const GALLERY_WEEK: HoursWeek = {
    mon: { closed: false, slots: [{ open: '09:00', close: '18:00' }] },
    tue: CLOSED_DAY,
    wed: CLOSED_DAY,
    thu: CLOSED_DAY,
    fri: CLOSED_DAY,
    sat: {
        closed: false,
        slots: [
            { open: '10:00', close: '13:00' },
            { open: '17:00', close: '21:00' }
        ]
    },
    sun: CLOSED_DAY
};

/** Live HoursEditor so the gallery shows its interactions too. */
function GalleryHours({ locale }: GalleryGroupProps) {
    const [week, setWeek] = useState<HoursWeek>(GALLERY_WEEK);
    return (
        <HoursEditor
            locale={locale}
            idBase="kit-hours"
            value={week}
            onChange={setWeek}
        />
    );
}
