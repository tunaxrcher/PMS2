import {
  BookingStatus,
  DepositStatus,
  DepositType,
  FolioItemType,
  FolioStatus,
  HousekeepingTaskStatus,
  HousekeepingTaskType,
  IdType,
  MaintenancePriority,
  MaintenanceStatus,
  MealPlan,
  PaymentMethod,
  PaymentStatus,
  PropertyType,
  RateAdjustmentType,
  RoomStatus,
  ZoneType,
} from './enums'

export interface Property {
  id: string
  name: string
  propertyType: PropertyType
  address?: string | null
  phone?: string | null
  email?: string | null
  timezone: string
  checkInTime: string
  checkOutTime: string
  vatRate: number
  serviceChargeRate: number
  priceIncludeTax: boolean
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Zone {
  id: string
  propertyId: string
  name: string
  zoneType: ZoneType
  parentZoneId?: string | null
  sortOrder: number
  active: boolean
  createdAt: Date
  updatedAt: Date
  children?: Zone[]
}

export interface RoomType {
  id: string
  propertyId: string
  name: string
  description?: string | null
  baseOccupancy: number
  maxOccupancy: number
  baseRate: number
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Room {
  id: string
  propertyId: string
  roomTypeId: string
  zoneId?: string | null
  roomNumber: string
  roomName?: string | null
  floorNo?: string | null
  buildingName?: string | null
  maxOccupancy: number
  currentStatus: RoomStatus
  active: boolean
  createdAt: Date
  updatedAt: Date
  roomType?: RoomType
  zone?: Zone | null
}

export interface Guest {
  id: string
  propertyId: string
  firstName: string
  lastName: string
  phone?: string | null
  email?: string | null
  nationality?: string | null
  idType?: IdType | null
  idNumber?: string | null
  dateOfBirth?: Date | null
  address?: string | null
  remark?: string | null
  blacklistFlag: boolean
  createdAt: Date
  updatedAt: Date
}

export interface BookingSource {
  id: string
  propertyId: string
  name: string
  sourceType: string
  active: boolean
}

export interface Booking {
  id: string
  propertyId: string
  bookingNumber: string
  guestId: string
  bookingSourceId?: string | null
  status: BookingStatus
  checkInDate: Date
  checkOutDate: Date
  adults: number
  children: number
  packageName?: string | null
  packageDetailJson?: Record<string, unknown> | null
  packageNote?: string | null
  notes?: string | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  guest?: Guest
  bookingSource?: BookingSource | null
  bookingRooms?: BookingRoom[]
  folios?: Folio[]
}

export interface BookingRoom {
  id: string
  bookingId: string
  roomTypeId: string
  roomId?: string | null
  checkInDate: Date
  checkOutDate: Date
  adults: number
  children: number
  rate: number
  status: string
  createdAt: Date
  updatedAt: Date
  roomType?: RoomType
  room?: Room | null
}

export interface Folio {
  id: string
  bookingId: string
  folioCode: string
  folioType: string
  guestId?: string | null
  status: FolioStatus
  createdAt: Date
  closedAt?: Date | null
  items?: FolioItem[]
  payments?: Payment[]
  deposits?: Deposit[]
}

export interface FolioItem {
  id: string
  folioId: string
  itemType: FolioItemType
  description: string
  quantity: number
  unitPrice: number
  totalAmount: number
  serviceDate: Date
  createdBy: string
  createdAt: Date
  isVoided: boolean
}

export interface Payment {
  id: string
  folioId: string
  paymentMethod: PaymentMethod
  amount: number
  paidAt: Date
  referenceNo?: string | null
  receivedBy: string
  status: PaymentStatus
  refunds?: Refund[]
}

export interface Refund {
  id: string
  paymentId: string
  amount: number
  reason: string
  refundedBy: string
  refundedAt: Date
}

export interface Deposit {
  id: string
  bookingId: string
  folioId?: string | null
  amount: number
  depositType: DepositType
  paymentMethod: PaymentMethod
  status: DepositStatus
  receivedBy: string
  receivedAt: Date
}

export interface HousekeepingTask {
  id: string
  propertyId: string
  roomId: string
  taskType: HousekeepingTaskType
  status: HousekeepingTaskStatus
  assignedTo?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
  remark?: string | null
  createdAt: Date
  updatedAt: Date
  room?: Room
}

export interface MaintenanceTicket {
  id: string
  propertyId: string
  roomId?: string | null
  issueTitle: string
  issueDetail?: string | null
  priority: MaintenancePriority
  status: MaintenanceStatus
  reportedBy: string
  resolvedBy?: string | null
  createdAt: Date
  resolvedAt?: Date | null
  room?: Room | null
}

export interface RatePlan {
  id: string
  propertyId: string
  roomTypeId: string
  name: string
  basePrice: number
  mealPlan: MealPlan
  cancellationPolicy?: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
  roomType?: RoomType
}

export interface DailyRate {
  id: string
  propertyId: string
  roomTypeId: string
  ratePlanId: string
  date: Date
  price: number
  minStay?: number | null
  stopSell: boolean
}

export interface RateAdjustment {
  id: string
  bookingId: string
  oldPrice: number
  newPrice: number
  adjustmentType: RateAdjustmentType
  reason: string
  approvedByUserId?: string | null
  createdBy: string
  createdAt: Date
}

export interface AuditLog {
  id: string
  propertyId?: string | null
  userId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  oldValueJson?: Record<string, unknown> | null
  newValueJson?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  createdAt: Date
}

export interface User {
  id: string
  propertyId?: string | null
  phone: string
  firstName: string
  lastName: string
  active: boolean
  mustChangePinOnLogin: boolean
  createdAt: Date
  updatedAt: Date
  roles?: string[]
  permissions?: string[]
}
