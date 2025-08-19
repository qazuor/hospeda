import { useState } from 'react';

export const TestComponent = () => {
    const [count, setCount] = useState(0);

    return (
        <div className="rounded border border-gray-300 p-4">
            <h3 className="mb-2 font-bold text-lg">Test Component</h3>
            <p>Count: {count}</p>
            <button
                type="button"
                onClick={() => setCount((c) => c + 1)}
                className="mt-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
                Increment
            </button>
        </div>
    );
};
