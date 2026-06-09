import mongoose, { Schema, Document } from 'mongoose';
import { JudgeSpecialty } from '../types/enums';

export interface IJudgeReassignmentTrail extends Document {
  caseId: mongoose.Types.ObjectId;
  fromJudgeId: mongoose.Types.ObjectId;
  fromJudgeName: string;
  toJudgeId: mongoose.Types.ObjectId;
  toJudgeName: string;
  reassignmentReason: string;
  reassignmentType: 'load_balance' | 'specialty_adjustment' | 'manual' | 'other';
  workloadBeforeFrom: number;
  workloadAfterFrom: number;
  workloadBeforeTo: number;
  workloadAfterTo: number;
  caseType: string;
  caseComplexity: string;
  caseStage: string;
  matchedSpecialties: JudgeSpecialty[];
  operatorId?: string;
  operatorName?: string;
  remark?: string;
  reassignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const JudgeReassignmentTrailSchema: Schema = new Schema(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      ref: 'Case',
      required: true
    },
    fromJudgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Judge',
      required: true
    },
    fromJudgeName: {
      type: String,
      required: true,
      trim: true
    },
    toJudgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Judge',
      required: true
    },
    toJudgeName: {
      type: String,
      required: true,
      trim: true
    },
    reassignmentReason: {
      type: String,
      required: true,
      trim: true
    },
    reassignmentType: {
      type: String,
      enum: ['load_balance', 'specialty_adjustment', 'manual', 'other'],
      required: true
    },
    workloadBeforeFrom: {
      type: Number,
      required: true,
      min: 0
    },
    workloadAfterFrom: {
      type: Number,
      required: true,
      min: 0
    },
    workloadBeforeTo: {
      type: Number,
      required: true,
      min: 0
    },
    workloadAfterTo: {
      type: Number,
      required: true,
      min: 0
    },
    caseType: {
      type: String,
      required: true
    },
    caseComplexity: {
      type: String,
      required: true
    },
    caseStage: {
      type: String,
      required: true
    },
    matchedSpecialties: {
      type: [String],
      enum: Object.values(JudgeSpecialty),
      default: []
    },
    operatorId: {
      type: String,
      trim: true
    },
    operatorName: {
      type: String,
      trim: true
    },
    remark: {
      type: String,
      trim: true
    },
    reassignedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true
  }
);

JudgeReassignmentTrailSchema.index({ caseId: 1, reassignedAt: -1 });
JudgeReassignmentTrailSchema.index({ fromJudgeId: 1, reassignedAt: -1 });
JudgeReassignmentTrailSchema.index({ toJudgeId: 1, reassignedAt: -1 });
JudgeReassignmentTrailSchema.index({ reassignmentType: 1 });

export default mongoose.model<IJudgeReassignmentTrail>('JudgeReassignmentTrail', JudgeReassignmentTrailSchema);
