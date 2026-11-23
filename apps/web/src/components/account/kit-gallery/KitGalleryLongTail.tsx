/**
 * Gallery group: the pieces the phase-5 long tail added (HOS-2502) — RatingStars,
 * FilterChips and CopyField.
 *
 * Dev-only fixture copy: exempt from i18n (see `Visual.tsx`).
 *
 * @module components/account/kit-gallery/KitGalleryLongTail
 */

import { useState } from 'react';
import { CopyField, FilterChips, RatingStars } from '@/components/account/ui';
import styles from './KitGallery.module.css';
import type { GalleryGroupProps } from './KitGalleryActions';
import { Visual } from './Visual';

const CHIPS = [
    { value: 'all', label: 'Todos', exclusive: true },
    { value: 'pending', label: 'Pendientes', count: 3 },
    { value: 'confirmed', label: 'Confirmados' }
] as const;

/** A FilterChips with its own selection so the gallery shows the pressed state. */
function ChipsDemo({ initial }: { readonly initial: string | null }) {
    const [value, setValue] = useState<string | null>(initial);
    return (
        <FilterChips
            label="Filtrar por estado"
            items={CHIPS}
            value={value}
            onChange={setValue}
        />
    );
}

/**
 * RatingStars, FilterChips and CopyField in their states.
 *
 * @param props - See {@link GalleryGroupProps}.
 * @returns The group.
 */
export function KitGalleryLongTail({ locale }: GalleryGroupProps) {
    return (
        <section className={styles.group}>
            <h2 className={styles.groupTitle}>Long tail pieces</h2>
            <div className={styles.grid}>
                <Visual name="RatingStars/values">
                    <RatingStars
                        value={5}
                        label="Calificación: 5 de 5"
                        showValue
                    />
                    <RatingStars
                        value={3.5}
                        label="Calificación: 3,5 de 5"
                        showValue
                    />
                    <RatingStars
                        value={0}
                        label="Calificación: 0 de 5"
                    />
                </Visual>
                <Visual name="FilterChips/selected">
                    <ChipsDemo initial="pending" />
                </Visual>
                <Visual name="FilterChips/none">
                    <ChipsDemo initial={null} />
                </Visual>
                <Visual name="CopyField/default">
                    <CopyField
                        label="Enlace del asistente"
                        value="https://hospeda.com.ar/mcp/ejemplo"
                        locale={locale}
                        hint="Pegalo en la configuración de tu asistente."
                    />
                </Visual>
            </div>
        </section>
    );
}
