import mongoose from "mongoose";
import {
  WorkloadBalanceService,
  WorkloadAnalysisFilter,
} from "./workloadBalanceService";
import { JudgeSpecialty } from "../types/enums";

const VALID_REASSIGNMENT_TYPES = [
  "load_balance",
  "specialty_adjustment",
  "manual",
  "other",
] as const;

export type ReassignmentType = (typeof VALID_REASSIGNMENT_TYPES)[number];

export interface AnalyzeWorkloadQuery {
  courtId?: string;
  specialty?: string;
  warningThreshold?: string;
}

export interface ReassignmentSuggestionsQuery {
  courtId?: string;
  specialty?: string;
  warningThreshold?: string;
}

export interface ExecuteReassignmentInput {
  caseId: string;
  fromJudgeId: string;
  toJudgeId: string;
  reassignmentReason: string;
  reassignmentType: string;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface BatchReassignmentInput {
  reassignments: ExecuteReassignmentInput[];
}

export interface ReassignmentHistoryQuery {
  caseId?: string;
  fromJudgeId?: string;
  toJudgeId?: string;
  startDate?: string;
  endDate?: string;
  reassignmentType?: string;
}

export interface WorkloadBoardQuery {
  courtId?: string;
  warningThreshold?: string;
}

function buildWorkloadFilter(query: {
  courtId?: string;
  specialty?: string;
}): WorkloadAnalysisFilter {
  const filter: WorkloadAnalysisFilter = {};
  if (query.courtId) {
    filter.circuitCourtId = new mongoose.Types.ObjectId(query.courtId);
  }
  if (
    query.specialty &&
    Object.values(JudgeSpecialty).includes(query.specialty as JudgeSpecialty)
  ) {
    filter.specialty = query.specialty as JudgeSpecialty;
  }
  return filter;
}

function parseThreshold(warningThreshold?: string): number | undefined {
  return warningThreshold ? Number(warningThreshold) : undefined;
}

export class WorkloadService {
  static async analyzeWorkload(query: AnalyzeWorkloadQuery) {
    const filter = buildWorkloadFilter(query);
    const threshold = parseThreshold(query.warningThreshold);
    return WorkloadBalanceService.analyzeWorkload(filter, threshold);
  }

  static async getReassignmentSuggestions(query: ReassignmentSuggestionsQuery) {
    const filter = buildWorkloadFilter(query);
    const threshold = parseThreshold(query.warningThreshold);
    const suggestions =
      await WorkloadBalanceService.generateReassignmentSuggestions(
        filter,
        threshold,
      );

    return {
      suggestions,
      totalOverloaded: suggestions.length,
      totalRecommendedTransfers: suggestions.reduce(
        (sum, s) => sum + s.recommendedTransfers.length,
        0,
      ),
    };
  }

  static async executeReassignment(input: ExecuteReassignmentInput) {
    const {
      caseId,
      fromJudgeId,
      toJudgeId,
      reassignmentReason,
      reassignmentType,
      operatorId,
      operatorName,
      remark,
    } = input;

    if (
      !caseId ||
      !fromJudgeId ||
      !toJudgeId ||
      !reassignmentReason ||
      !reassignmentType
    ) {
      throw new Error("VALIDATION_ERROR:请填写完整的改派信息");
    }

    if (
      !VALID_REASSIGNMENT_TYPES.includes(reassignmentType as ReassignmentType)
    ) {
      throw new Error("VALIDATION_ERROR:无效的改派类型");
    }

    return WorkloadBalanceService.executeReassignment({
      caseId: new mongoose.Types.ObjectId(caseId),
      fromJudgeId: new mongoose.Types.ObjectId(fromJudgeId),
      toJudgeId: new mongoose.Types.ObjectId(toJudgeId),
      reassignmentReason,
      reassignmentType: reassignmentType as ReassignmentType,
      operatorId,
      operatorName,
      remark,
    });
  }

  static async batchExecuteReassignment(input: BatchReassignmentInput) {
    const { reassignments } = input;

    if (!Array.isArray(reassignments) || reassignments.length === 0) {
      throw new Error("VALIDATION_ERROR:请提供改派列表");
    }

    const inputs = reassignments.map((r) => ({
      caseId: new mongoose.Types.ObjectId(r.caseId),
      fromJudgeId: new mongoose.Types.ObjectId(r.fromJudgeId),
      toJudgeId: new mongoose.Types.ObjectId(r.toJudgeId),
      reassignmentReason: r.reassignmentReason,
      reassignmentType: r.reassignmentType as ReassignmentType,
      operatorId: r.operatorId,
      operatorName: r.operatorName,
      remark: r.remark,
    }));

    const results =
      await WorkloadBalanceService.batchExecuteReassignment(inputs);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      results,
      successCount,
      failCount,
      totalCount: results.length,
    };
  }

  static async getReassignmentHistory(query: ReassignmentHistoryQuery) {
    const filter: any = {};
    if (query.caseId) filter.caseId = new mongoose.Types.ObjectId(query.caseId);
    if (query.fromJudgeId)
      filter.fromJudgeId = new mongoose.Types.ObjectId(query.fromJudgeId);
    if (query.toJudgeId)
      filter.toJudgeId = new mongoose.Types.ObjectId(query.toJudgeId);
    if (query.reassignmentType)
      filter.reassignmentType = query.reassignmentType;
    if (query.startDate) filter.startDate = new Date(query.startDate);
    if (query.endDate) filter.endDate = new Date(query.endDate);

    return WorkloadBalanceService.getReassignmentHistory(filter);
  }

  static async getJudgeWorkloadBoard(query: WorkloadBoardQuery) {
    const circuitCourtId = query.courtId
      ? new mongoose.Types.ObjectId(query.courtId)
      : undefined;
    const threshold = parseThreshold(query.warningThreshold);
    return WorkloadBalanceService.getJudgeWorkloadBoard(
      circuitCourtId,
      threshold,
    );
  }
}
