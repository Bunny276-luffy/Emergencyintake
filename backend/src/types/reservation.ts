export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED' | 'COMPLETED';

export interface BedReservation {
  id: string;
  incidentId: string;
  hospitalId: string;
  bedType: 'EMERGENCY' | 'ICU' | 'GENERAL';
  status: ReservationStatus;
  requestedAt: string;
  confirmedAt?: string;
  expiresAt: string;
}
