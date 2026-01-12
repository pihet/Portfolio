# web DB 모델들
from app.models.user import User, UserRole
from app.models.vehicle import Vehicle, VehicleType
from app.models.user_vehicle_mapping import UserVehicleMapping
from app.models.user_log import UserLog, LogStatus
from app.models.arrears_detection_modification import ArrearsDetectionModification
from app.models.missing_person_detection_modification import MissingPersonDetectionModification
from app.models.car_plate_info import CarPlateInfo
from app.models.driving_session import DrivingSession
from app.models.driving_session_info import DrivingSessionInfo
from app.models.drowsy_drive import DrowsyDrive
from app.models.missing_person_detection import MissingPersonDetectionMart
from app.models.missing_person_info_mart import MissingPersonInfoMart
from app.models.arrears_detection import ArrearsDetectionMart
from app.models.arrears_info_mart import ArrearsInfoMart
from app.models.vehicle_master import VehicleMaster
from app.models.safety_score_monthly import SafetyScoreMonthly
from app.models.rapid_accel_detail import RapidAccelDetail

__all__ = [
    "User",
    "UserRole",
    "Vehicle",
    "VehicleType",
    "UserVehicleMapping",
    "UserLog",
    "LogStatus",
    "ArrearsDetectionModification",
    "MissingPersonDetectionModification",
    "CarPlateInfo",
    "DrivingSession",
    "DrivingSessionInfo",
    "DrowsyDrive",
    "MissingPersonDetectionMart",
    "MissingPersonInfoMart",
    "ArrearsDetectionMart",
    "ArrearsInfoMart",
    "VehicleMaster",
    "SafetyScoreMonthly",
    "RapidAccelDetail",
]


