export const getRandomFutureDate = (minDays = 10, maxDays = 60): Date => {
    const now = new Date();
    const daysToAdd = Math.floor(Math.random() * (maxDays - minDays + 1)) + minDays;
    const futureDate = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    return futureDate;
};
