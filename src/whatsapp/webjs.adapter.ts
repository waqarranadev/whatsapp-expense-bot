import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import * as path from 'node:path';
import type { Connection } from 'mongoose';
import * as qrcode from 'qrcode-terminal';
import { Client, RemoteAuth, type Message } from 'whatsapp-web.js';
import { AppConfigService } from '../config/app-config.service';
import { MongoSessionStore } from './mongo-session.store';
import type {
  IncomingMessage,
  MessageHandler,
  MessagingAdapter,
} from './messaging-adapter.interface';

/** Local working folder for RemoteAuth (Chrome profile + temporary session zip). */
const SESSION_DATA_PATH = '.wwebjs_auth';
const RECONNECT_BASE_DELAY_MS = 5_000;
const RECONNECT_MAX_DELAY_MS = 5 * 60_000;

/** whatsapp-web.js implementation of MessagingAdapter. */
@Injectable()
export class WebJsAdapter implements MessagingAdapter, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(WebJsAdapter.name);
  private readonly handlers: MessageHandler[] = [];
  /** phone -> chat id. Some contacts arrive as "@lid" ids instead of "<phone>@c.us". */
  private readonly chatIds = new Map<string, string>();
  private client: Client | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor(
    private readonly config: AppConfigService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  async sendMessage(to: string, text: string): Promise<void> {
    if (!this.client) {
      throw new Error('WhatsApp client is not connected');
    }
    const chatId = this.chatIds.get(to) ?? `${to}@c.us`;
    await this.client.sendMessage(chatId, text);
  }

  onApplicationBootstrap(): void {
    if (this.config.get('WA_ALLOWED_NUMBERS').length === 0) {
      this.logger.warn('WA_ALLOWED_NUMBERS is empty: the bot will reply to EVERY contact who messages this number');
    }
    // Not awaited: initialize() can take a long time (QR scan) and must not block startup.
    void this.start();
  }

  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.destroyClient();
  }

  private async start(): Promise<void> {
    const client = this.createClient();
    this.client = client;
    try {
      this.logger.log('Initializing WhatsApp client...');
      await client.initialize();
    } catch (error) {
      this.logger.error({ err: error }, 'WhatsApp client failed to initialize');
      this.scheduleReconnect();
    }
  }

  private createClient(): Client {
    // The session is stored in the app's own MongoDB connection (GridFS).
    const dataPath = path.resolve(SESSION_DATA_PATH);
    const store = new MongoSessionStore(this.connection, dataPath);

    const chromePath = this.config.get('CHROME_PATH');
    const client = new Client({
      authStrategy: new RemoteAuth({
        store,
        dataPath,
        clientId: this.config.get('WA_CLIENT_ID'),
        backupSyncIntervalMs: this.config.get('WA_BACKUP_SYNC_MS'),
      }),
      puppeteer: chromePath ? { executablePath: chromePath } : {},
    });

    client.on('qr', (qr: string) => {
      this.logger.log('Scan this QR code with WhatsApp > Linked devices');
      qrcode.generate(qr, { small: true });
    });
    client.on('authenticated', () =>
      this.logger.log('WhatsApp authenticated, syncing chats (can take a few minutes the first time)...'),
    );
    client.on('loading_screen', (percent: number | string, message: string) =>
      this.logger.log({ percent, message }, 'WhatsApp loading'),
    );
    client.on('change_state', (state: string) => this.logger.log({ state }, 'WhatsApp state changed'));
    client.on('auth_failure', (reason: string) =>
      this.logger.error({ reason }, 'WhatsApp authentication failed'),
    );
    client.on('remote_session_saved', () =>
      this.logger.log('WhatsApp session saved to MongoDB (safe to restart now)'),
    );
    client.on('ready', () => {
      this.reconnectAttempts = 0;
      this.logger.log('WhatsApp client is ready');
    });
    client.on('disconnected', (reason: string) => {
      this.logger.warn({ reason }, 'WhatsApp disconnected');
      this.scheduleReconnect();
    });
    client.on('message', (message: Message) => {
      void this.handleRawMessage(message);
    });

    return client;
  }

  private async handleRawMessage(message: Message): Promise<void> {
    try {
      if (!this.shouldProcess(message)) return;

      const phone = await this.resolvePhone(message);
      const allowed = this.config.get('WA_ALLOWED_NUMBERS');
      if (allowed.length > 0 && !allowed.includes(phone)) {
        this.logger.debug({ phone }, 'Ignoring message from number not in WA_ALLOWED_NUMBERS');
        return;
      }
      this.chatIds.set(phone, message.from);

      const incoming: IncomingMessage = {
        id: message.id._serialized,
        from: phone,
        text: message.body.trim(),
        timestamp: new Date(message.timestamp * 1000),
        senderName: (message as Message & { _data?: { notifyName?: string } })._data?.notifyName,
      };
      this.logger.log({ from: phone, messageId: incoming.id }, 'Incoming message');

      for (const handler of this.handlers) {
        await handler(incoming);
      }
    } catch (error) {
      this.logger.error({ err: error, messageId: message.id._serialized }, 'Failed to handle message');
    }
  }

  /** Skip groups, status updates, channels, broadcasts, own messages and non-text messages. */
  private shouldProcess(message: Message): boolean {
    const reason = this.skipReason(message);
    if (reason) {
      this.logger.debug({ from: message.from, type: message.type, reason }, 'Skipping message');
      return false;
    }
    return true;
  }

  private skipReason(message: Message): string | null {
    if (message.fromMe) return 'own message';
    if (message.isStatus) return 'status update';
    if (!message.from.endsWith('@c.us') && !message.from.endsWith('@lid')) return 'group/channel/broadcast';
    if (message.type !== 'chat') return `non-text (${message.type})`;
    if (!message.body.trim()) return 'empty';
    return null;
  }

  private async resolvePhone(message: Message): Promise<string> {
    const [id = '', server] = message.from.split('@');
    if (server === 'c.us' || !this.client) return id;

    // "@lid" ids hide the phone number, so ask WhatsApp for the mapping.
    try {
      const [mapping] = await this.client.getContactLidAndPhone([message.from]);
      const phone = mapping?.pn?.split('@')[0];
      if (phone) return phone;
    } catch (error) {
      this.logger.warn({ err: error, from: message.from }, 'Could not resolve phone from LID');
    }
    return id;
  }

  private scheduleReconnect(): void {
    if (this.shuttingDown || this.reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY_MS);
    this.reconnectAttempts += 1;
    this.logger.warn({ attempt: this.reconnectAttempts, delayMs: delay }, 'Reconnecting WhatsApp');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void (async () => {
        await this.destroyClient();
        await this.start();
      })();
    }, delay);
  }

  private async destroyClient(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (!client) return;
    try {
      await client.destroy();
    } catch (error) {
      this.logger.warn({ err: error }, 'Error while destroying WhatsApp client');
    }
  }
}
