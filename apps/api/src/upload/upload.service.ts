import { Injectable, BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

@Injectable()
export class UploadService {
  private s3: S3Client
  private bucket: string
  private cdnUrl: string

  constructor(private config: ConfigService) {
    const endpoint = config.get<string>('DO_SPACES_ENDPOINT') || 'https://sgp1.digitaloceanspaces.com'
    const key = config.get<string>('DO_SPACES_KEY') || ''
    const secret = config.get<string>('DO_SPACES_SECRET') || ''
    this.bucket = config.get<string>('DO_SPACES_BUCKET') || 'pms.unityx'
    const region = config.get<string>('DO_SPACES_REGION') || 'sgp1'
    // CDN URL format: https://bucket.region.cdn.digitaloceanspaces.com
    this.cdnUrl = config.get<string>('DO_SPACES_CDN_URL')
      || `https://${this.bucket}.${region}.cdn.digitaloceanspaces.com`

    this.s3 = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: key, secretAccessKey: secret },
      forcePathStyle: false,
    })
  }

  async uploadFile(file: Express.Multer.File, folder = 'uploads'): Promise<string> {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('ไฟล์ต้องเป็นรูปภาพ (JPEG, PNG, WebP, GIF)')
    }

    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      throw new BadRequestException('ขนาดไฟล์ต้องไม่เกิน 10MB')
    }

    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'jpg'
    const key = `${folder}/${uuidv4()}.${ext}`

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ACL: 'public-read',
      CacheControl: 'max-age=86400',
    })

    await this.s3.send(command)
    return `${this.cdnUrl}/${key}`
  }

  async deleteFile(url: string): Promise<void> {
    try {
      const key = url.replace(`${this.cdnUrl}/`, '')
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
    } catch {
      // Silently fail on delete - don't break the app
    }
  }
}
