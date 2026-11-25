import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, type HydratedDocument, type Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { normalizeCategoryName } from '../category-name.util';

@Schema({ timestamps: true, collection: 'categories' })
export class Category {
  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true, lowercase: true })
  normalizedName!: string;

  @Prop({ type: Boolean, required: true, default: false })
  isAiCreated!: boolean;
}

export type CategoryDocument = HydratedDocument<Category>;
export const CategorySchema = SchemaFactory.createForClass(Category);

CategorySchema.index({ userId: 1, normalizedName: 1 }, { unique: true });

// Keep normalizedName in sync with name when it is not set explicitly.
CategorySchema.pre('validate', function () {
  if (this.name && !this.normalizedName) {
    this.normalizedName = normalizeCategoryName(this.name);
  }
});
