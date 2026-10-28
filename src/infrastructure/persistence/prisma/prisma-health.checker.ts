import { Injectable } from '@nestjs/common';
import type { HealthChecker } from '../../../application/shared/ports/health-checker.port';
import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaHealthChecker implements HealthChecker {
  constructor(private readonly prisma: PrismaService) {}

  async isHealthy(): Promise<boolean> {
    return this.prisma.isHealthy();
  }
}
