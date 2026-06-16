export const PERMISSIONS = {
  // Booking
  BOOKING_CREATE: 'booking.create',
  BOOKING_UPDATE: 'booking.update',
  BOOKING_CANCEL: 'booking.cancel',
  BOOKING_CHECK_IN: 'booking.check_in',
  BOOKING_CHECK_OUT: 'booking.check_out',
  BOOKING_MOVE_ROOM: 'booking.move_room',
  BOOKING_ASSIGN_ROOM: 'booking.assign_room',
  BOOKING_VIEW: 'booking.view',

  // Guest
  GUEST_CREATE: 'guest.create',
  GUEST_UPDATE: 'guest.update',
  GUEST_VIEW_SENSITIVE: 'guest.view_sensitive',
  GUEST_VIEW: 'guest.view',

  // Payment
  PAYMENT_RECEIVE: 'payment.receive',
  PAYMENT_VOID: 'payment.void',
  PAYMENT_REFUND: 'payment.refund',

  // Folio
  FOLIO_ADD_CHARGE: 'folio.add_charge',
  FOLIO_ADD_DISCOUNT: 'folio.add_discount',
  FOLIO_CLOSE: 'folio.close',
  FOLIO_VIEW: 'folio.view',

  // Room
  ROOM_UPDATE_STATUS: 'room.update_status',
  ROOM_SET_OUT_OF_ORDER: 'room.set_out_of_order',
  ROOM_VIEW: 'room.view',
  ROOM_MANAGE: 'room.manage',

  // Housekeeping
  HOUSEKEEPING_VIEW: 'housekeeping.view',
  HOUSEKEEPING_UPDATE_TASK: 'housekeeping.update_task',

  // Maintenance
  MAINTENANCE_CREATE: 'maintenance.create',
  MAINTENANCE_RESOLVE: 'maintenance.resolve',
  MAINTENANCE_VIEW: 'maintenance.view',

  // Report
  REPORT_VIEW: 'report.view',

  // User
  USER_MANAGE: 'user.manage',

  // Price
  PRICE_OVERRIDE: 'price.override',
  RATE_PLAN_MANAGE: 'rate_plan.manage',

  // Property
  PROPERTY_MANAGE: 'property.manage',

  // Audit
  AUDIT_LOG_VIEW: 'audit_log.view',

  // Deposit
  DEPOSIT_RECEIVE: 'deposit.receive',
  DEPOSIT_APPLY: 'deposit.apply',
  DEPOSIT_REFUND: 'deposit.refund',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ROLE_PERMISSIONS = {
  admin: Object.values(PERMISSIONS),
  front_desk: [
    PERMISSIONS.BOOKING_CREATE,
    PERMISSIONS.BOOKING_UPDATE,
    PERMISSIONS.BOOKING_CANCEL,
    PERMISSIONS.BOOKING_CHECK_IN,
    PERMISSIONS.BOOKING_CHECK_OUT,
    PERMISSIONS.BOOKING_MOVE_ROOM,
    PERMISSIONS.BOOKING_ASSIGN_ROOM,
    PERMISSIONS.BOOKING_VIEW,
    PERMISSIONS.GUEST_CREATE,
    PERMISSIONS.GUEST_UPDATE,
    PERMISSIONS.GUEST_VIEW,
    PERMISSIONS.PAYMENT_RECEIVE,
    PERMISSIONS.FOLIO_ADD_CHARGE,
    PERMISSIONS.FOLIO_ADD_DISCOUNT,
    PERMISSIONS.FOLIO_CLOSE,
    PERMISSIONS.FOLIO_VIEW,
    PERMISSIONS.ROOM_UPDATE_STATUS,
    PERMISSIONS.ROOM_SET_OUT_OF_ORDER,
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.HOUSEKEEPING_VIEW,
    PERMISSIONS.MAINTENANCE_CREATE,
    PERMISSIONS.MAINTENANCE_VIEW,
    PERMISSIONS.DEPOSIT_RECEIVE,
    PERMISSIONS.DEPOSIT_APPLY,
  ],
  housekeeping: [
    PERMISSIONS.ROOM_VIEW,
    PERMISSIONS.HOUSEKEEPING_VIEW,
    PERMISSIONS.HOUSEKEEPING_UPDATE_TASK,
    PERMISSIONS.MAINTENANCE_CREATE,
    PERMISSIONS.MAINTENANCE_VIEW,
  ],
} as const
