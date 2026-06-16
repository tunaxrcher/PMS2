import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Serene PMS...')

  // --- Property ---
  const property = await prisma.property.upsert({
    where: { id: 'prop-001' },
    update: {},
    create: {
      id: 'prop-001',
      name: 'Serene Resort & Spa',
      propertyType: 'resort',
      address: '123 ถ.ริมชายหาด ตำบลหาดทอง จังหวัดสุราษฎร์ธานี 84310',
      phone: '077-123-456',
      email: 'info@sereneresortspa.com',
      timezone: 'Asia/Bangkok',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      vatRate: 7.00,
      serviceChargeRate: 10.00,
      priceIncludeTax: false,
    },
  })
  console.log(`✅ Property: ${property.name}`)

  // --- Permissions ---
  const permCodes = [
    ['booking.create', 'สร้างการจอง'],
    ['booking.update', 'แก้ไขการจอง'],
    ['booking.cancel', 'ยกเลิกการจอง'],
    ['booking.check_in', 'Check-in'],
    ['booking.check_out', 'Check-out'],
    ['booking.move_room', 'ย้ายห้อง'],
    ['booking.assign_room', 'กำหนดห้อง'],
    ['booking.view', 'ดูการจอง'],
    ['guest.create', 'เพิ่มลูกค้า'],
    ['guest.update', 'แก้ไขลูกค้า'],
    ['guest.view_sensitive', 'ดูข้อมูลส่วนตัวลูกค้า'],
    ['guest.view', 'ดูลูกค้า'],
    ['payment.receive', 'รับชำระเงิน'],
    ['payment.void', 'ยกเลิกการชำระเงิน'],
    ['payment.refund', 'คืนเงิน'],
    ['folio.add_charge', 'เพิ่มค่าใช้จ่าย'],
    ['folio.add_discount', 'เพิ่มส่วนลด'],
    ['folio.close', 'ปิด Folio'],
    ['folio.view', 'ดู Folio'],
    ['room.update_status', 'เปลี่ยนสถานะห้อง'],
    ['room.set_out_of_order', 'ตั้งห้อง Out of Order'],
    ['room.view', 'ดูห้อง'],
    ['room.manage', 'จัดการห้อง'],
    ['housekeeping.view', 'ดูงานแม่บ้าน'],
    ['housekeeping.update_task', 'อัปเดตงานแม่บ้าน'],
    ['maintenance.create', 'สร้างใบแจ้งซ่อม'],
    ['maintenance.resolve', 'แก้ไขงานซ่อม'],
    ['maintenance.view', 'ดูงานซ่อม'],
    ['report.view', 'ดูรายงาน'],
    ['user.manage', 'จัดการผู้ใช้งาน'],
    ['price.override', 'แก้ไขราคา'],
    ['rate_plan.manage', 'จัดการ Rate Plan'],
    ['property.manage', 'จัดการที่พัก'],
    ['audit_log.view', 'ดู Audit Log'],
    ['deposit.receive', 'รับมัดจำ'],
    ['deposit.apply', 'นำมัดจำมาใช้'],
    ['deposit.refund', 'คืนมัดจำ'],
  ]

  const permissions: Record<string, { id: string }> = {}
  for (const [code, name] of permCodes) {
    const perm = await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name },
    })
    permissions[code] = perm
  }
  console.log(`✅ ${permCodes.length} Permissions`)

  // --- Roles ---
  const adminPerms = Object.keys(permissions)
  const frontDeskPerms = [
    'booking.create', 'booking.update', 'booking.cancel', 'booking.check_in',
    'booking.check_out', 'booking.move_room', 'booking.assign_room', 'booking.view',
    'guest.create', 'guest.update', 'guest.view',
    'payment.receive', 'folio.add_charge', 'folio.add_discount', 'folio.close', 'folio.view',
    'room.update_status', 'room.set_out_of_order', 'room.view',
    'housekeeping.view', 'maintenance.create', 'maintenance.view',
    'deposit.receive', 'deposit.apply',
  ]
  const housekeepingPerms = [
    'room.view', 'housekeeping.view', 'housekeeping.update_task',
    'maintenance.create', 'maintenance.view',
  ]

  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', displayName: 'ผู้ดูแลระบบ' },
  })
  const frontDeskRole = await prisma.role.upsert({
    where: { name: 'front_desk' },
    update: {},
    create: { name: 'front_desk', displayName: 'พนักงานต้อนรับ' },
  })
  const housekeepingRole = await prisma.role.upsert({
    where: { name: 'housekeeping' },
    update: {},
    create: { name: 'housekeeping', displayName: 'แม่บ้าน' },
  })

  // Assign permissions to roles
  for (const code of adminPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permissions[code].id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permissions[code].id },
    })
  }
  for (const code of frontDeskPerms) {
    if (permissions[code]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: frontDeskRole.id, permissionId: permissions[code].id } },
        update: {},
        create: { roleId: frontDeskRole.id, permissionId: permissions[code].id },
      })
    }
  }
  for (const code of housekeepingPerms) {
    if (permissions[code]) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: housekeepingRole.id, permissionId: permissions[code].id } },
        update: {},
        create: { roleId: housekeepingRole.id, permissionId: permissions[code].id },
      })
    }
  }
  console.log('✅ Roles & Permissions assigned')

  // --- Users ---
  const defaultPin = await bcrypt.hash('000000', 10)

  const adminUser = await prisma.user.upsert({
    where: { phone: '0800000001' },
    update: {},
    create: {
      propertyId: property.id,
      phone: '0800000001',
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      pinHash: defaultPin,
      mustChangePinOnLogin: false,
      userRoles: { create: { roleId: adminRole.id } },
    },
  })

  const frontDeskUser = await prisma.user.upsert({
    where: { phone: '0800000002' },
    update: {},
    create: {
      propertyId: property.id,
      phone: '0800000002',
      firstName: 'สมหญิง',
      lastName: 'รักงาน',
      pinHash: defaultPin,
      mustChangePinOnLogin: true,
      userRoles: { create: { roleId: frontDeskRole.id } },
    },
  })

  const hkUser = await prisma.user.upsert({
    where: { phone: '0800000003' },
    update: {},
    create: {
      propertyId: property.id,
      phone: '0800000003',
      firstName: 'มาลี',
      lastName: 'สะอาด',
      pinHash: defaultPin,
      mustChangePinOnLogin: true,
      userRoles: { create: { roleId: housekeepingRole.id } },
    },
  })
  console.log('✅ Users created')

  // --- Zones ---
  const beachZone = await prisma.zone.upsert({
    where: { id: 'zone-beach' },
    update: {},
    create: { id: 'zone-beach', propertyId: property.id, name: 'Beach Zone', zoneType: 'beach_zone', sortOrder: 1 },
  })
  const poolZone = await prisma.zone.upsert({
    where: { id: 'zone-pool' },
    update: {},
    create: { id: 'zone-pool', propertyId: property.id, name: 'Pool Villa Zone', zoneType: 'pool_zone', sortOrder: 2 },
  })
  const gardenZone = await prisma.zone.upsert({
    where: { id: 'zone-garden' },
    update: {},
    create: { id: 'zone-garden', propertyId: property.id, name: 'Garden Zone', zoneType: 'garden_zone', sortOrder: 3 },
  })
  console.log('✅ Zones created')

  // --- Room Types ---
  const standardType = await prisma.roomType.upsert({
    where: { id: 'rt-standard' },
    update: {},
    create: { id: 'rt-standard', propertyId: property.id, name: 'Standard Room', description: 'ห้องมาตรฐาน วิวสวน', baseOccupancy: 2, maxOccupancy: 3, baseRate: 2500 },
  })
  const deluxeType = await prisma.roomType.upsert({
    where: { id: 'rt-deluxe' },
    update: {},
    create: { id: 'rt-deluxe', propertyId: property.id, name: 'Deluxe Room', description: 'ห้อง Deluxe วิวสระว่ายน้ำ', baseOccupancy: 2, maxOccupancy: 4, baseRate: 3500 },
  })
  const poolVillaType = await prisma.roomType.upsert({
    where: { id: 'rt-pool-villa' },
    update: {},
    create: { id: 'rt-pool-villa', propertyId: property.id, name: 'Pool Villa', description: 'วิลล่าพร้อมสระส่วนตัว', baseOccupancy: 2, maxOccupancy: 4, baseRate: 8500 },
  })
  const beachVillaType = await prisma.roomType.upsert({
    where: { id: 'rt-beach-villa' },
    update: {},
    create: { id: 'rt-beach-villa', propertyId: property.id, name: 'Beachfront Villa', description: 'วิลล่าหน้าหาด วิวทะเล', baseOccupancy: 2, maxOccupancy: 6, baseRate: 12000 },
  })
  console.log('✅ Room Types created')

  // --- Rooms ---
  const roomsData = [
    { id: 'room-101', roomTypeId: standardType.id, zoneId: gardenZone.id, roomNumber: '101', roomName: 'Garden View 101', floorNo: '1' },
    { id: 'room-102', roomTypeId: standardType.id, zoneId: gardenZone.id, roomNumber: '102', roomName: 'Garden View 102', floorNo: '1' },
    { id: 'room-103', roomTypeId: standardType.id, zoneId: gardenZone.id, roomNumber: '103', roomName: 'Garden View 103', floorNo: '1' },
    { id: 'room-201', roomTypeId: deluxeType.id, zoneId: poolZone.id, roomNumber: '201', roomName: 'Pool View 201', floorNo: '2' },
    { id: 'room-202', roomTypeId: deluxeType.id, zoneId: poolZone.id, roomNumber: '202', roomName: 'Pool View 202', floorNo: '2' },
    { id: 'room-203', roomTypeId: deluxeType.id, zoneId: poolZone.id, roomNumber: '203', roomName: 'Pool View 203', floorNo: '2' },
    { id: 'room-pv1', roomTypeId: poolVillaType.id, zoneId: poolZone.id, roomNumber: 'PV-01', roomName: 'Pool Villa 01' },
    { id: 'room-pv2', roomTypeId: poolVillaType.id, zoneId: poolZone.id, roomNumber: 'PV-02', roomName: 'Pool Villa 02' },
    { id: 'room-bv1', roomTypeId: beachVillaType.id, zoneId: beachZone.id, roomNumber: 'BV-01', roomName: 'Beachfront Villa 01' },
    { id: 'room-bv2', roomTypeId: beachVillaType.id, zoneId: beachZone.id, roomNumber: 'BV-02', roomName: 'Beachfront Villa 02' },
  ]

  for (const r of roomsData) {
    await prisma.room.upsert({
      where: { id: r.id },
      update: {},
      create: { ...r, propertyId: property.id, maxOccupancy: 4, currentStatus: 'clean' },
    })
  }
  console.log('✅ Rooms created')

  // --- Booking Sources ---
  const sources = [
    { id: 'src-walkin', name: 'Walk-in', sourceType: 'direct' },
    { id: 'src-phone', name: 'โทรศัพท์', sourceType: 'direct' },
    { id: 'src-facebook', name: 'Facebook', sourceType: 'direct' },
    { id: 'src-line', name: 'Line', sourceType: 'direct' },
    { id: 'src-website', name: 'Website', sourceType: 'direct' },
    { id: 'src-agoda', name: 'Agoda', sourceType: 'ota' },
    { id: 'src-booking', name: 'Booking.com', sourceType: 'ota' },
    { id: 'src-traveloka', name: 'Traveloka', sourceType: 'ota' },
  ]
  for (const s of sources) {
    await prisma.bookingSource.upsert({
      where: { id: s.id },
      update: {},
      create: { ...s, propertyId: property.id },
    })
  }
  console.log('✅ Booking Sources created')

  // --- Rate Plans ---
  await prisma.ratePlan.upsert({
    where: { id: 'rp-bar-standard' },
    update: {},
    create: { id: 'rp-bar-standard', propertyId: property.id, roomTypeId: standardType.id, name: 'Best Available Rate', basePrice: 2500, mealPlan: 'none' },
  })
  await prisma.ratePlan.upsert({
    where: { id: 'rp-bb-standard' },
    update: {},
    create: { id: 'rp-bb-standard', propertyId: property.id, roomTypeId: standardType.id, name: 'Bed & Breakfast', basePrice: 2900, mealPlan: 'breakfast' },
  })
  await prisma.ratePlan.upsert({
    where: { id: 'rp-bar-deluxe' },
    update: {},
    create: { id: 'rp-bar-deluxe', propertyId: property.id, roomTypeId: deluxeType.id, name: 'Best Available Rate', basePrice: 3500, mealPlan: 'none' },
  })
  await prisma.ratePlan.upsert({
    where: { id: 'rp-bar-pool' },
    update: {},
    create: { id: 'rp-bar-pool', propertyId: property.id, roomTypeId: poolVillaType.id, name: 'Best Available Rate', basePrice: 8500, mealPlan: 'none' },
  })
  await prisma.ratePlan.upsert({
    where: { id: 'rp-bar-beach' },
    update: {},
    create: { id: 'rp-bar-beach', propertyId: property.id, roomTypeId: beachVillaType.id, name: 'Best Available Rate', basePrice: 12000, mealPlan: 'none' },
  })
  console.log('✅ Rate Plans created')

  console.log('\n🎉 Seed complete!')
  console.log('📱 Login credentials:')
  console.log('  Admin:      0800000001  PIN: 000000')
  console.log('  Front Desk: 0800000002  PIN: 000000 (must change)')
  console.log('  Housekeeping: 0800000003  PIN: 000000 (must change)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
