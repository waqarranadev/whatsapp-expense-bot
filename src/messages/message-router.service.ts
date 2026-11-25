import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  MESSAGING_ADAPTER,
  type IncomingMessage,
  type MessagingAdapter,
} from '../whatsapp/messaging-adapter.interface';

/**
 * Entry point for every incoming message.
 * Phase 1: echo test. Phase 2 replaces handle() with commands + AI parsing.
 */
@Injectable()
export class MessageRouterService implements OnModuleInit {
  private readonly logger = new Logger(MessageRouterService.name);

  constructor(@Inject(MESSAGING_ADAPTER) private readonly messaging: MessagingAdapter) {}

  onModuleInit(): void {
    this.messaging.onMessage((message) => this.handle(message));
  }

  private async handle(message: IncomingMessage): Promise<void> {
    this.logger.debug({ from: message.from, text: message.text }, 'Echoing message');
    await this.messaging.sendMessage(message.from, `Echo: ${message.text}`);
  }
}
