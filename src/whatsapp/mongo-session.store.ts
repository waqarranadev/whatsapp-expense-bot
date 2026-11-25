import { Logger } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { mongo, type Connection } from 'mongoose';
import type { Store } from 'whatsapp-web.js';

/**
 * RemoteAuth session store backed by MongoDB GridFS.
 *
 * Replaces `wwebjs-mongo`, which reads the session zip from the current working
 * directory while whatsapp-web.js >= 1.34 writes it to RemoteAuth's `dataPath`
 * (and it crashed the app on that missing file because the read stream had no
 * error handler). Same GridFS layout as wwebjs-mongo: bucket "whatsapp-<session>".
 */
export class MongoSessionStore implements Store {
  private readonly logger = new Logger(MongoSessionStore.name);

  constructor(
    private readonly connection: Connection,
    /** Must match the `dataPath` given to RemoteAuth. */
    private readonly dataPath: string,
  ) {}

  async sessionExists({ session }: { session: string }): Promise<boolean> {
    const count = await this.bucket(session).find({ filename: this.fileName(session) }).limit(1).toArray();
    return count.length > 0;
  }

  /**
   * Never throws: RemoteAuth calls this from a setInterval without catching, and an
   * unhandled rejection would kill the whole process. A failed backup is retried on
   * the next interval.
   */
  async save({ session }: { session: string }): Promise<void> {
    try {
      const bucket = this.bucket(session);
      const fileName = this.fileName(session);
      await pipeline(
        createReadStream(path.join(this.dataPath, fileName)),
        bucket.openUploadStream(fileName),
      );
      // Keep only the newest upload.
      const files = await bucket.find({ filename: fileName }).sort({ uploadDate: -1 }).toArray();
      await Promise.all(files.slice(1).map((file) => bucket.delete(file._id)));
    } catch (error) {
      this.logger.error({ err: error, session }, 'Failed to back up WhatsApp session to MongoDB');
    }
  }

  async extract({ session, path: targetPath }: { session: string; path: string }): Promise<void> {
    await pipeline(
      this.bucket(session).openDownloadStreamByName(this.fileName(session)),
      createWriteStream(targetPath),
    );
  }

  async delete({ session }: { session: string }): Promise<void> {
    const bucket = this.bucket(session);
    const files = await bucket.find({ filename: this.fileName(session) }).toArray();
    await Promise.all(files.map((file) => bucket.delete(file._id)));
  }

  private bucket(session: string): mongo.GridFSBucket {
    const db = this.connection.db;
    if (!db) throw new Error('MongoDB is not connected');
    return new mongo.GridFSBucket(db, { bucketName: `whatsapp-${session}` });
  }

  private fileName(session: string): string {
    return `${session}.zip`;
  }
}
