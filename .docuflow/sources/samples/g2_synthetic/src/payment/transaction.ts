export enum PaymentStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED' // Drift: Added REFUNDED in code, docs might only have 3 statuses
}

export interface Transaction {
    transactionId: string;
    userId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    createdAt: Date;
    processorReference?: string; // Drift: field not in docs
}

export class PaymentProcessor {
    process(transaction: Transaction): boolean {
        // Implementation
        return true;
    }
}
