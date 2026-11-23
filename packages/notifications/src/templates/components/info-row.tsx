import { Column, Row, Text } from '@react-email/components';

/**
 * Props for InfoRow component
 */
export interface InfoRowProps {
    /** Label text (left side) */
    label: string;
    /** Value text (right side) */
    value: string;
    /**
     * Marks the value as a provider value shown verbatim (HOS-2565 §7.2): rendered in a
     * monospace style and tagged `data-raw-value` so the Spanish-only test exempts it.
     * Translating a measured value would misreport what the provider returned.
     */
    raw?: boolean;
}

/**
 * Key-value info row component for receipts and confirmations
 * Displays label on left (gray) and value on right (bold)
 */
export function InfoRow({ label, value, raw = false }: InfoRowProps) {
    return (
        <Row style={styles.row}>
            <Column style={styles.labelColumn}>
                <Text style={styles.label}>{label}</Text>
            </Column>
            <Column style={styles.valueColumn}>
                {raw ? (
                    <Text
                        style={{ ...styles.value, ...styles.rawValue }}
                        data-raw-value="true"
                    >
                        {value}
                    </Text>
                ) : (
                    <Text style={styles.value}>{value}</Text>
                )}
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
        color: '#475569',
        fontSize: '14px',
        lineHeight: '20px',
        margin: '0'
    },
    rawValue: {
        fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
        fontSize: '13px',
        fontWeight: '400',
        wordBreak: 'break-word' as const
    },
    value: {
        color: '#1e293b',
        fontSize: '14px',
        fontWeight: '600',
        lineHeight: '20px',
        margin: '0'
    }
};
