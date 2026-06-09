import mongoose, { Schema, Document } from 'mongoose';
import { JudgeSpecialty } from '../types/enums';

export interface IJudge extends Document {
  name: string;
  judgeId: string;
  circuitCourtId: mongoose.Types.ObjectId;
  specialties: JudgeSpecialty[];
  isActive: boolean;
  currentCaseCount: number;
  maxCaseLoad: number;
  createdAt: Date;
  updatedAt: Date;
}

const JudgeSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    judgeId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    circuitCourtId: {
      type: Schema.Types.ObjectId,
      ref: 'CircuitCourt',
      required: true
    },
    specialties: {
      type: [String],
      enum: Object.values(JudgeSpecialty),
      required: true,
      default: [JudgeSpecialty.GENERAL]
    },
    isActive: {
      type: Boolean,
      default: true
    },
    currentCaseCount: {
      type: Number,
      default: 0,
      min: 0
    },
    maxCaseLoad: {
      type: Number,
      default: 10,
      min: 1
    }
  },
  {
    timestamps: true
  }
);

JudgeSchema.index({ judgeId: 1 }, { unique: true });
JudgeSchema.index({ circuitCourtId: 1 });
JudgeSchema.index({ specialties: 1 });

export default mongoose.model<IJudge>('Judge', JudgeSchema);
