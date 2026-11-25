import { Module } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { MessageRouterService } from './message-router.service';

@Module({
  imports: [WhatsappModule],
  providers: [MessageRouterService],
})
export class MessagesModule {}
