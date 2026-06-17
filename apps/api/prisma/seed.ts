import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

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
    ['booking.create', 'สร้างการจอง'], ['booking.update', 'แก้ไขการจอง'],
    ['booking.cancel', 'ยกเลิกการจอง'], ['booking.check_in', 'Check-in'],
    ['booking.check_out', 'Check-out'], ['booking.move_room', 'ย้ายห้อง'],
    ['booking.assign_room', 'กำหนดห้อง'], ['booking.view', 'ดูการจอง'],
    ['guest.create', 'เพิ่มลูกค้า'], ['guest.update', 'แก้ไขลูกค้า'],
    ['guest.view_sensitive', 'ดูข้อมูลส่วนตัวลูกค้า'], ['guest.view', 'ดูลูกค้า'],
    ['payment.receive', 'รับชำระเงิน'], ['payment.void', 'ยกเลิกการชำระเงิน'],
    ['payment.refund', 'คืนเงิน'], ['folio.add_charge', 'เพิ่มค่าใช้จ่าย'],
    ['folio.add_discount', 'เพิ่มส่วนลด'], ['folio.close', 'ปิด Folio'],
    ['folio.view', 'ดู Folio'], ['room.update_status', 'เปลี่ยนสถานะห้อง'],
    ['room.set_out_of_order', 'ตั้งห้อง Out of Order'], ['room.view', 'ดูห้อง'],
    ['room.manage', 'จัดการห้อง'], ['housekeeping.view', 'ดูงานแม่บ้าน'],
    ['housekeeping.update_task', 'อัปเดตงานแม่บ้าน'], ['maintenance.create', 'สร้างใบแจ้งซ่อม'],
    ['maintenance.resolve', 'แก้ไขงานซ่อม'], ['maintenance.view', 'ดูงานซ่อม'],
    ['report.view', 'ดูรายงาน'], ['user.manage', 'จัดการผู้ใช้งาน'],
    ['price.override', 'แก้ไขราคา'], ['rate_plan.manage', 'จัดการ Rate Plan'],
    ['property.manage', 'จัดการที่พัก'], ['audit_log.view', 'ดู Audit Log'],
    ['deposit.receive', 'รับมัดจำ'], ['deposit.apply', 'นำมัดจำมาใช้'],
    ['deposit.refund', 'คืนมัดจำ'],
  ]

  const permissions: Record<string, { id: string }> = {}
  for (const [code, name] of permCodes) {
    const perm = await prisma.permission.upsert({ where: { code }, update: {}, create: { code, name } })
    permissions[code] = perm
  }
  console.log(`✅ ${permCodes.length} Permissions`)

  // --- Roles ---
  const adminPerms = Object.keys(permissions)
  const frontDeskPerms = ['booking.create','booking.update','booking.cancel','booking.check_in','booking.check_out','booking.move_room','booking.assign_room','booking.view','guest.create','guest.update','guest.view','payment.receive','folio.add_charge','folio.add_discount','folio.close','folio.view','room.update_status','room.set_out_of_order','room.view','housekeeping.view','maintenance.create','maintenance.view','deposit.receive','deposit.apply']
  const housekeepingPerms = ['room.view','housekeeping.view','housekeeping.update_task','maintenance.create','maintenance.view']

  const adminRole = await prisma.role.upsert({ where: { name: 'admin' }, update: {}, create: { name: 'admin', displayName: 'ผู้ดูแลระบบ' } })
  const frontDeskRole = await prisma.role.upsert({ where: { name: 'front_desk' }, update: {}, create: { name: 'front_desk', displayName: 'พนักงานต้อนรับ' } })
  const housekeepingRole = await prisma.role.upsert({ where: { name: 'housekeeping' }, update: {}, create: { name: 'housekeeping', displayName: 'แม่บ้าน' } })

  for (const code of adminPerms) {
    await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permissions[code].id } }, update: {}, create: { roleId: adminRole.id, permissionId: permissions[code].id } })
  }
  for (const code of frontDeskPerms) {
    if (permissions[code]) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: frontDeskRole.id, permissionId: permissions[code].id } }, update: {}, create: { roleId: frontDeskRole.id, permissionId: permissions[code].id } })
  }
  for (const code of housekeepingPerms) {
    if (permissions[code]) await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: housekeepingRole.id, permissionId: permissions[code].id } }, update: {}, create: { roleId: housekeepingRole.id, permissionId: permissions[code].id } })
  }
  console.log('✅ Roles & Permissions')

  // --- Users ---
  const defaultPin = await bcrypt.hash('000000', 10)
  await prisma.user.upsert({ where: { phone: '0800000001' }, update: {}, create: { propertyId: property.id, phone: '0800000001', firstName: 'สมชาย', lastName: 'ใจดี', pinHash: defaultPin, mustChangePinOnLogin: false, userRoles: { create: { roleId: adminRole.id } } } })
  await prisma.user.upsert({ where: { phone: '0800000002' }, update: {}, create: { propertyId: property.id, phone: '0800000002', firstName: 'สมหญิง', lastName: 'รักงาน', pinHash: defaultPin, mustChangePinOnLogin: true, userRoles: { create: { roleId: frontDeskRole.id } } } })
  await prisma.user.upsert({ where: { phone: '0800000003' }, update: {}, create: { propertyId: property.id, phone: '0800000003', firstName: 'มาลี', lastName: 'สะอาด', pinHash: defaultPin, mustChangePinOnLogin: true, userRoles: { create: { roleId: housekeepingRole.id } } } })
  const adminUser = await prisma.user.findUnique({ where: { phone: '0800000001' } })
  console.log('✅ Users')

  const CDN = 'https://pms-unityx.sgp1.cdn.digitaloceanspaces.com/images'
  const ROOM_IMGS = [`${CDN}/room-1.jpg`, `${CDN}/room-2.jpg`, `${CDN}/room-3.jpg`]

  // --- Zones (with images) ---
  const beachZone = await prisma.zone.upsert({
    where: { id: 'zone-beach' }, update: { imageUrl: `${CDN}/zone1.jpg` },
    create: { id: 'zone-beach', propertyId: property.id, name: 'Beach Zone', zoneType: 'beach_zone', sortOrder: 1, imageUrl: `${CDN}/zone1.jpg` },
  })
  const poolZone = await prisma.zone.upsert({
    where: { id: 'zone-pool' }, update: { imageUrl: `${CDN}/zone2.webp` },
    create: { id: 'zone-pool', propertyId: property.id, name: 'Pool Villa Zone', zoneType: 'pool_zone', sortOrder: 2, imageUrl: `${CDN}/zone2.webp` },
  })
  const gardenZone = await prisma.zone.upsert({
    where: { id: 'zone-garden' }, update: { imageUrl: `${CDN}/zone3.jpg` },
    create: { id: 'zone-garden', propertyId: property.id, name: 'Garden Zone', zoneType: 'garden_zone', sortOrder: 3, imageUrl: `${CDN}/zone3.jpg` },
  })
  console.log('✅ Zones (with images)')

  // --- Room Types (with images) ---
  const standardType = await prisma.roomType.upsert({
    where: { id: 'rt-standard' }, update: { imageUrl: `${CDN}/room_type1.png` },
    create: { id: 'rt-standard', propertyId: property.id, name: 'Standard Room', description: 'ห้องมาตรฐาน วิวสวน', baseOccupancy: 2, maxOccupancy: 3, baseRate: 2500, imageUrl: `${CDN}/room_type1.png` },
  })
  const deluxeType = await prisma.roomType.upsert({
    where: { id: 'rt-deluxe' }, update: { imageUrl: `${CDN}/room_type2.png` },
    create: { id: 'rt-deluxe', propertyId: property.id, name: 'Deluxe Room', description: 'ห้อง Deluxe วิวสระว่ายน้ำ', baseOccupancy: 2, maxOccupancy: 4, baseRate: 3500, imageUrl: `${CDN}/room_type2.png` },
  })
  const poolVillaType = await prisma.roomType.upsert({
    where: { id: 'rt-pool-villa' }, update: { imageUrl: `${CDN}/room_type3.png` },
    create: { id: 'rt-pool-villa', propertyId: property.id, name: 'Pool Villa', description: 'วิลล่าพร้อมสระส่วนตัว', baseOccupancy: 2, maxOccupancy: 4, baseRate: 8500, imageUrl: `${CDN}/room_type3.png` },
  })
  const beachVillaType = await prisma.roomType.upsert({
    where: { id: 'rt-beach-villa' }, update: { imageUrl: `${CDN}/room_type4.png` },
    create: { id: 'rt-beach-villa', propertyId: property.id, name: 'Beachfront Villa', description: 'วิลล่าหน้าหาด วิวทะเล', baseOccupancy: 2, maxOccupancy: 6, baseRate: 12000, imageUrl: `${CDN}/room_type4.png` },
  })
  console.log('✅ Room Types (with images)')

  // --- Rooms + RoomImages ---
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
  for (let i = 0; i < roomsData.length; i++) {
    const r = roomsData[i]
    await prisma.room.upsert({ where: { id: r.id }, update: {}, create: { ...r, propertyId: property.id, maxOccupancy: 4, currentStatus: 'clean' } })

    // Add room images (cycle through 3 images, 2-3 images per room)
    const existingImages = await prisma.roomImage.count({ where: { roomId: r.id } })
    if (existingImages === 0) {
      const imgA = ROOM_IMGS[i % 3]
      const imgB = ROOM_IMGS[(i + 1) % 3]
      const imgC = ROOM_IMGS[(i + 2) % 3]
      await prisma.roomImage.createMany({
        data: [
          { roomId: r.id, url: imgA, isPrimary: true, sortOrder: 0 },
          { roomId: r.id, url: imgB, isPrimary: false, sortOrder: 1 },
          { roomId: r.id, url: imgC, isPrimary: false, sortOrder: 2 },
        ],
      })
    }
  }
  console.log('✅ Rooms + Room Images')

  // --- Booking Sources ---
  const sources = [
    { id: 'src-walkin', name: 'Walk-in', sourceType: 'direct' },
    { id: 'src-phone', name: 'โทรศัพท์', sourceType: 'direct' },
    { id: 'src-facebook', name: 'Facebook', sourceType: 'direct' },
    { id: 'src-line', name: 'Line OA', sourceType: 'direct' },
    { id: 'src-website', name: 'Website', sourceType: 'direct' },
    { id: 'src-agoda', name: 'Agoda', sourceType: 'ota' },
    { id: 'src-booking', name: 'Booking.com', sourceType: 'ota' },
    { id: 'src-traveloka', name: 'Traveloka', sourceType: 'ota' },
  ]
  for (const s of sources) {
    await prisma.bookingSource.upsert({ where: { id: s.id }, update: {}, create: { ...s, propertyId: property.id } })
  }
  console.log('✅ Booking Sources')

  // --- Rate Plans ---
  await prisma.ratePlan.upsert({ where: { id: 'rp-bar-standard' }, update: {}, create: { id: 'rp-bar-standard', propertyId: property.id, roomTypeId: standardType.id, name: 'Best Available Rate', basePrice: 2500, mealPlan: 'none' } })
  await prisma.ratePlan.upsert({ where: { id: 'rp-bb-standard' }, update: {}, create: { id: 'rp-bb-standard', propertyId: property.id, roomTypeId: standardType.id, name: 'Bed & Breakfast', basePrice: 2900, mealPlan: 'breakfast' } })
  await prisma.ratePlan.upsert({ where: { id: 'rp-bar-deluxe' }, update: {}, create: { id: 'rp-bar-deluxe', propertyId: property.id, roomTypeId: deluxeType.id, name: 'Best Available Rate', basePrice: 3500, mealPlan: 'none' } })
  await prisma.ratePlan.upsert({ where: { id: 'rp-bar-pool' }, update: {}, create: { id: 'rp-bar-pool', propertyId: property.id, roomTypeId: poolVillaType.id, name: 'Best Available Rate', basePrice: 8500, mealPlan: 'none' } })
  await prisma.ratePlan.upsert({ where: { id: 'rp-bar-beach' }, update: {}, create: { id: 'rp-bar-beach', propertyId: property.id, roomTypeId: beachVillaType.id, name: 'Best Available Rate', basePrice: 12000, mealPlan: 'none' } })
  console.log('✅ Rate Plans')

  // ============================================================
  // DEMO DATA
  // ============================================================

  // --- Guests (10 คน) ---
  const guestsData = [
    { id: 'guest-001', firstName: 'ประวิทย์', lastName: 'สมใจ', phone: '081-234-5678', email: 'prawit@email.com', nationality: 'ไทย' },
    { id: 'guest-002', firstName: 'วิภา', lastName: 'รุ่งเรือง', phone: '089-765-4321', email: 'wipa@email.com', nationality: 'ไทย' },
    { id: 'guest-003', firstName: 'James', lastName: 'Wilson', phone: '+44-7700-900123', email: 'james.wilson@email.com', nationality: 'อังกฤษ' },
    { id: 'guest-004', firstName: 'สุชาติ', lastName: 'มณีวรรณ', phone: '092-111-2233', email: 'suchat@email.com', nationality: 'ไทย' },
    { id: 'guest-005', firstName: 'Yuki', lastName: 'Tanaka', phone: '+81-90-1234-5678', email: 'yuki.tanaka@email.com', nationality: 'ญี่ปุ่น' },
    { id: 'guest-006', firstName: 'นภา', lastName: 'ทองดี', phone: '086-555-7890', email: 'napa@email.com', nationality: 'ไทย' },
    { id: 'guest-007', firstName: 'Chen', lastName: 'Wei', phone: '+86-138-0000-1234', email: 'chen.wei@email.com', nationality: 'จีน' },
    { id: 'guest-008', firstName: 'อรพรรณ', lastName: 'ดวงดี', phone: '083-444-5566', email: 'oraphan@email.com', nationality: 'ไทย' },
    { id: 'guest-009', firstName: 'Michael', lastName: 'Brown', phone: '+1-555-0101', email: 'michael.brown@email.com', nationality: 'อเมริกัน' },
    { id: 'guest-010', firstName: 'สมศักดิ์', lastName: 'ชัยมงคล', phone: '096-888-9900', email: 'somsak@email.com', nationality: 'ไทย' },
  ]

  for (const g of guestsData) {
    await prisma.guest.upsert({ where: { id: g.id }, update: {}, create: { ...g, propertyId: property.id } })
  }
  console.log('✅ Guests (10 คน)')

  // --- Bookings ---
  const today = new Date()
  const getDate = (daysFromNow: number) => {
    const d = new Date(today)
    d.setDate(d.getDate() + daysFromNow)
    d.setHours(0, 0, 0, 0)
    return d
  }

  const bookingsData = [
    // กำลังเข้าพักอยู่ (checked_in)
    {
      id: 'booking-001', bookingNumber: 'BK2606001', guestId: 'guest-001', roomTypeId: deluxeType.id, roomId: 'room-201',
      checkIn: getDate(-2), checkOut: getDate(1), adults: 2, children: 0, rate: 3500,
      sourceId: 'src-walkin', status: 'checked_in', roomStatus: 'occupied'
    },
    {
      id: 'booking-002', bookingNumber: 'BK2606002', guestId: 'guest-003', roomTypeId: poolVillaType.id, roomId: 'room-pv1',
      checkIn: getDate(-1), checkOut: getDate(3), adults: 2, children: 1, rate: 8500,
      sourceId: 'src-agoda', status: 'checked_in', roomStatus: 'occupied'
    },
    // วันนี้ต้อง check-in (confirmed)
    {
      id: 'booking-003', bookingNumber: 'BK2606003', guestId: 'guest-002', roomTypeId: beachVillaType.id, roomId: 'room-bv1',
      checkIn: getDate(0), checkOut: getDate(3), adults: 2, children: 0, rate: 12000,
      sourceId: 'src-line', status: 'confirmed', roomStatus: 'clean'
    },
    {
      id: 'booking-004', bookingNumber: 'BK2606004', guestId: 'guest-005', roomTypeId: standardType.id, roomId: 'room-101',
      checkIn: getDate(0), checkOut: getDate(2), adults: 1, children: 0, rate: 2500,
      sourceId: 'src-booking', status: 'confirmed', roomStatus: 'clean'
    },
    // อนาคต
    {
      id: 'booking-005', bookingNumber: 'BK2606005', guestId: 'guest-004', roomTypeId: deluxeType.id, roomId: null,
      checkIn: getDate(2), checkOut: getDate(5), adults: 2, children: 2, rate: 3500,
      sourceId: 'src-facebook', status: 'confirmed', roomStatus: null
    },
    {
      id: 'booking-006', bookingNumber: 'BK2606006', guestId: 'guest-007', roomTypeId: beachVillaType.id, roomId: null,
      checkIn: getDate(4), checkOut: getDate(7), adults: 4, children: 0, rate: 14000,
      sourceId: 'src-agoda', status: 'confirmed', roomStatus: null
    },
    // เพิ่งออกไป (checked_out)
    {
      id: 'booking-007', bookingNumber: 'BK2606007', guestId: 'guest-006', roomTypeId: standardType.id, roomId: 'room-102',
      checkIn: getDate(-3), checkOut: getDate(-1), adults: 2, children: 0, rate: 2500,
      sourceId: 'src-walkin', status: 'checked_out', roomStatus: 'dirty'
    },
    {
      id: 'booking-008', bookingNumber: 'BK2606008', guestId: 'guest-009', roomTypeId: poolVillaType.id, roomId: 'room-pv2',
      checkIn: getDate(-4), checkOut: getDate(0), adults: 2, children: 0, rate: 8500,
      sourceId: 'src-traveloka', status: 'checked_out', roomStatus: 'dirty'
    },
  ]

  for (const b of bookingsData) {
    const existing = await prisma.booking.findUnique({ where: { id: b.id } })
    if (existing) continue

    await prisma.$transaction(async (tx) => {
      // Update room status if assigned
      if (b.roomId && b.roomStatus) {
        await tx.room.update({ where: { id: b.roomId }, data: { currentStatus: b.roomStatus } })
      }

      const booking = await tx.booking.create({
        data: {
          id: b.id,
          propertyId: property.id,
          bookingNumber: b.bookingNumber,
          guestId: b.guestId,
          bookingSourceId: b.sourceId,
          status: b.status,
          checkInDate: b.checkIn,
          checkOutDate: b.checkOut,
          adults: b.adults,
          children: b.children,
          createdBy: adminUser!.id,
          bookingRooms: {
            create: {
              roomTypeId: b.roomTypeId,
              roomId: b.roomId,
              checkInDate: b.checkIn,
              checkOutDate: b.checkOut,
              adults: b.adults,
              children: b.children,
              rate: b.rate,
              status: b.status,
            }
          },
          folios: {
            create: {
              folioCode: 'A',
              folioType: 'master',
              guestId: b.guestId,
              status: b.status === 'checked_out' ? 'closed' : 'open',
              closedAt: b.status === 'checked_out' ? new Date() : null,
            }
          }
        },
        include: { folios: true }
      })

      // Add room charge to folio
      const nights = Math.ceil((b.checkOut.getTime() - b.checkIn.getTime()) / (1000 * 60 * 60 * 24))
      const roomType = await tx.roomType.findUnique({ where: { id: b.roomTypeId } })
      await tx.folioItem.create({
        data: {
          folioId: booking.folios[0].id,
          itemType: 'room_charge',
          description: `ค่าห้อง ${roomType?.name} (${nights} คืน)`,
          quantity: nights,
          unitPrice: b.rate,
          totalAmount: b.rate * nights,
          serviceDate: b.checkIn,
          createdBy: adminUser!.id,
        }
      })

      // Add payment for checked_out bookings
      if (b.status === 'checked_out') {
        await tx.payment.create({
          data: {
            folioId: booking.folios[0].id,
            paymentMethod: 'cash',
            amount: b.rate * nights,
            receivedBy: adminUser!.id,
            status: 'paid',
          }
        })
      }

      // Add deposit for checked_in bookings
      if (b.status === 'checked_in') {
        await tx.deposit.create({
          data: {
            bookingId: booking.id,
            folioId: booking.folios[0].id,
            amount: b.rate,
            depositType: 'booking_deposit',
            paymentMethod: 'transfer',
            status: 'held',
            receivedBy: adminUser!.id,
          }
        })
      }
    })
  }
  console.log('✅ Bookings (8 รายการ)')

  // --- Housekeeping Tasks ---
  const hkTasks = [
    { id: 'hk-001', roomId: 'room-102', taskType: 'checkout_cleaning', status: 'pending' },
    { id: 'hk-002', roomId: 'room-pv2', taskType: 'checkout_cleaning', status: 'in_progress' },
    { id: 'hk-003', roomId: 'room-103', taskType: 'stayover_cleaning', status: 'pending' },
    { id: 'hk-004', roomId: 'room-202', taskType: 'stayover_cleaning', status: 'done' },
  ]

  for (const t of hkTasks) {
    const existing = await prisma.housekeepingTask.findUnique({ where: { id: t.id } })
    if (!existing) {
      await prisma.housekeepingTask.create({
        data: {
          id: t.id,
          propertyId: property.id,
          roomId: t.roomId,
          taskType: t.taskType,
          status: t.status,
          startedAt: t.status === 'in_progress' || t.status === 'done' ? new Date() : null,
          completedAt: t.status === 'done' ? new Date() : null,
        }
      })
    }
  }

  // Update room-102 and room-pv2 to dirty (from checkout)
  await prisma.room.updateMany({ where: { id: { in: ['room-102', 'room-pv2'] } }, data: { currentStatus: 'dirty' } })
  await prisma.room.update({ where: { id: 'room-103' }, data: { currentStatus: 'cleaning' } })
  console.log('✅ Housekeeping Tasks (4 งาน)')

  // --- Maintenance Tickets ---
  const maintenanceData = [
    { id: 'mt-001', roomId: 'room-203', issueTitle: 'แอร์ไม่เย็น', issueDetail: 'แอร์ทำงานแต่ลมไม่เย็น อาจต้องเติมน้ำยา', priority: 'high', status: 'open' },
    { id: 'mt-002', roomId: 'room-103', issueTitle: 'ก๊อกน้ำรั่ว', issueDetail: 'ก๊อกน้ำในห้องน้ำรั่วหยด น้ำไม่หยุด', priority: 'medium', status: 'in_progress' },
    { id: 'mt-003', roomId: null, issueTitle: 'ไฟบริเวณสระน้ำไม่ติด', issueDetail: 'หลอดไฟรอบสระน้ำ 3 ดวงไม่ติด', priority: 'low', status: 'open' },
    { id: 'mt-004', roomId: 'room-pv1', issueTitle: 'ทีวีไม่มีสัญญาณ', issueDetail: 'ทีวีในห้องนอนไม่มีสัญญาณ', priority: 'medium', status: 'resolved' },
  ]

  for (const m of maintenanceData) {
    const existing = await prisma.maintenanceTicket.findUnique({ where: { id: m.id } })
    if (!existing) {
      await prisma.maintenanceTicket.create({
        data: {
          id: m.id,
          propertyId: property.id,
          roomId: m.roomId,
          issueTitle: m.issueTitle,
          issueDetail: m.issueDetail,
          priority: m.priority,
          status: m.status,
          reportedBy: adminUser!.id,
          resolvedBy: m.status === 'resolved' ? adminUser!.id : null,
          resolvedAt: m.status === 'resolved' ? new Date() : null,
        }
      })
    }
  }
  // Set room-203 as OOO due to high priority maintenance
  await prisma.room.update({ where: { id: 'room-203' }, data: { currentStatus: 'out_of_order' } })
  console.log('✅ Maintenance Tickets (4 รายการ)')

  console.log('\n🎉 Seed complete! Demo data ready.')
  console.log('📱 Login:')
  console.log('  Admin:        0800000001 / 000000')
  console.log('  Front Desk:   0800000002 / 000000 (must change)')
  console.log('  Housekeeping: 0800000003 / 000000 (must change)')
  console.log('\n📊 Demo Data:')
  console.log('  Guests: 10 คน | Bookings: 8 รายการ | HK Tasks: 4 | Maintenance: 4')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
