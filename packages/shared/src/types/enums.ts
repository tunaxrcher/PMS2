// Room Status
export enum RoomStatus {
  CLEAN = 'clean',
  DIRTY = 'dirty',
  OCCUPIED = 'occupied',
  CLEANING = 'cleaning',
  INSPECTED = 'inspected',
  OUT_OF_ORDER = 'out_of_order',
  OUT_OF_SERVICE = 'out_of_service',
}

// Booking Status
export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

// Folio Status
export enum FolioStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  VOIDED = 'voided',
}

// Payment Method
export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  CREDIT_CARD = 'credit_card',
  OTA = 'ota',
  OTHER = 'other',
}

// Payment Status
export enum PaymentStatus {
  PAID = 'paid',
  VOIDED = 'voided',
  REFUNDED = 'refunded',
  PARTIAL_REFUNDED = 'partial_refunded',
}

// Folio Item Type
export enum FolioItemType {
  ROOM_CHARGE = 'room_charge',
  MINIBAR = 'minibar',
  FOOD = 'food',
  EXTRA_BED = 'extra_bed',
  DISCOUNT = 'discount',
  TAX = 'tax',
  SERVICE_CHARGE = 'service_charge',
  DAMAGE = 'damage',
  LATE_CHECKOUT = 'late_checkout',
  OTHER = 'other',
}

// Housekeeping Task Status
export enum HousekeepingTaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

// Housekeeping Task Type
export enum HousekeepingTaskType {
  CHECKOUT_CLEANING = 'checkout_cleaning',
  STAYOVER_CLEANING = 'stayover_cleaning',
  DEEP_CLEANING = 'deep_cleaning',
}

// Maintenance Priority
export enum MaintenancePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Maintenance Status
export enum MaintenanceStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

// Deposit Type
export enum DepositType {
  BOOKING_DEPOSIT = 'booking_deposit',
  KEYCARD_DEPOSIT = 'keycard_deposit',
  DAMAGE_DEPOSIT = 'damage_deposit',
}

// Deposit Status
export enum DepositStatus {
  HELD = 'held',
  APPLIED = 'applied',
  REFUNDED = 'refunded',
  FORFEITED = 'forfeited',
}

// Rate Adjustment Type
export enum RateAdjustmentType {
  DISCOUNT = 'discount',
  SURCHARGE = 'surcharge',
  MANUAL_OVERRIDE = 'manual_override',
}

// Property Type
export enum PropertyType {
  RESORT = 'resort',
  HOTEL = 'hotel',
  VILLA = 'villa',
  HOSTEL = 'hostel',
}

// Zone Type
export enum ZoneType {
  BUILDING = 'building',
  FLOOR = 'floor',
  WING = 'wing',
  VILLA_ZONE = 'villa_zone',
  BEACH_ZONE = 'beach_zone',
  POOL_ZONE = 'pool_zone',
  GARDEN_ZONE = 'garden_zone',
  OTHER = 'other',
}

// ID Type
export enum IdType {
  CITIZEN_ID = 'citizen_id',
  PASSPORT = 'passport',
}

// Meal Plan
export enum MealPlan {
  NONE = 'none',
  BREAKFAST = 'breakfast',
  HALF_BOARD = 'half_board',
  FULL_BOARD = 'full_board',
}

// Booking Source Type
export enum BookingSourceType {
  DIRECT = 'direct',
  OTA = 'ota',
  AGENT = 'agent',
  CORPORATE = 'corporate',
}

// User Role
export enum UserRole {
  ADMIN = 'admin',
  FRONT_DESK = 'front_desk',
  HOUSEKEEPING = 'housekeeping',
}
