import { Injectable } from '@nestjs/common';
import { PushSubscriptionRepository } from '../../../../application/push-subscription/ports/push-subscription.repository.port';
import { PushSubscription } from '../../../../domain/push-subscription/push-subscription.entity';
import { PrismaService } from '../prisma.service';
import { PushSubscriptionMapper } from '../mappers/push-subscription.mapper';

@Injectable()
export class PrismaPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEndpoint(endpoint: string): Promise<PushSubscription | null> {
    const raw = await this.prisma.pushSubscription.findUnique({
      where: { endpoint },
    });
    return raw ? PushSubscriptionMapper.toDomain(raw) : null;
  }

  async findByAccountId(accountId: string): Promise<PushSubscription[]> {
    const list = await this.prisma.pushSubscription.findMany({
      where: { accountId },
      orderBy: { createdAt: 'asc' },
    });
    return list.map(PushSubscriptionMapper.toDomain);
  }

  async save(subscription: PushSubscription): Promise<void> {
    const createData = PushSubscriptionMapper.toPrismaCreate(subscription);
    const updateData = PushSubscriptionMapper.toPrismaUpdate(subscription);

    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: createData,
      update: updateData,
    });
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
  }
}
