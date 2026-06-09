import mongoose, { Schema, Document } from 'mongoose';
import { CaseStage, CaseStatus } from '../types/enums';

export interface ICaseFlowRecord extends Document {
  caseId: mongoose.Types.ObjectId;
  stage: CaseStage;
  previousStage?: CaseStage;
  status: CaseStatus;
  previousStatus?: CaseStatus;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
  operatedAt: Date;
  createdAt: Date;
}

const CaseFlowRecordSchema: Schema = new Schema(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      ref: 'Case',
      required: true
    },
    stage: {
      type: String,
      enum: Object.values(CaseStage),
      required: true
    },
    previousStage: {
      type: String,
      enum: Object.values(CaseStage)
    },
    status: {
      type: String,
      enum: Object.values(CaseStatus),
      required: true
    },
    previousStatus: {
      type: String,
      enum: Object.values(CaseStatus)
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
    operatedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    timestamps: true
  }
);

CaseFlowRecordSchema.index({ caseId: 1, operatedAt: -1 });
CaseFlowRecordSchema.index({ stage: 1, status: 1 });

export default mongoose.model<ICaseFlowRecord>('CaseFlowRecord', CaseFlowRecordSchema);
