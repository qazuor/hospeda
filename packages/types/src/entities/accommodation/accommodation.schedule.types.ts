export interface ScheduleType {
    checkinTime?: string;
    checkoutTime?: string;
    earlyCheckinAccepted: boolean;
    earlyCheckinTime?: string;
    lateCheckinAccepted: boolean;
    lateCheckinTime?: string;
    lateCheckoutAccepted: boolean;
    lateCheckoutTime?: string;
    selfCheckin: boolean;
    selfCheckout: boolean;
}
