# Serene PMS — Workflow & Business Flow

---

## 🏨 Flow หลักของระบบ

```
การจอง → Check-in → เข้าพัก → Check-out → ทำความสะอาด → พร้อมขายใหม่
```

---

## 1. การจอง (Booking Flow)

```
Front Desk / ลูกค้าโทรมา / OTA
        ↓
ไปที่ /room-grid หรือ /bookings
        ↓
กด "สร้างการจอง"
        ↓
[Step 1] ค้นหาลูกค้าเดิม หรือสร้างลูกค้าใหม่
         + เลือกวันเช็คอิน / วันเช็คเอาท์
        ↓
[Step 2] เลือกประเภทห้อง (เห็นว่าเหลือกี่ห้อง)
         + เลือกห้องจริง (ถ้าต้องการ)
         + ใส่ราคา, ช่องทางการจอง
         + Package (ถ้ามี)
         + มัดจำ (ถ้ารับตอนนี้)
         + [  ] จองชั่วคราว (รอยืนยัน) ← ติ๊กถ้าลูกค้ายังไม่ยืนยัน
        ↓
ไม่ติ๊ก → Status: Confirmed (ทำ Check-in ได้เลย)
ติ๊ก    → Status: Pending  (รอยืนยันก่อน)
        ↓
(ถ้าเลือกห้องจริงแล้ว) → แสดงใน Room Grid ทันที
(ถ้ายังไม่เลือกห้อง) → แสดงใน "รอกำหนดห้อง" บน Room Grid
```

### สถานะ Pending — การยืนยัน

```
Booking (Pending)
        ↓
ทาง 1: Front Desk กดปุ่ม "ยืนยันการจอง" เอง
        (เช่น ลูกค้าโทรยืนยัน หรือส่ง Line มาแล้ว)
        ↓
ทาง 2: กด "รับมัดจำ" → ระบบ Auto-confirm ให้อัตโนมัติ
        ↓
Status → Confirmed (Check-in ได้แล้ว)
```

> **หมายเหตุ:** Pending booking ไม่สามารถ Check-in ได้โดยตรง

**หลังจองแล้ว อาจทำต่อ:**
- รับมัดจำเพิ่ม → ปุ่ม "รับมัดจำ" ในหน้า booking detail
- แก้ไขวันที่/จำนวนคน → ปุ่ม "แก้ไข"
- Assign ห้องจริง → ปุ่ม "กำหนดห้อง" ในหน้า booking detail
- ยืนยัน (จาก Pending) → ปุ่ม "ยืนยันการจอง" สีเขียว
- ยกเลิก → ปุ่ม "ยกเลิก"

---

## 2. Check-in Flow

```
ลูกค้ามาถึง
        ↓
ค้นหาการจองใน /bookings หรือ /room-grid
        ↓
เปิดหน้า Booking Detail
        ↓
ตรวจสอบข้อมูลลูกค้า + ห้องพัก
        ↓
(ถ้ายังไม่มีห้อง) → กด "กำหนดห้อง" เลือกห้องที่ว่าง
        ↓
กด "Check-in" → Confirm Dialog ยืนยัน
        ↓
ระบบตรวจสอบ:
  ✓ ห้องต้องเป็น Clean / Inspected
  ✓ ลูกค้าไม่ติด Blacklist
  ✓ Booking status เป็น Confirmed
        ↓
Check-in สำเร็จ:
  - Booking status → Checked In
  - Room status → Occupied
  - บันทึก Audit Log
```

**หลัง Check-in:**
- เพิ่มค่าใช้จ่ายเพิ่มเติมได้ที่ Folio (อาหาร, minibar ฯลฯ)
- เพิ่มส่วนลดได้ที่ Folio
- ปรับราคาห้องได้ (Admin/Front Desk ที่มีสิทธิ์)

---

## 3. ระหว่างเข้าพัก

```
ลูกค้าเข้าพักอยู่ (Status: Checked In)
        ↓
Front Desk สามารถ:
  - เพิ่มค่าใช้จ่ายใน Folio
  - รับชำระเงินบางส่วน
  - ย้ายห้อง (ถ้าลูกค้าต้องการ)
  - บันทึกมัดจำเพิ่มเติม
        ↓
Housekeeping:
  - ดูรายการห้อง "Stay-over" ที่ต้องทำความสะอาด
  - กด "เริ่มทำ" → ห้องเป็น Cleaning
  - กด "เสร็จแล้ว" → ห้องกลับมาเป็น Clean
```

---

## 4. Check-out Flow

