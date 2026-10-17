import { Text } from '@react-email/components';
import type { ReactNode } from 'react';
import { Heading } from '../components/heading.js';
import { EmailLayout } from '../components/layout.js';

/** Props of the notice sent before PB4 or PB5 archives a listing. */
export interface ListingRetentionBeforeArchiveProps {
    readonly verticalName: string;
    readonly transition: 'PB4' | 'PB5';
    /** Market date of the announced archive, already formatted. */
    readonly archiveDate: string;
}

/** Props of the notice sent before PB9 deletes a listing's content. */
export interface ListingRetentionBeforeDeletionProps {
    readonly verticalName: string;
    /** Market date of the announced deletion, already formatted. */
    readonly deletionDate: string;
}

const BEFORE_ARCHIVE_PARAGRAPH: Readonly<Record<'PB4' | 'PB5', ReactNode>> = {
    PB4: <Text>Si recuperás la cobertura de tu plan antes de esa fecha, no se archiva.</Text>,
    PB5: <Text>Si publicás la ficha antes de esa fecha, no se archiva.</Text>
};

/** Notice that names when an inactive listing will be archived. */
export function ListingRetentionBeforeArchive({
    verticalName,
    transition,
    archiveDate
}: ListingRetentionBeforeArchiveProps) {
    return (
        <EmailLayout previewText={`Tu ficha de ${verticalName} se va a archivar por inactividad`}>
            <Heading>Tu ficha de {verticalName} se va a archivar</Heading>
            <Text>
                Tu ficha lleva tiempo sin actividad. Si no hacés nada, a partir del {archiveDate}{' '}
                deja de verse en el sitio. Archivarla no borra su contenido.
            </Text>
            {BEFORE_ARCHIVE_PARAGRAPH[transition]}
        </EmailLayout>
    );
}

/** Notice that names when an archived listing's content will be deleted. */
export function ListingRetentionBeforeDeletion({
    verticalName,
    deletionDate
}: ListingRetentionBeforeDeletionProps) {
    return (
        <EmailLayout previewText={`El contenido de tu ficha de ${verticalName} se va a borrar`}>
            <Heading>El contenido de tu ficha de {verticalName} se va a borrar</Heading>
            <Text>Tu ficha está archivada por inactividad.</Text>
            <Text>
                A partir del {deletionDate} se borra su contenido (textos, fotos, preguntas
                frecuentes y horarios), y no se puede recuperar.
            </Text>
            <Text>Antes de esa fecha podés pasarla a borrador desde tu cuenta, sin pagar.</Text>
        </EmailLayout>
    );
}
