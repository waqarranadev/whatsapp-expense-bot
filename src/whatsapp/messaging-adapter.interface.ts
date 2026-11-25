/** Platform-neutral incoming message. Business logic only ever sees this shape. */
export interface IncomingMessage {
  /** Unique, stable message id from the platform (used for idempotency). */
  id: string;
  /** Sender phone, digits only, e.g. 923001234567 */
  from: string;
  text: string;
  timestamp: Date;
  senderName?: string;
}

export type MessageHandler = (message: IncomingMessage) => Promise<void>;

export interface MessagingAdapter {
  onMessage(handler: MessageHandler): void;
  /** `to` is a phone number, digits only. */
  sendMessage(to: string, text: string): Promise<void>;
}

/** DI token: inject with @Inject(MESSAGING_ADAPTER) */
export const MESSAGING_ADAPTER = Symbol('MESSAGING_ADAPTER');
