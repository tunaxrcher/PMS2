import {
  Controller, Post, UploadedFile, UseGuards, UseInterceptors, BadRequestException
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { UploadService } from './upload.service'
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator'

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private uploadService: UploadService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('กรุณาเลือกไฟล์')
    const url = await this.uploadService.uploadFile(file, 'images')
    return { url, success: true }
  }

  @Post('room-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    })
  )
  async uploadRoomImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('กรุณาเลือกไฟล์')
    const url = await this.uploadService.uploadFile(file, 'rooms')
    return { url, success: true }
  }
}
