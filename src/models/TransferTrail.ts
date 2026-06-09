import mongoose, { Schema, Document } from 'mongoose';
import { TransferSource } from '../types/enums';

export interface ITransferTrail extends Document {
  caseId: mongoose.Types.ObjectId;
  fromCourt?: string;
  fromCourtId?: mongoose.Types.ObjectId;
  toCourt: string;
  toCourtId: mongoose.Types.ObjectId;
  transferSource: TransferSource;
  transferReason: string;
  transferDate: Date;
  receivedDate?: Date;
  transferDocuments: string[];
  remark?: string;
  operatorName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TransferTrailSchema: Schema = new Schema(
  {
    caseId: {
      type: Schema.Types.ObjectId,
      ref: 'Case',
      required: true
    },
    fromCourt: {
      type: String,
      trim: true
    },
    fromCourtId: {
      type: Schema.Types.ObjectId,
      ref: 'CircuitCourt'
    },
    toCourt: {
      type: String,
      required: true,
      trim: true
    },
    toCourtId: {
      type: Schema.Types.ObjectId,
      ref: 'CircuitCourt',
      required: true
    },
    transferSource: {
      type: String,
      enum: Object.values(TransferSource),
      required: true
    },
    transferReason: {
      type: String,
      required: true,
      trim: true
    },
    transferDate: {
      type: Date,
      required: true
    },
    receivedDate: {
      type: Date
    },
    transferDocuments: {
      type: [String],
      default: []
    },
    remark: {
      type: String,
      trim: true
    },
    operatorName: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

TransferTrailSchema.index({ caseId: 1, transferDate: -1 });
TransferTrailSchema.index({ fromCourtId: 1, toCourtId: 1 });
TransferTrailSchema.index({ transferSource: 1 });

export default mongoose.model<ITransferTrail>('TransferTrail', TransferTrailSchema);
