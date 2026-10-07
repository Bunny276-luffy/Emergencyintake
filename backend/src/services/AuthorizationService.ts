import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuthorizationService {
  static async canAccessAmbulance(userReq: { id: string; role: string }, targetAmbulanceId: string): Promise<boolean> {
    if (!userReq) return false;
    if (userReq.role === 'ADMIN' || userReq.role === 'DISPATCHER') return true;
    
    if (userReq.role === 'AMBULANCE_DRIVER') {
      const user = await prisma.user.findUnique({ where: { id: userReq.id } });
      return user?.ambulanceId === targetAmbulanceId;
    }
    
    return false;
  }

  static async canAccessHospital(userReq: { id: string; role: string }, targetHospitalId: string): Promise<boolean> {
    if (!userReq) return false;
    if (userReq.role === 'ADMIN' || userReq.role === 'DISPATCHER') return true;
    
    if (userReq.role === 'HOSPITAL') {
      const user = await prisma.user.findUnique({ where: { id: userReq.id } });
      return user?.hospitalId === targetHospitalId;
    }
    
    return false;
  }

  static async canAccessIncident(userReq: { id: string; role: string }, targetIncidentId: string): Promise<boolean> {
    if (!userReq) return false;
    if (userReq.role === 'ADMIN' || userReq.role === 'DISPATCHER') return true;

    const incident = await prisma.emergencyIncident.findUnique({
      where: { id: targetIncidentId },
      include: { reservations: true }
    });
    if (!incident) return false;

    const user = await prisma.user.findUnique({ where: { id: userReq.id } });
    if (!user) return false;

    if (userReq.role === 'AMBULANCE_DRIVER') {
      return user.ambulanceId === incident.assignedAmbulanceId;
    }

    if (userReq.role === 'PARAMEDIC') {
      return user.paramedicId === incident.assignedParamedicId;
    }

    if (userReq.role === 'HOSPITAL') {
      return incident.destinationHospitalId === user.hospitalId || 
             incident.reservations.some(r => r.hospitalId === user.hospitalId);
    }
    return false;
  }

  static async canAccessReport(userReq: { id: string; role: string }, targetReportId: string): Promise<boolean> {
    const report = await prisma.paramedicReport.findUnique({ where: { id: targetReportId } });
    if (!report) return false;
    return this.canAccessIncident(userReq, report.incidentId);
  }
}
