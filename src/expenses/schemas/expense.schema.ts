import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Category } from '../../categories/schemas/category.schema';
import { positiveWholeAmount } from '../../common/validators';

@Schema({ timestamps: true, collection: 'expenses' })
export class Expense {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Category.name, required: true })
  categoryId!: Types.ObjectId;

  /** Whole rupees */
  @Prop({ type: Number, required: true, validate: positiveWholeAmount })
  amount!: number;

  @Prop({ type: String, required: true, trim: true })
  item!: string;

  @Prop({ type: String, trim: true })
  note?: string;

  @Prop({ type: Date, required: true })
  spentAt!: Date;

  @Prop({ type: String, required: true })
  rawMessage!: string;

  /** One WhatsApp message can contain several expenses, so this is "<messageId>#<index>". */
  @Prop({ type: String, required: true })
  waMessageId!: string;
}

export type ExpenseDocument = HydratedDocument<Expense>;
export const ExpenseSchema = SchemaFactory.createForClass(Expense);

ExpenseSchema.index({ waMessageId: 1 }, { unique: true });
ExpenseSchema.index({ userId: 1, spentAt: -1 });
ExpenseSchema.index({ userId: 1, categoryId: 1, spentAt: -1 });
