// TODO: Add proper type definitions
export function Component() {
    // HACK: Inline styles until we setup CSS
    return (
        <div style={{ padding: '20px' }}>
            {/* TODO: Replace with proper button component */}
            <button>Click me</button>
        </div>
    );
}

// DEBUG: Test component for development
export function DebugComponent() {
    return (
        <div>
            {/* HACK(P1): Remove hardcoded data */}
            <span>Hardcoded value</span>
        </div>
    );
}
