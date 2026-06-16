import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator'
import { JwtPayload } from '../decorators/current-user.decorator'

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!required || required.length === 0) return true

    const request = context.switchToHttp().getRequest()
    const user: JwtPayload = request.user

    if (!user) throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึง')

    const hasPermission = required.every((perm) => user.permissions?.includes(perm))
    if (!hasPermission) {
      throw new ForbiddenException('ไม่มีสิทธิ์ในการดำเนินการนี้')
    }
    return true
  }
}
