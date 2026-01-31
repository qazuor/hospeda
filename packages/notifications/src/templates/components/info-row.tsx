import { Column, Row, Text } from '@react-email/components';

/**
 * Props for InfoRow component
 */
export interface InfoRowProps {
    /** Label text (left side) */
    label: string;
    /** Value text (right side) */
    value: string;
}

/**
 * Key-value info row component for receipts and confirmations
 * Displays label on left (gray) and value on right (bold)
 */
export function InfoRow({ label, value }: InfoRowProps) {
    return (
        <Row style={styles.row}>
            <Column style={styles.labelColumn}>
                <Text style={styles.label}>{label}</Text>
            </Column>
            <Column style={styles.valueColumn}>
                <Text style={styles.value}>{value}</Text>
            </Column>
        </Row>
    );
}

const styles = {
    row: {
        marginBottom: '12px'
    },
    labelColumn: {
        width: '40%',
        verticalAlign: 'top' as const
    },
    valueColumn: {
        width: '60%',
        textAlign: 'right' as const,
        verticalAlign: 'top' as const
    },
    label: {
        color: '#64748b',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0'
    },
    value: {
        color: '#1e293b',
        fontSize: '14px',
        fontWeight: '600',
        lineHeight: '20px',
        margin: '0'
    }
};
