export type VehicleType = 'private' | 'taxi' | 'rental';

export interface Vehicle {
  id: string;
  userId: string;
  licensePlate: string;
  vehicleType: VehicleType;
  carId?: string;
  createdAt: string;
}

export interface SafetyScore {
  overall: number;
  drowsiness: number;
  acceleration: number;
  posture: number;
}




