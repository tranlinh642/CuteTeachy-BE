import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PushSubscriptionController } from '../../../src/presentation/http/push-subscription/push-subscription.controller';
import { GetVapidPublicKeyUseCase } from '../../../src/application/push-subscription/get-vapid-public-key.use-case';
import { UpsertPushSubscriptionUseCase } from '../../../src/application/push-subscription/upsert-push-subscription.use-case';
import { DeletePushSubscriptionUseCase } from '../../../src/application/push-subscription/delete-push-subscription.use-case';
import { AccessTokenPayload } from '../../../src/application/account/ports/token.service.port';

describe('PushSubscriptionController', () => {
  let controller: PushSubscriptionController;
  let getVapidPublicKeyUseCase: jest.Mocked<GetVapidPublicKeyUseCase>;
  let upsertPushSubscriptionUseCase: jest.Mocked<UpsertPushSubscriptionUseCase>;
  let deletePushSubscriptionUseCase: jest.Mocked<DeletePushSubscriptionUseCase>;

  const mockUser: AccessTokenPayload = {
    sub: 'teacher-1',
  };

  const mockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeEach(() => {
    getVapidPublicKeyUseCase = {
      execute: jest.fn(),
    } as any;

    upsertPushSubscriptionUseCase = {
      execute: jest.fn(),
    } as any;

    deletePushSubscriptionUseCase = {
      execute: jest.fn(),
    } as any;

    controller = new PushSubscriptionController(
      getVapidPublicKeyUseCase,
      upsertPushSubscriptionUseCase,
      deletePushSubscriptionUseCase,
    );
  });

  describe('GET /push/vapid-public-key', () => {
    it('returns the VAPID public key', async () => {
      getVapidPublicKeyUseCase.execute.mockResolvedValueOnce({
        publicKey: 'mock-public-key',
      });

      const result = await controller.getVapidPublicKey();

      expect(result).toEqual({ publicKey: 'mock-public-key' });
      expect(getVapidPublicKeyUseCase.execute).toHaveBeenCalled();
    });
  });

  describe('POST /push/subscriptions', () => {
    const dto = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      keys: {
        p256dh: 'p256dh-key',
        auth: 'auth-key',
      },
    };

    it('returns 201 Created when subscription is newly created', async () => {
      const mockSubDto = {
        id: 'sub-1',
        accountId: 'teacher-1',
        endpoint: dto.endpoint,
        keys: dto.keys,
        createdAt: '2026-10-27T10:00:00.000Z',
        updatedAt: '2026-10-27T10:00:00.000Z',
      };

      upsertPushSubscriptionUseCase.execute.mockResolvedValueOnce({
        subscription: mockSubDto,
        created: true,
      });

      const res = mockResponse();
      const result = await controller.upsertSubscription(mockUser, dto, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(result).toEqual(mockSubDto);
      expect(upsertPushSubscriptionUseCase.execute).toHaveBeenCalledWith({
        accountId: 'teacher-1',
        endpoint: dto.endpoint,
        keys: dto.keys,
      });
    });

    it('returns 200 OK when subscription already exists', async () => {
      const mockSubDto = {
        id: 'sub-1',
        accountId: 'teacher-1',
        endpoint: dto.endpoint,
        keys: dto.keys,
        createdAt: '2026-10-27T10:00:00.000Z',
        updatedAt: '2026-10-27T10:05:00.000Z',
      };

      upsertPushSubscriptionUseCase.execute.mockResolvedValueOnce({
        subscription: mockSubDto,
        created: false,
      });

      const res = mockResponse();
      const result = await controller.upsertSubscription(mockUser, dto, res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(result).toEqual(mockSubDto);
    });
  });

  describe('DELETE /push/subscriptions', () => {
    it('deletes subscription by endpoint passed in body', async () => {
      deletePushSubscriptionUseCase.execute.mockResolvedValueOnce();

      await controller.deleteSubscription(mockUser, {
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      });

      expect(deletePushSubscriptionUseCase.execute).toHaveBeenCalledWith({
        accountId: 'teacher-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-1',
      });
    });

    it('deletes subscription by endpoint passed in query if body is empty', async () => {
      deletePushSubscriptionUseCase.execute.mockResolvedValueOnce();

      await controller.deleteSubscription(mockUser, undefined, {
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-from-query',
      });

      expect(deletePushSubscriptionUseCase.execute).toHaveBeenCalledWith({
        accountId: 'teacher-1',
        endpoint: 'https://fcm.googleapis.com/fcm/send/device-from-query',
      });
    });

    it('does not invoke use case if endpoint is missing', async () => {
      await controller.deleteSubscription(mockUser, undefined, undefined);

      expect(deletePushSubscriptionUseCase.execute).not.toHaveBeenCalled();
    });
  });
});
