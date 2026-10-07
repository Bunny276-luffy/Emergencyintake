import { SubmitParamedicReportDTO, ParamedicReport, EmergencyIncident, Patient } from '../types';
import { paramedicRepository } from '../repositories/ParamedicRepository';
import { incidentRepository } from '../repositories/IncidentRepository';
import { patientRepository } from '../repositories/PatientRepository';
import { auditService } from './AuditService';
import { NotFoundError, ValidationError } from '../errors/AppError';
import { webSocketManager } from '../server/websocket';
import { MLService } from './MLService';
import { prisma } from '../config/database';

export class ParamedicService {
  public async getAssignedIncident(incidentId: string): Promise<{
    incident: EmergencyIncident;
    patients: Patient[];
    patient?: Patient;
    report?: ParamedicReport;
  }> {
    const incident = await incidentRepository.findById(incidentId);
    if (!incident) {
      throw new NotFoundError(`Incident with ID '${incidentId}' not found`, {
        source: 'PARAMEDIC_TEAM',
        operation: 'GET_ASSIGNED_INCIDENT',
        incidentId,
      });
    }

    const patients = await patientRepository.findByIncidentId(incidentId);
    const reports = await paramedicRepository.findByIncidentId(incidentId);

    return {
      incident,
      patients,
      patient: patients.length > 0 ? patients[0] : undefined,
      report: reports.length > 0 ? reports[0] : undefined,
    };
  }

  public async submitClinicalReport(dto: SubmitParamedicReportDTO): Promise<ParamedicReport> {
    if (!dto.incidentId || !dto.patientConditionSummary || !dto.triageLevel || !dto.vitals) {
      throw new ValidationError(
        'incidentId, patientConditionSummary, triageLevel, and vitals are required for paramedic report',
        {
          source: 'PARAMEDIC_TEAM',
          operation: 'SUBMIT_CLINICAL_REPORT',
          incidentId: dto.incidentId,
        }
      );
    }

    const validTriageLevels = ['IMMEDIATE_RED', 'URGENT_YELLOW', 'DELAYED_GREEN', 'EXPECTANT_BLACK'];
    if (!validTriageLevels.includes(dto.triageLevel)) {
      throw new ValidationError(
        `Invalid triageLevel '${dto.triageLevel}'. Allowed: ${validTriageLevels.join(', ')}`,
        {
          source: 'PARAMEDIC_TEAM',
          operation: 'SUBMIT_CLINICAL_REPORT',
          incidentId: dto.incidentId,
        }
      );
    }

    // Verify incident exists
    const assigned = await this.getAssignedIncident(dto.incidentId);

    const report = await paramedicRepository.create({
      incidentId: dto.incidentId,
      paramedicId: 'PARAMEDIC_UNIT_1',
      patientConditionSummary: dto.patientConditionSummary,
      triageLevel: dto.triageLevel,
      vitals: dto.vitals,
      voiceReportAudioUrl: dto.voiceReportAudioUrl,
    });

    await auditService.logEvent({
      who: 'PARAMEDIC_TEAM',
      what: `Submitted clinical report for incident ${dto.incidentId} [Triage: ${dto.triageLevel}]`,
      source: 'PARAMEDIC_TEAM',
      action: 'SUBMIT_CLINICAL_REPORT',
      result: 'SUCCESS',
      incidentId: dto.incidentId,
    });

    // Attempt ML prediction in background (don't block)
    MLService.predictTriage({ ...dto.vitals, patientConditionSummary: dto.patientConditionSummary, incidentType: assigned.incident.emergencyType })
      .then(async (mlResult) => {
        if (mlResult) {
          try {
            await prisma.mLTriagePrediction.create({
              data: {
                incidentId: dto.incidentId,
                modelVersion: mlResult.model_version,
                severityRecommendation: mlResult.severity_class,
                confidence: mlResult.confidence,
                safetyEscalation: mlResult.safety_escalation,
                topFactors: mlResult.top_factors,
              }
            });
            // Could broadcast updated incident here if needed
          } catch (e) {
            // Ignore DB error, ML is just assistive
          }
        }
      })
      .catch(() => {});

    webSocketManager.broadcastClinicalReport(report, assigned.incident.destinationHospitalId);

    return report;
  }

  public async getClinicalReportByIncidentId(incidentId: string): Promise<ParamedicReport> {
    const reports = await paramedicRepository.findByIncidentId(incidentId);
    if (!reports || reports.length === 0) {
      throw new NotFoundError(`No clinical report found for incident '${incidentId}'`, {
        source: 'PARAMEDIC_TEAM',
        operation: 'GET_CLINICAL_REPORT',
        incidentId,
      });
    }
    return reports[0];
  }

  public async updateClinicalReport(
    reportId: string,
    updateDTO: Partial<SubmitParamedicReportDTO> & { transcriptionText?: string }
  ): Promise<ParamedicReport> {
    const existing = await paramedicRepository.findById(reportId);
    if (!existing) {
      throw new NotFoundError(`Clinical report with ID '${reportId}' not found`, {
        source: 'PARAMEDIC_TEAM',
        operation: 'UPDATE_CLINICAL_REPORT',
      });
    }

    const updated = await paramedicRepository.update(reportId, {
      patientConditionSummary: updateDTO.patientConditionSummary,
      triageLevel: updateDTO.triageLevel,
      voiceReportAudioUrl: updateDTO.voiceReportAudioUrl,
      transcriptionText: updateDTO.transcriptionText,
    });

    await auditService.logEvent({
      who: 'PARAMEDIC_TEAM',
      what: `Updated clinical report ${reportId} for incident ${existing.incidentId}`,
      source: 'PARAMEDIC_TEAM',
      action: 'UPDATE_CLINICAL_REPORT',
      result: 'SUCCESS',
      incidentId: existing.incidentId,
    });

    return updated!;
  }
}

export const paramedicService = new ParamedicService();
