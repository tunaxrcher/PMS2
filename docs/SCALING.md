# Scaling Notes — Serene PMS

> บันทึกสิ่งที่ต้องทำเมื่อระบบมีผู้ใช้งานมากขึ้น

---

## 🔴 Priority 1: WebSocket (Real-time Room Status)

**เมื่อไหร่ถึงทำ**: Staff ใช้พร้อมกัน 5+ คน หรือลูกค้าบ่นว่า room map ข้อมูลไม่ทันสมัย

### ปัจจุบัน
- Room Map polling แบบ silent ทุก **3 นาที**
- Room Grid refetch ทุก **15 วินาที** (TanStack Query)

### สิ่งที่ต้องทำ

#### Backend (NestJS) — ~2-3 ไฟล์ใหม่
```bash
pnpm add @nestjs/websockets @nestjs/platform-socket.io socket.io
```

```typescript
// apps/api/src/rooms/room.gateway.ts
@WebSocketGateway({ cors: { origin: '*' } })
export class RoomGateway {
  @WebSocketServer() server: Server

  emitRoomUpdated(propertyId: string, roomId: string, status: string) {
    this.server.to(`property:${propertyId}`).emit('room:updated', { roomId, status })
  }

  @SubscribeMessage('join:property')
  handleJoin(client: Socket, propertyId: string) {
    client.join(`property:${propertyId}`)
  }
}
```

```typescript
// Inject และเรียก emitRoomUpdated ใน:
// - rooms.service.ts → updateStatus()
// - bookings.service.ts → checkIn(), checkOut()
// - housekeeping.service.ts → updateTaskStatus()
```

#### Nginx — เพิ่ม 3 บรรทัดใน config
```nginx
location /socket.io/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
}
```

#### Frontend — hook ใหม่แทน polling
```typescript
// apps/web/src/hooks/use-room-socket.ts
import { useEffect } from 'react'
import { io } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

export function useRoomSocket(propertyId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_API_URL)
    socket.emit('join:property', propertyId)
    socket.on('room:updated', () => {
      qc.invalidateQueries({ queryKey: ['room-map'] })
      qc.invalidateQueries({ queryKey: ['room-grid'] })
    })
    return () => { socket.disconnect() }
  }, [propertyId, qc])
}
```

```bash
# Frontend dependency
pnpm add socket.io-client --filter web
```

#### ไฟล์ที่ต้องแก้ใน Frontend
- `room-map/page.tsx` — ลบ `setInterval` polling, ใช้ `useRoomSocket` แทน
- `room-grid/page.tsx` — ลบ `refetchInterval`, ใช้ `useRoomSocket` แทน
- `dashboard/page.tsx` — optional, ใช้ socket สำหรับ notifications

---

## 🟡 Priority 2: Redis Adapter (Multi-process/Multi-server)

**เมื่อไหร่ถึงทำ**: ตอนที่ต้องรัน PM2 cluster mode หรือ deploy หลาย server

### ปัญหา
PM2 cluster = หลาย Node.js processes → Socket.IO บน process A ไม่รู้จัก client บน process B

### วิธีแก้
```bash
pnpm add @socket.io/redis-adapter ioredis --filter api
```

```typescript
// main.ts
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'redis'

const pubClient = createClient({ url: 'redis://localhost:6379' })
const subClient = pubClient.duplicate()
io.adapter(createAdapter(pubClient, subClient))
```

---

## 🟢 Priority 3: Database Connection Pooling

**เมื่อไหร่ถึงทำ**: เริ่มเห็น "Too many connections" error ใน logs

### ปัจจุบัน
Prisma default connection pool = 10 connections

### แก้
```env
# .env
DATABASE_URL="mysql://...?connection_limit=25&pool_timeout=20"
```

---

## 🟢 Priority 4: Caching Layer (Redis)

**เมื่อไหร่ถึงทำ**: Dashboard/Reports โหลดช้า (>2s)

### ใช้ Redis cache สำหรับ
- `reportsApi.dashboard()` — cache 1 นาที
- `roomsApi.map()` — cache 30 วินาที (invalidate เมื่อ room update)
- `roomTypesApi.list()`, `zonesApi.flat()` — cache 5 นาที

---

## สรุปลำดับความสำคัญ

| Priority | Feature | ทำเมื่อ | Effort |
|----------|---------|---------|--------|
| 1 | WebSocket real-time | Staff > 5 คนพร้อมกัน | 1-2 วัน |
| 2 | Redis Socket adapter | PM2 cluster / multi-server | 2 ชั่วโมง |
| 3 | DB connection pool | เริ่มมี DB errors | 5 นาที |
| 4 | Redis cache | Reports/Dashboard ช้า | ครึ่งวัน |

---

*Last updated: June 2026*
