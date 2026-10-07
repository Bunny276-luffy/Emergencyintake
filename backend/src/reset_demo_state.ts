import 'dotenv/config';
import { prisma } from './config/database';

async function main() {
  console.log('Restoring clean demo runtime state...');

  // 1. Ensure HOSP-01 exists with standard demo capacity
  await prisma.hospital.upsert({
    where: { id: 'HOSP-01' },
    update: {
      name: 'Victoria Hospital',
      latitude: 12.9616,
      longitude: 77.5746,
      address: 'K.R. Road, Bengaluru',
      contactNumber: '+91-8026701111',
      totalBeds: 500,
      availableICUBeds: 40,
      availableEmergencyBeds: 40,
      availableVentilators: 20,
      traumaCenterLevel: 1,
      acceptingPatients: true,
      specialties: ['Trauma', 'Emergency Medicine', 'Neurology', 'Cardiology'],
    },
    create: {
      id: 'HOSP-01',
      name: 'Victoria Hospital',
      latitude: 12.9616,
      longitude: 77.5746,
      address: 'K.R. Road, Bengaluru',
      contactNumber: '+91-8026701111',
      totalBeds: 500,
      availableICUBeds: 40,
      availableEmergencyBeds: 40,
      availableVentilators: 20,
      traumaCenterLevel: 1,
      acceptingPatients: true,
      specialties: ['Trauma', 'Emergency Medicine', 'Neurology', 'Cardiology'],
    },
  });

  // 2. Ensure AMB-01 exists and is AVAILABLE for demo
  await prisma.ambulance.upsert({
    where: { id: 'AMB-01' },
    update: {
      vehicleNumber: 'KA-01-EQ-1008',
      driverName: 'Rajesh Kumar',
      driverPhone: '+91-9876543210',
      status: 'AVAILABLE',
      latitude: 12.9716,
      longitude: 77.5946,
      currentIncidentId: null,
      destinationHospitalId: null,
      etaSeconds: null,
    },
    create: {
      id: 'AMB-01',
      vehicleNumber: 'KA-01-EQ-1008',
      driverName: 'Rajesh Kumar',
      driverPhone: '+91-9876543210',
      status: 'AVAILABLE',
      latitude: 12.9716,
      longitude: 77.5946,
    },
  });

  // 3. Ensure other fleet units AMB-02 through AMB-06 are AVAILABLE
  const fleet = [
    { id: 'AMB-02', vehicleNumber: 'KA-03-HA-2415', driverName: 'Suresh Anthony', driverPhone: '+91-9876543211', lat: 12.9352, lng: 77.6245 },
    { id: 'AMB-03', vehicleNumber: 'KA-05-MM-4892', driverName: 'Amit Singh', driverPhone: '+91-9876543212', lat: 12.9784, lng: 77.6408 },
    { id: 'AMB-04', vehicleNumber: 'KA-51-ND-7711', driverName: 'Manjunath Gowda', driverPhone: '+91-9876543213', lat: 13.0285, lng: 77.5417 },
    { id: 'AMB-05', vehicleNumber: 'KA-04-PG-3354', driverName: 'Vikram Malhotra', driverPhone: '+91-9876543214', lat: 12.9141, lng: 77.5855 },
    { id: 'AMB-06', vehicleNumber: 'KA-02-KF-1102', driverName: 'Abdul Rahman', driverPhone: '+91-9876543215', lat: 13.0112, lng: 77.6534 },
  ];

  for (const f of fleet) {
    await prisma.ambulance.upsert({
      where: { id: f.id },
      update: {
        vehicleNumber: f.vehicleNumber,
        driverName: f.driverName,
        driverPhone: f.driverPhone,
        status: 'AVAILABLE',
        latitude: f.lat,
        longitude: f.lng,
        currentIncidentId: null,
        destinationHospitalId: null,
      },
      create: {
        id: f.id,
        vehicleNumber: f.vehicleNumber,
        driverName: f.driverName,
        driverPhone: f.driverPhone,
        status: 'AVAILABLE',
        latitude: f.lat,
        longitude: f.lng,
      },
    });
  }

  // 4. Ensure Paramedic Unit exists
  await prisma.paramedic.upsert({
    where: { id: 'PARAMEDIC_UNIT_1' },
    update: {
      name: 'Field Paramedic Response Team 1',
      phone: '+91-9876543220',
      unitNumber: 'PARAMEDIC-01',
    },
    create: {
      id: 'PARAMEDIC_UNIT_1',
      name: 'Field Paramedic Response Team 1',
      phone: '+91-9876543220',
      unitNumber: 'PARAMEDIC-01',
    },
  });

  // 5. Mark all past test incidents as HANDOFF_COMPLETED so active list is clean
  await prisma.emergencyIncident.updateMany({
    where: { status: { notIn: ['HANDOFF_COMPLETED', 'CANCELLED'] } },
    data: { status: 'HANDOFF_COMPLETED' },
  });

  console.log('Clean demo state successfully restored.');
}

main()
  .catch(e => {
    console.error('Error restoring demo state:', e);
  })
  .finally(() => prisma.$disconnect());
