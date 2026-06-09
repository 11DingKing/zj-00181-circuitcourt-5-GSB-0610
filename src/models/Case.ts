import mongoose, { Schema, Document } from 'mongoose';
import { CaseType, CaseComplexity, CaseStage, CaseStatus, TransferSource } from '../types/enums';

export interface ICase extends Document {
  caseNumber: string;
  caseType: CaseType;
  title: string;
  description: string;
  occurrenceLocation: {
    province: string;
    city: string;
    county: string;
    detail: string;
  };
  occurrenceDate: Date;
  transferSource: TransferSource;
  sourceCourt?: string;
  complexity: CaseComplexity;
  isCrossRegional: boolean;
  circuitCourtId: mongoose.Types.ObjectId;
  originalJurisdiction: string;
  judgeId?: mongoose.Types.ObjectId;
  panelJudges?: mongoose.Types.ObjectId[];
  stage: CaseStage;
  status: CaseStatus;
  acceptedDate: Date;
  trialStartDate?: Date;
  judgmentDate?: Date;
  archivedDate?: Date;
  deadline: Date;
  trialDaysLimit: number;
  isUrgent: boolean;
  isOverdue: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema: Schema = new Schema(
  {
    caseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    caseType: {
      type: String,
      enum: Object.values(CaseType),
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    occurrenceLocation: {
      province: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      county: { type: String, required: true, trim: true },
      detail: { type: String, trim: true }
    },
    occurrenceDate: {
      type: Date,
      required: true
    },
    transferSource: {
      type: String,
      enum: Object.values(TransferSource),
      required: true
    },
    sourceCourt: {
      type: String,
      trim: true
    },
    complexity: {
      type: String,
      enum: Object.values(CaseComplexity),
      required: true
    },
    isCrossRegional: {
      type: Boolean,
      default: false
    },
    circuitCourtId: {
      type: Schema.Types.ObjectId,
      ref: 'CircuitCourt',
      required: true
    },
    originalJurisdiction: {
      type: String,
      required: true,
      trim: true
    },
    judgeId: {
      type: Schema.Types.ObjectId,
      ref: 'Judge'
    },
    panelJudges: [{
      type: Schema.Types.ObjectId,
      ref: 'Judge'
    }],
    stage: {
      type: String,
      enum: Object.values(CaseStage),
      default: CaseStage.ACCEPTED,
      required: true
    },
    status: {
      type: String,
      enum: Object.values(CaseStatus),
      default: CaseStatus.PENDING,
      required: true
    },
    acceptedDate: {
      type: Date,
      required: true
    },
    trialStartDate: {
      type: Date
    },
    judgmentDate: {
      type: Date
    },
    archivedDate: {
      type: Date
    },
    deadline: {
      type: Date,
      required: true
    },
    trialDaysLimit: {
      type: Number,
      required: true,
      default: 90
    },
    isUrgent: {
      type: Boolean,
      default: false
    },
    isOverdue: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

CaseSchema.index({ caseNumber: 1 }, { unique: true });
CaseSchema.index({ circuitCourtId: 1, stage: 1, status: 1 });
CaseSchema.index({ caseType: 1, complexity: 1 });
CaseSchema.index({ 'occurrenceLocation.city': 1, 'occurrenceLocation.county': 1 });
CaseSchema.index({ judgeId: 1, status: 1 });
CaseSchema.index({ deadline: 1, status: 1 });
CaseSchema.index({ isCrossRegional: 1 });

export default mongoose.model<ICase>('Case', CaseSchema);
