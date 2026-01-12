import { useVehicleStore } from '../store/vehicleStore';

export const useVehicle = () => {
  const {
    vehicles,
    selectedVehicle,
    isLoading,
    fetchVehicles,
    registerVehicle,
    updateVehicle,
    deleteVehicle,
    selectVehicle,
  } = useVehicleStore();

  return {
    vehicles,
    selectedVehicle,
    isLoading,
    fetchVehicles,
    registerVehicle,
    updateVehicle,
    deleteVehicle,
    selectVehicle,
  };
};




