export async function fetchUpdatedInfo(_id: string) {
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay
    return {
        rating: (4 + Math.random()).toFixed(1),
        reviews: 30 + Math.floor(Math.random() * 10)
    };
}
