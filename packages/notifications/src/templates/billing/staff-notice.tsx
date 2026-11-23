import { Text } from '@react-email/components';
import { Button, Callout } from '@repo/email';
import { InfoRow } from '../components/info-row.js';

/**
 * Props of {@link StaffNoticeAction}.
 */
export interface StaffNoticeActionProps {
    /** The one thing staff must do, in a sentence. */
    readonly action: string;
    /** Absolute admin URL of the page where the action happens. Absent: no button. */
    readonly panelHref?: string | undefined;
    /** Label of the button that opens {@link StaffNoticeActionProps.panelHref}. */
    readonly buttonLabel: string;
    /** Menu path named in a sentence when there is no `panelHref`, e.g. "Facturación → Conciliación". */
    readonly menuPath: string;
}

/**
 * Joins the admin panel base URL and a path. Absent base: no link.
 *
 * @param input.adminUrl - Admin base URL, without a trailing slash
 * @param input.path - Path starting with a slash
 * @returns The absolute URL, or `undefined` when there is no admin URL
 */
export function adminPanelHref(input: {
    readonly adminUrl?: string | undefined;
    readonly path: string;
}): string | undefined {
    return input.adminUrl ? `${input.adminUrl.replace(/\/$/, '')}${input.path}` : undefined;
}

/**
 * Closing block shared by the staff notices (HOS-2565 §7.7): a warning callout
 * with the required action, then a button to the panel page, or a sentence
 * naming the menu path when the admin URL is not configured.
 *
 * @param props - {@link StaffNoticeActionProps}
 * @returns The callout and the button or menu sentence
 */
export function StaffNoticeAction({
    action,
    panelHref,
    buttonLabel,
    menuPath
}: StaffNoticeActionProps) {
    return (
        <>
            <Callout tone="warning">{action}</Callout>
            {panelHref ? (
                <Button href={panelHref}>{buttonLabel}</Button>
            ) : (
                <Text>Lo encontrás en el panel de administración: {menuPath}.</Text>
            )}
        </>
    );
}

/** One labeled value of a staff notice. A row without a value is omitted. */
export interface StaffNoticeRow {
    readonly label: string;
    readonly value: string | null | undefined;
}

/**
 * Labeled rows of a staff notice (HOS-2565 §7.7). Rows whose value is not
 * available (for example the holder, when the reader could not resolve it) are
 * omitted instead of rendering an empty value.
 *
 * @param props.rows - The rows, in order
 * @returns One `InfoRow` per row that has a value
 */
export function StaffNoticeRows({ rows }: { readonly rows: readonly StaffNoticeRow[] }) {
    return (
        <>
            {rows.map((row) =>
                row.value ? (
                    <InfoRow
                        key={row.label}
                        label={row.label}
                        value={row.value}
                    />
                ) : null
            )}
        </>
    );
}
