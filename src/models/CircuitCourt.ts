import mongoose, { Schema, Document } from 'mongoose';

export interface ICircuitCourt extends Document {
  name: string;
  code: string;
  location: string;
  address: string;
  phone: string;
  coveredCities: string[];
  coveredCounties: string[];
  jurisdictionScope: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CircuitCourtSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    address: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    coveredCities: {
      type: [String],
      required: true,
      default: []
    },
    coveredCounties: {
      type: [String],
      required: true,
      default: []
    },
    jurisdictionScope: {
      type: String,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

CircuitCourtSchema.index({ code: 1 }, { unique: true });
CircuitCourtSchema.index({ coveredCities: 1 });
CircuitCourtSchema.index({ coveredCounties: 1 });

export default mongoose.model<ICircuitCourt>('CircuitCourt', CircuitCourtSchema);
