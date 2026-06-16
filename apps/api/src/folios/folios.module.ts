import { Module } from '@nestjs/common'
import { FoliosController, PaymentsController, DepositsController } from './folios.controller'
import { FoliosService } from './folios.service'

@Module({
  controllers: [FoliosController, PaymentsController, DepositsController],
  providers: [FoliosService],
  exports: [FoliosService],
})
export class FoliosModule {}
