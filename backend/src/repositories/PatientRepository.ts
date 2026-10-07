import { Patient } from '../types/patient';
import { prisma, dbService } from '../config/database';

export class PatientRepository {
  private fallbackStore = new Map<string, Patient>();
  private idCounter = 1;

  public async findById(id: string): Promise<Patient | null> {
    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.patient.findUnique({ where: { id } });
        if (record) return this.mapToDomain(record);
      } catch {
        // Fallback
      }
    }
    return this.fallbackStore.get(id) || null;
  }

  public async findByIncidentId(incidentId: string): Promise<Patient[]> {
    if (dbService.isDbConnected()) {
      try {
        const records = await prisma.patient.findMany({ where: { incidentId } });
        return records.map((r) => this.mapToDomain(r));
      } catch {
        // Fallback
      }
    }
    return Array.from(this.fallbackStore.values()).filter((p) => p.incidentId === incidentId);
  }

  public async create(item: Partial<Patient>): Promise<Patient> {
    const id = item.id || `PAT-${Date.now()}-${this.idCounter++}`;

    const patient: Patient = {
      id,
      incidentId: item.incidentId || '',
      name: item.name,
      age: item.age,
      gender: item.gender,
      knownMedicalConditions: item.knownMedicalConditions || [],
      allergies: item.allergies || [],
      bloodType: item.bloodType,
    };

    if (dbService.isDbConnected()) {
      try {
        const record = await prisma.patient.create({
          data: {
            id: patient.id,
            incidentId: patient.incidentId,
            name: patient.name,
            age: patient.age,
            gender: patient.gender,
            knownMedicalConditions: patient.knownMedicalConditions,
            allergies: patient.allergies,
            bloodType: patient.bloodType,
          },
        });
        const mapped = this.mapToDomain(record);
        this.fallbackStore.set(mapped.id, mapped);
        return mapped;
      } catch {
        // Fallback
      }
    }

    this.fallbackStore.set(id, patient);
    return patient;
  }

  private mapToDomain(record: any): Patient {
    return {
      id: record.id,
      incidentId: record.incidentId,
      name: record.name || undefined,
      age: record.age || undefined,
      gender: record.gender as any,
      knownMedicalConditions: record.knownMedicalConditions || [],
      allergies: record.allergies || [],
      bloodType: record.bloodType || undefined,
    };
  }
}

export const patientRepository = new PatientRepository();
