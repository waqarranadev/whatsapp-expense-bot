import { z } from 'zod';

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  MONGODB_URI: z.string().trim().min(1, 'MONGODB_URI is required'),
  /** Optional, e.g. "1.1.1.1,8.8.8.8". Applied in main.ts before anything connects. */
  DNS_SERVERS: z
    .string()
    .default('')
    .refine(
      (v) => v.split(',').every((s) => s.trim() === '' || /^[\d.:a-fA-F]+$/.test(s.trim())),
      'DNS_SERVERS must be comma-separated IP addresses',
    ),

  // WhatsApp (whatsapp-web.js)
  CHROME_PATH: optionalString,
  WA_CLIENT_ID: z.string().trim().min(1).default('expense-bot'),
  WA_BACKUP_SYNC_MS: z.coerce.number().int().min(60_000).default(300_000),
  /** Comma-separated phone numbers (digits only, e.g. 923001234567). Empty = everyone. */
  WA_ALLOWED_NUMBERS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((n) => n.replace(/\D/g, ''))
        .filter((n) => n.length > 0),
    ),

  // Defaults for newly created users
  DEFAULT_TIMEZONE: z.string().trim().min(1).default('Asia/Karachi'),
  DEFAULT_CURRENCY: z.string().trim().min(1).default('PKR'),

  // AI (OpenAI-compatible). Required from phase 2 onwards.
  AI_BASE_URL: optionalString,
  AI_API_KEY: optionalString,
  AI_MODEL: optionalString,
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
