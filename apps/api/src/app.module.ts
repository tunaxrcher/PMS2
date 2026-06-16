import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { PropertiesModule } from './properties/properties.module'
import { ZonesModule } from './zones/zones.module'
import { RoomTypesModule } from './room-types/room-types.module'
import { RoomsModule } from './rooms/rooms.module'
import { GuestsModule } from './guests/guests.module'
import { BookingsModule } from './bookings/bookings.module'
import { FoliosModule } from './folios/folios.module'
import { HousekeepingModule } from './housekeeping/housekeeping.module'
import { MaintenanceModule } from './maintenance/maintenance.module'
import { ReportsModule } from './reports/reports.module'
import { AuditLogsModule } from './audit-logs/audit-logs.module'
import { RatePlansModule } from './rate-plans/rate-plans.module'
import { UploadModule } from './upload/upload.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    ZonesModule,
    RoomTypesModule,
    RoomsModule,
    GuestsModule,
    BookingsModule,
    FoliosModule,
    HousekeepingModule,
    MaintenanceModule,
    ReportsModule,
    AuditLogsModule,
    RatePlansModule,
    UploadModule,
  ],
})
export class AppModule {}
