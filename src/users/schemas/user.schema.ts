import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true, collection: 'users' })
export class User {
  /** Digits only, international format without "+", e.g. 923001234567 */
  @Prop({ type: String, required: true, unique: true, trim: true })
  phone!: string;

  @Prop({ type: String, trim: true })
  name?: string;

  @Prop({ type: String, required: true, default: 'Asia/Karachi' })
  timezone!: string;

  @Prop({ type: String, required: true, default: 'PKR' })
  currency!: string;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
