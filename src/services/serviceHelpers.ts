import mongoose from "mongoose";

export class ServiceValidationError extends Error {
  status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "ServiceValidationError";
    this.status = status;
  }
}

export function toObjectId(
  value: unknown,
): mongoose.Types.ObjectId {
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value !== "string" || value.length === 0) {
    throw new ServiceValidationError("无效的 ID 参数");
  }
  return new mongoose.Types.ObjectId(value);
}

export function toOptionalObjectId(
  value: unknown,
): mongoose.Types.ObjectId | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return toObjectId(value);
}

export function toOptionalDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const d = new Date(value as string);
  if (isNaN(d.getTime())) {
    throw new ServiceValidationError("无效的日期参数");
  }
  return d;
}

export function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (isNaN(n)) {
    throw new ServiceValidationError("无效的数值参数");
  }
  return n;
}

export function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return value === "true" || value === true;
}
