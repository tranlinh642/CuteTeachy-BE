import { PushSender } from './ports/push-sender.port';

export interface GetVapidPublicKeyOutput {
  publicKey: string;
}

export class GetVapidPublicKeyUseCase {
  constructor(private readonly pushSender: PushSender) {}

  async execute(): Promise<GetVapidPublicKeyOutput> {
    const publicKey = this.pushSender.getVapidPublicKey();
    return { publicKey };
  }
}