```
ลูกค้าจะออก
        ↓
เปิดหน้า Booking Detail
        ↓
ตรวจสอบ Folio:
  - รายการค่าใช้จ่ายทั้งหมด
  - ยอดมัดจำที่ถืออยู่ (จะถูกหักอัตโนมัติ)
  - ยอดที่ต้องชำระเพิ่ม
        ↓
(ถ้ายังค้างชำระ) → กด "รับชำระ" ใน Folio
        ↓
กด "Check-out" → Confirm Dialog ยืนยัน
        ↓
ระบบดำเนินการ:
  ✓ Auto-apply มัดจำที่ถืออยู่
  ✓ ตรวจสอบ Balance = 0
  ✓ ปิด Folio
  ✓ Booking status → Checked Out
  ✓ Room status → Dirty
  ✓ สร้าง Housekeeping Task อัตโนมัติ
  ✓ บันทึก Audit Log
        ↓
ออกใบเสร็จ → ปุ่ม "ใบเสร็จ" (print-ready)
```

---

## 5. Housekeeping Flow

```
ลูกค้า Check-out
        ↓
ระบบสร้าง Housekeeping Task (checkout_cleaning) อัตโนมัติ
Room status → Dirty
        ↓
แม่บ้านเปิดหน้า /housekeeping บนมือถือ/แท็บเล็ต
        ↓
เห็นห้องที่ต้องทำ → Confirm แล้วกด "เริ่มทำ"
Room status → Cleaning
        ↓
ทำเสร็จ → กด "เสร็จแล้ว" + ใส่หมายเหตุ (ถ้ามี)
Room status → Clean
        ↓
Front Desk เห็นห้องพร้อมขายใน Room Grid ทันที
```

---

## 6. Cancellation Flow

```
ลูกค้าต้องการยกเลิก
        ↓
เปิด Booking Detail → กด "ยกเลิก"
        ↓
ใส่เหตุผล → ยืนยัน
        ↓
ระบบดำเนินการ:
  - Booking status → Cancelled
  - BookingRooms → Cancelled
  - Void room charges ใน Folio
  - คืนมัดจำ (held → refunded)
  - บันทึก Audit Log
        ↓
(ถ้ามีค่าปรับยกเลิก) → เพิ่ม charge ใน Folio ด้วยตัวเอง
```

---

## 7. No Show Flow

```
ลูกค้าไม่มาตามนัด
        ↓
Front Desk เปิด Booking Detail → กด "No Show"
        ↓
ระบุค่าปรับ (ถ้ามี) → ยืนยัน
        ↓
ระบบดำเนินการ:
  - Booking status → No Show
  - BookingRooms → Cancelled
  - Post no-show fee ไปยัง Folio (ถ้ามี)
  - บันทึก Audit Log
```

---

## 8. Out of Order Flow

```
ห้องพักมีปัญหา (แอร์เสีย, น้ำรั่ว ฯลฯ)
        ↓
ใน Room Grid: Hover ที่ห้อง → กด "⚠ OOO"
หรือ ไปที่ /maintenance → สร้างใบแจ้งซ่อม
        ↓
ห้อง status → Out of Order
ห้องหายจาก Availability (ขายไม่ได้)
        ↓
ซ่อมเสร็จ → ไป /maintenance → กด "แก้ไขแล้ว"
หรือ Hover ที่ห้องใน Room Grid → กด "✓ Clear"
        ↓
ห้อง status → Clean (กลับมาขายได้)
```

---

## 9. Folio & Payment Flow

```
Folio เปิดตั้งแต่สร้างการจอง
        ↓
Front Desk เพิ่มค่าใช้จ่ายได้ตลอดที่พัก:
  - ค่าห้อง (เพิ่มอัตโนมัติตอนจอง)
  - Minibar, อาหาร, Extra bed ฯลฯ
  - ส่วนลด
        ↓
รับชำระได้หลายช่องทางในบิลเดียว:
  เงินสด + โอน + บัตรเครดิต
        ↓
Void รายการ → รายการถูกยกเลิก (ไม่ลบจริง)
Refund → คืนเงินจากรายการที่จ่ายแล้ว
        ↓
Balance = 0 → ปิด Folio ได้ (หรือ Check-out)
        ↓
ออกใบเสร็จ → /bookings/:id/receipt
```

---

## Role & Permission Summary

| Action | Admin | Front Desk | Housekeeping |
|--------|-------|-----------|--------------|
| สร้าง/แก้ไขการจอง | ✅ | ✅ | ❌ |
| Check-in / Check-out | ✅ | ✅ | ❌ |
| รับชำระเงิน | ✅ | ✅ | ❌ |
| Void Payment | ✅ | ✅ | ❌ |
| Refund | ✅ | ❌ | ❌ |
| ดู Audit Log | ✅ | ❌ | ❌ |
| จัดการ Users | ✅ | ❌ | ❌ |
| ตั้ง Rate Plan | ✅ | ❌ | ❌ |
| อัปโหลดรูปภาพ | ✅ | ❌ | ❌ |
| งานแม่บ้าน | ✅ | ✅ | ✅ |
| แจ้งซ่อม | ✅ | ✅ | ✅ |
