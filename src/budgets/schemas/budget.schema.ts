import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Category } from '../../categories/schemas/category.schema';
import { positiveWholeAmount } from '../../common/validators';

export const BUDGET_PERIODS = ['monthly'] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

@Schema({ timestamps: true, collection: 'budgets' })
export class Budget {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  /** null = overall budget across all categories */
  @Prop({ type: SchemaTypes.ObjectId, ref: Category.name, default: null })
  categoryId!: Types.ObjectId | null;

  @Prop({ type: String, required: true, enum: BUDGET_PERIODS, default: 'monthly' })
  period!: BudgetPeriod;

  @Prop({ type: Number, required: true, validate: positiveWholeAmount })
  amount!: number;
}

export type BudgetDocument = HydratedDocument<Budget>;
export const BudgetSchema = SchemaFactory.createForClass(Budget);

BudgetSchema.index({ userId: 1, categoryId: 1, period: 1 }, { unique: true });
