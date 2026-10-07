import { LocationCoordinates } from './incident';

export interface RouteInstruction {
  step: number;
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface EmergencyRoute {
  origin: LocationCoordinates;
  destination: LocationCoordinates;
  waypoints?: LocationCoordinates[];
  totalDistanceMeters: number;
  estimatedTimeSeconds: number;
  trafficCondition: 'CLEAR' | 'MODERATE' | 'HEAVY';
  instructions: RouteInstruction[];
}
