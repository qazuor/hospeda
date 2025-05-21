/**
 * This file is deprecated.
 * Please use the database services directly from @repo/db instead.
 * @deprecated
 */

export async function fetchUpdatedInfo(_id: string) {
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay
    return {
        rating: (4 + Math.random()).toFixed(1),
        reviews: 30 + Math.floor(Math.random() * 10)
    };
}
