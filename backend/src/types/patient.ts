export interface Patient {
  id: string;
  incidentId: string;
  name?: string;
  age?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  knownMedicalConditions?: string[];
  allergies?: string[];
  bloodType?: string;
}
