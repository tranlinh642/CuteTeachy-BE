import { SendTestNotificationUseCase } from '../../../../src/application/push-subscription/send-test-notification.use-case';
import { SendPushToTeacherUseCase } from '../../../../src/application/push-subscription/send-push-to-teacher.use-case';
import { InMemoryInAppNotificationRepository } from '../../../fakes/in-memory-in-app-notification.repository';
import { InMemoryPushSubscriptionRepository } from '../../../fakes/in-memory-push-subscription.repository';
import { InMemorySettingsRepository } from '../../../fakes/in-memory-settings.repository';
import { FakePushSender } from '../../../fakes/fake-push-sender';
import { FixedClock } from '../../../fakes/fixed-clock';
import { PushSubscription } from '../../../../src/domain/push-subscription/push-subscription.entity';
import { Settings } from '../../../../src/domain/settings/settings.entity';
import { IdGenerator } from '../../../../src/application/shared/ports/id-generator.port';

describe('SendTestNotificationUseCase', () => {
  let inAppRepo: InMemoryInAppNotificationRepository;
  let pushSubRepo: InMemoryPushSubscriptionRepository;
  let settingsRepo: InMemorySettingsRepository;
  let fakePushSender: FakePushSender;
  let sendPushUseCase: SendPushToTeacherUseCase;
  let clock: FixedClock;
  let idGenerator: IdGenerator;
  let useCase: SendTestNotificationUseCase;

  const teacherId = 'teacher-test-1';
  const now = new Date('2026-10-29T09:00:00.000Z');
  const baseKeys = {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  };

  beforeEach(() => {
    inAppRepo = new InMemoryInAppNotificationRepository();
    pushSubRepo = new InMemoryPushSubscriptionRepository();
    settingsRepo = new InMemorySettingsRepository();
    fakePushSender = new FakePushSender();
    sendPushUseCase = new SendPushToTeacherUseCase(pushSubRepo, fakePushSender);
    clock = new FixedClock(now);
    let seq = 1;
    idGenerator = {
      next: () => `test-notif-${seq++}`,
      generate: () => `test-notif-${seq++}`,
    };

    useCase = new SendTestNotificationUseCase(
      inAppRepo,
      sendPushUseCase,
      settingsRepo,
      clock,
      idGenerator,
    );
  });

  it('creates an in-app system notification even when teacher has no push subscriptions', async () => {
    const result = await useCase.execute({ accountId: teacherId });

    expect(result).toEqual({
      sent: 0,
      failed: 0,
      inAppCreated: true,
    });

    const notifications = await inAppRepo.findByAccountId(teacherId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe('system');
    expect(notifications[0].targetId).toBeNull();
    expect(notifications[0].title).toContain('CuteTeachy');
    expect(notifications[0].readAt).toBeNull();
    expect(fakePushSender.getSentMessages()).toHaveLength(0);
  });

  it('creates an in-app notification localized to teacher locale and sends Web Push to active subscriptions (removing expired ones)', async () => {
    await settingsRepo.save(
      Settings.reconstitute({
        id: 's-1',
        accountId: teacherId,
        locale: 'en',
        timeZone: 'Asia/Ho_Chi_Minh',
        pushEnabled: true,
        reminderLeadMinutes: 15,
        createdAt: now,
        updatedAt: now,
      }),
    );

    const activeSub = PushSubscription.create({
      id: 'sub-active',
      accountId: teacherId,
      endpoint: 'https://push.example.com/active',
      keys: baseKeys,
      now,
    });
    const expiredSub = PushSubscription.create({
      id: 'sub-expired',
      accountId: teacherId,
      endpoint: 'https://push.example.com/expired',
      keys: baseKeys,
      now,
    });
    await pushSubRepo.save(activeSub);
    await pushSubRepo.save(expiredSub);
    fakePushSender.markExpired('https://push.example.com/expired');

    const result = await useCase.execute({ accountId: teacherId });

    expect(result).toEqual({
      sent: 1,
      failed: 0,
      inAppCreated: true,
    });

    const notifications = await inAppRepo.findByAccountId(teacherId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Test notification from CuteTeachy');

    expect(fakePushSender.getSentMessages()).toHaveLength(1);
    expect(fakePushSender.getSentMessages()[0].target.endpoint).toBe(
      'https://push.example.com/active',
    );

    const remainingSubs = await pushSubRepo.findByAccountId(teacherId);
    expect(remainingSubs).toHaveLength(1);
    expect(remainingSubs[0].endpoint).toBe('https://push.example.com/active');
  });
});
