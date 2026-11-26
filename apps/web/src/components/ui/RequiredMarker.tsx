import styles from './TextField.module.css';

/** Visual marker for controls that already expose their required state. */
export function RequiredMarker() {
    return (
        <span
            className={styles.required}
            aria-hidden="true"
        >
            {' *'}
        </span>
    );
}
