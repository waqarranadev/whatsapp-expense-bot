import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { setServers } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

// Must run before MongoDB connects. On some Windows networks Node cannot read the
// system (IPv6 link-local) DNS server and "mongodb+srv://" lookups fail with
// querySrv ECONNREFUSED. Validated again in env.schema.ts.
// ConfigModule reads .env later; we need DNS_SERVERS before that, so load it here too.
if (existsSync('.env')) process.loadEnvFile('.env');
const dnsServers = process.env.DNS_SERVERS?.split(',').map((s) => s.trim()).filter(Boolean);
if (dnsServers?.length) setServers(dnsServers);

async function bootstrap(): Promise<void> {
  // No HTTP server for now: the bot only talks to WhatsApp.
  // (The future CloudApiAdapter will need one for webhooks.)
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.get(Logger).log('Application started', 'Bootstrap');
}

void bootstrap();
