import { create } from 'zustand';
import type { Vehicle } from '../types/vehicle';

interface VehicleState {
  vehicles: Vehicle[];
  selectedVehicle: Vehicle | null;
  isLoading: boolean;
  fetchVehicles: () => Promise<void>;
  registerVehicle: (data: Omit<Vehicle, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  updateVehicle: (id: string, data: Partial<Vehicle>) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  selectVehicle: (vehicle: Vehicle | null) => void;
}

// Mock 데이터 제거됨 - 실제 API를 사용합니다

export const useVehicleStore = create<VehicleState>((set) => ({
  vehicles: [],
  selectedVehicle: null,
  isLoading: false,

  fetchVehicles: async () => {
    // Mock 데이터 제거됨 - 실제 API를 사용합니다
    set({ isLoading: true });
    try {
      const { getUserVehicles } = await import('../utils/api');
      const vehiclesData = await getUserVehicles();
      // VehicleInfo를 Vehicle 타입으로 변환
      const vehicles = vehiclesData.map((v) => ({
        id: v.id.toString(),
        userId: '', // 현재 사용자 ID는 API에서 처리
        licensePlate: v.licensePlate,
        vehicleType: v.vehicleType.toLowerCase() as 'private' | 'taxi' | 'rental',
        carId: v.carId || undefined,
        createdAt: v.createdAt || new Date().toISOString(),
      }));
      set({ vehicles, isLoading: false });
    } catch (error) {
      console.error('차량 목록 조회 실패:', error);
      set({ vehicles: [], isLoading: false });
    }
  },

  registerVehicle: async (data) => {
    // 실제 API 호출
    const { registerVehicleByPlate } = await import('../utils/api');
    await registerVehicleByPlate(
      data.licensePlate,
      data.vehicleType?.toUpperCase() || 'PRIVATE'
    );
    // 등록 후 목록 새로고침
    const { getUserVehicles } = await import('../utils/api');
    const vehiclesData = await getUserVehicles();
    const vehicles = vehiclesData.map((v) => ({
      id: v.id.toString(),
      userId: '',
      licensePlate: v.licensePlate,
      vehicleType: v.vehicleType.toLowerCase() as 'private' | 'taxi' | 'rental',
      carId: v.carId || undefined,
      createdAt: v.createdAt || new Date().toISOString(),
    }));
    set({ vehicles });
  },

  updateVehicle: async (id, data) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    set((state) => {
      const updated = state.vehicles.find((v) => v.id === id);
      if (!updated) return state;
      const newVehicle = { ...updated, ...data };
      return {
        vehicles: state.vehicles.map((v) => (v.id === id ? newVehicle : v)),
        selectedVehicle: state.selectedVehicle?.id === id ? newVehicle : state.selectedVehicle,
      };
    });
  },

  deleteVehicle: async (id) => {
    // 실제 API 호출
    const { deleteVehicle } = await import('../utils/api');
    const vehicleId = parseInt(id);
    if (!isNaN(vehicleId)) {
      await deleteVehicle(vehicleId);
    }
    // 삭제 후 목록 새로고침
    const { getUserVehicles } = await import('../utils/api');
    const vehiclesData = await getUserVehicles();
    const vehicles = vehiclesData.map((v) => ({
      id: v.id.toString(),
      userId: '',
      licensePlate: v.licensePlate,
      vehicleType: v.vehicleType.toLowerCase() as 'private' | 'taxi' | 'rental',
      carId: v.carId || undefined,
      createdAt: v.createdAt || new Date().toISOString(),
    }));
    set({ vehicles, selectedVehicle: null });
  },

  selectVehicle: (vehicle) => {
    set({ selectedVehicle: vehicle });
  },
}));




