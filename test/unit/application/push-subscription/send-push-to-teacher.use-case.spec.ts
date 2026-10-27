import { SendPushToTeacherUseCase } from '../../../../src/application/push-subscription/send-push-to-teacher.use-case';
import { InMemoryPushSubscriptionRepository } from '../../../fakes/in-memory-push-subscription.repository';
import { FakePushSender } from '../../../fakes/fake-push-sender';
import { PushSubscription } from '../../../../src/domain/push-subscription/push-subscription.entity';
import { PushSubscriptionValidationError } from '../../../../src/domain/push-subscription/push-subscription.errors';

describe('SendPushToTeacherUseCase', () => {
  let repository: InMemoryPushSubscriptionRepository;
  let fakePushSender: FakePushSender;
  let useCase: SendPushToTeacherUseCase;

  const baseKeys = {
    p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9t044Yjs2Bm',
    auth: 'tBHItJI5svbpez7KI4CCXg',
  };
  const now = new Date('2026-10-27T10:00:00Z');

  beforeEach(() => {
    repository = new InMemoryPushSubscriptionRepository();
    fakePushSender = new FakePushSender();
    useCase = new SendPushToTeacherUseCase(repository, fakePushSender);
  });

  it('sends push to all devices registered for the teacher', async () => {
    const sub1 = PushSubscription.create({
      id: 'sub-phone',
      accountId: 'teacher-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/phone',
      keys: baseKeys,
      now,
    });
    const sub2 = PushSubscription.create({
      id: 'sub-laptop',
      accountId: 'teacher-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/laptop',
      keys: baseKeys,
      now,
    });
    await repository.save(sub1);
    await repository.save(sub2);

    const payload = {
      title: 'Nhắc nhở tiết dạy',
      body: 'Tiết 1: Toán 9A sẽ bắt đầu sau 15 phút',
      url: '/timetable?date=2026-10-27',
    };

    const result = await useCase.execute({
      accountId: 'teacher-1',
      payload,
    });

    expect(result).toEqual({
      total: 2,
      sent: 2,
      expired: 0,
      failed: 0,
    });

    const sentMessages = fakePushSender.getSentMessages();
    expect(sentMessages).toHaveLength(2);
    expect(sentMessages[0].payload).toEqual(payload);
    expect(sentMessages[1].payload).toEqual(payload);
  });

  it('automatically removes an expired (404/410) subscription from database and delivers to remaining devices', async () => {
    const activeSub = PushSubscription.create({
      id: 'sub-active',
      accountId: 'teacher-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/active-device',
      keys: baseKeys,
      now,
    });
    const expiredSub = PushSubscription.create({
      id: 'sub-expired',
      accountId: 'teacher-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/expired-device',
      keys: baseKeys,
      now,
    });
    await repository.save(activeSub);
    await repository.save(expiredSub);

    // Mark the second device as expired in push sender
    fakePushSender.markExpired('https://fcm.googleapis.com/fcm/send/expired-device');

    const result = await useCase.execute({
      accountId: 'teacher-1',
      payload: {
        title: 'Nhắc việc',
        body: 'Soạn giáo án',
      },
    });

    expect(result).toEqual({
      total: 2,
      sent: 1,
      expired: 1,
      failed: 0,
    });

    // The expired subscription should have been removed from the database
    const remainingSubs = await repository.findByAccountId('teacher-1');
    expect(remainingSubs).toHaveLength(1);
    expect(remainingSubs[0].endpoint).toBe('https://fcm.googleapis.com/fcm/send/active-device');

    const deletedSub = await repository.findByEndpoint(
      'https://fcm.googleapis.com/fcm/send/expired-device',
    );
    expect(deletedSub).toBeNull();
  });

  it('handles general send failures without deleting the subscription', async () => {
    const sub = PushSubscription.create({
      id: 'sub-flake',
      accountId: 'teacher-1',
      endpoint: 'https://fcm.googleapis.com/fcm/send/flake-device',
      keys: baseKeys,
      now,
    });
    await repository.save(sub);

    fakePushSender.markFailed(
      'https://fcm.googleapis.com/fcm/send/flake-device',
      new Error('Temporary network timeout'),
    );

    const result = await useCase.execute({
      accountId: 'teacher-1',
      payload: {
        title: 'Nhắc việc',
        body: 'Nộp sổ điểm',
      },
    });

    expect(result).toEqual({
      total: 1,
      sent: 0,
      expired: 0,
      failed: 1,
    });

    // Subscription must NOT be deleted on temporary network failure
    const stillThere = await repository.findByEndpoint(
      'https://fcm.googleapis.com/fcm/send/flake-device',
    );
    expect(stillThere).not.toBeNull();
  });

  it('returns zeros when teacher has no registered subscriptions', async () => {
    const result = await useCase.execute({
      accountId: 'teacher-with-no-devices',
      payload: {
        title: 'Test',
        body: 'Hello',
      },
    });

    expect(result).toEqual({
      total: 0,
      sent: 0,
      expired: 0,
      failed: 0,
    });
  });

  it('throws validation error if accountId or payload is missing', async () => {
    await expect(
      useCase.execute({
        accountId: '',
        payload: { title: 'Test', body: 'Body' },
      }),
    ).rejects.toThrow(PushSubscriptionValidationError);

    await expect(
      useCase.execute({
        accountId: 't-1',
        payload: { title: '', body: 'Body' },
      }),
    ).rejects.toThrow(PushSubscriptionValidationError);
  });
});
