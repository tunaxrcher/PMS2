import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')

  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // forbidNonWhitelisted removed — many endpoints use inline types (not DTO classes)
      // whitelist: true still strips extra fields from proper DTO classes
    })
  )

  const port = process.env.PORT || 3001
  await app.listen(port)
  console.log(`🚀 Serene PMS API running on http://localhost:${port}/api`)
}
bootstrap()
