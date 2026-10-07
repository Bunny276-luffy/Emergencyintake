import request from 'supertest';
import { app } from '../src/server/app';
import { hospitalRepository } from '../src/repositories/HospitalRepository';
import { incidentRepository } from '../src/repositories/IncidentRepository';
import { reservationRepository } from '../src/repositories/ReservationRepository';

describe('4. Hospital APIs (/api/hospital)', () => {
  let testHospitalId: string;
  let testIncidentId: string;
  let testReservationId: string;
  const { generateToken } = require('../src/middleware/authHandler');
  let hospitalToken: string;

  beforeAll(async () => {
    const hosp = await hospitalRepository.create({
      name: 'St. Mary Emergency Hospital',
      location: { latitude: 12.95, longitude: 77.58 },
      contactNumber: '+918022223333',
      capacity: {
        totalBeds: 100,
        availableICUBeds: 10,
        availableEmergencyBeds: 20,
        availableVentilators: 5,
        traumaCenterLevel: 1,
        acceptingPatients: true,
      },
      specialties: ['TRAUMA', 'NEUROLOGY'],
    });
    testHospitalId = hosp.id;
    hospitalToken = generateToken({ id: hosp.id, role: 'ADMIN' });

    const inc = await incidentRepository.create({
      emergencyType: 'MAJOR_TRAUMA',
      location: { latitude: 12.95, longitude: 77.58 },
      description: 'Multiple trauma patient',
      status: 'REPORTED',
    });
    testIncidentId = inc.id;

    const resv = await reservationRepository.create({
      incidentId: testIncidentId,
      hospitalId: testHospitalId,
      bedType: 'EMERGENCY',
      status: 'PENDING',
    });
    testReservationId = resv.id;
  });

  it('GET /api/hospital/:hospitalId/profile - should retrieve hospital profile & capacity', async () => {
    const res = await request(app).get(`/api/hospital/${testHospitalId}/profile`).set('Authorization', `Bearer ${hospitalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('St. Mary Emergency Hospital');
    expect(res.body.data.capacity.totalBeds).toBe(100);
  });

  it('PATCH /api/hospital/:hospitalId/capacity - should update capacity values', async () => {
    const res = await request(app)
      .patch(`/api/hospital/${testHospitalId}/capacity`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({ availableEmergencyBeds: 18, availableICUBeds: 8 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.capacity.availableEmergencyBeds).toBe(18);
  });

  it('POST /api/hospital/:hospitalId/reservation/:reservationId/reject - should require mandatory reason', async () => {
    const res = await request(app)
      .post(`/api/hospital/${testHospitalId}/reservation/${testReservationId}/reject`)
      .set('Authorization', `Bearer ${hospitalToken}`)
      .send({}); // missing reason

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details[0].message).toContain('Required');
  });

  it('POST /api/hospital/:hospitalId/reservation/:reservationId/accept - should accept bed reservation', async () => {
    const res = await request(app)
      .post(`/api/hospital/${testHospitalId}/reservation/${testReservationId}/accept`)
      .set('Authorization', `Bearer ${hospitalToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CONFIRMED');
  });
});
