import { Module } from '@nestjs/common';
import { MESSAGING_ADAPTER } from './messaging-adapter.interface';
import { WebJsAdapter } from './webjs.adapter';

@Module({
  providers: [
    WebJsAdapter,
    // Swap this for CloudApiAdapter later; nothing else needs to change.
    { provide: MESSAGING_ADAPTER, useExisting: WebJsAdapter },
  ],
  exports: [MESSAGING_ADAPTER],
})
export class WhatsappModule {}
