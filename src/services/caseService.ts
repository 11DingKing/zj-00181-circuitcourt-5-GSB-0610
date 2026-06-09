import mongoose from "mongoose";
import CaseModel, { ICase } from "../models/Case";
import { JurisdictionService } from "./jurisdictionService";
import { CaseFlowService, CaseRegisterInput, TransferTrailInput } from "./caseFlowService";
import { CaseAssignmentService } from "./caseAssignmentService";
import { WorkloadBalanceService, WorkloadAnalysisFilter, ReassignmentExecutionInput, ReassignmentResult } from "./workloadBalanceService";
import { CaseStage, TransferSource, JudgeSpecialty } from "../types/enums";

export interface CaseRegisterRequest {
  caseNumber: string;
  caseType: string;
  title: string;
  description?: string;
  occurrenceLocation: {
    province: string;
    city: string;
    county: string;
    detail?: string;
  };
  occurrenceDate: string;
  transferSource: TransferSource;
  sourceCourt?: string;
  involvesMultipleParties?: boolean;
  involvesLargeAmount?: boolean;
  hasTechnicalDifficulty?: boolean;
  hasSocialImpact?: boolean;
}

export interface CaseListQuery {
  courtId?: string;
  stage?: string;
  status?: string;
  caseType?: string;
  complexity?: string;
  isCrossRegional?: string;
  page?: number;
  pageSize?: number;
}

export interface CaseListResult {
  cases: ICase[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CaseDetailResult {
  case: ICase;
  flowHistory: any[];
  transferTrails: any[];
  judgeReassignmentHistory: any[];
  durationInfo: any;
}

export interface StageTransitionRequest {
  caseId: string;
  toStage: CaseStage;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface TransferRecordRequest {
  caseId: string;
  fromCourt?: string;
  fromCourtId?: string;
  toCourt: string;
  toCourtId: string;
  transferSource: TransferSource;
  transferReason: string;
  transferDate: string;
  receivedDate?: string;
  transferDocuments?: string[];
  remark?: string;
  operatorName?: string;
}

export interface WorkloadQuery {
  courtId?: string;
  specialty?: string;
  warningThreshold?: string;
}

export interface ReassignmentRequest {
  caseId: string;
  fromJudgeId: string;
  toJudgeId: string;
  reassignmentReason: string;
  reassignmentType: string;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface BatchReassignmentRequest {
  reassignments: ReassignmentRequest[];
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

const VALID_REASSIGNMENT_TYPES = [
  "load_balance",
  "specialty_adjustment",
  "manual",
  "other",
];

function toObjectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

function toObjectIdSafe(id?: string): mongoose.Types.ObjectId | undefined {
  return id ? new mongoose.Types.ObjectId(id) : undefined;
}

export class CaseService {
  static validateRegisterInput(input: Partial<CaseRegisterRequest>): string | null {
    if (
      !input.caseNumber ||
      !input.caseType ||
      !input.title ||
      !input.occurrenceLocation ||
      !input.occurrenceDate ||
      !input.transferSource
    ) {
      return "请填写完整的案件信息";
    }
    return null;
  }

  static validateStageTransition(toStage: string): string | null {
    if (!toStage || !Object.values(CaseStage).includes(toStage as CaseStage)) {
      return "请提供有效的案件阶段";
    }
    return null;
  }

  static validateReassignmentInput(input: Partial<ReassignmentRequest>): string | null {
    if (
      !input.caseId ||
      !input.fromJudgeId ||
      !input.toJudgeId ||
      !input.reassignmentReason ||
      !input.reassignmentType
    ) {
      return "请填写完整的改派信息";
    }
    if (!VALID_REASSIGNMENT_TYPES.includes(input.reassignmentType)) {
      return "无效的改派类型";
    }
    return null;
  }

  static validateBatchReassignment(reassignments: any[]): string | null {
    if (!Array.isArray(reassignments) || reassignments.length === 0) {
      return "请提供改派列表";
    }
    return null;
  }

  static async registerCase(input: CaseRegisterRequest): Promise<{
    case: ICase;
    jurisdictionMatch: any;
  }> {
    const jurisdictionResult = await JurisdictionService.matchCircuitCourt({
      province: input.occurrenceLocation.province,
      city: input.occurrenceLocation.city,
      county: input.occurrenceLocation.county,
    });

    if (!jurisdictionResult) {
      throw new Error("无法确定案件管辖法庭");
    }

    const registerInput: CaseRegisterInput = {
      caseNumber: input.caseNumber,
      caseType: input.caseType,
      title: input.title,
      description: input.description || "",
      occurrenceLocation: input.occurrenceLocation,
      occurrenceDate: new Date(input.occurrenceDate),
      transferSource: input.transferSource,
      sourceCourt: input.sourceCourt,
      involvesMultipleParties: input.involvesMultipleParties,
      involvesLargeAmount: input.involvesLargeAmount,
      hasTechnicalDifficulty: input.hasTechnicalDifficulty,
      hasSocialImpact: input.hasSocialImpact,
    };

    const caseDoc = await CaseFlowService.registerCase(
      registerInput,
      jurisdictionResult.circuitCourt._id,
      jurisdictionResult.isCrossRegional,
      jurisdictionResult.originalJurisdiction,
    );

    if (jurisdictionResult.isCrossRegional) {
      const fromCourtName =
        input.sourceCourt || `${jurisdictionResult.originalJurisdiction}人民法院`;
      const now = new Date();
      await CaseFlowService.createTransferTrail({
        caseId: caseDoc._id,
        fromCourt: fromCourtName,
        toCourt: jurisdictionResult.circuitCourt.name,
        toCourtId: jurisdictionResult.circuitCourt._id,
        transferSource: input.transferSource,
        transferReason: "跨行政区划环境资源案件集中管辖移送",
        transferDate: now,
        receivedDate: caseDoc.acceptedDate,
        transferDocuments: [
          "案件移送函",
          "立案审批表",
          "证据材料清单",
          "当事人身份证明",
        ],
        operatorName: "系统自动",
        remark: `根据集中管辖规定，由${fromCourtName}移送至${jurisdictionResult.circuitCourt.name}审理`,
      });
    }

    const populatedCase = await this.populateCase(caseDoc._id);
    if (!populatedCase) {
      throw new Error("案件创建后查询失败");
    }

    return {
      case: populatedCase,
      jurisdictionMatch: jurisdictionResult,
    };
  }

  static async getCaseList(query: CaseListQuery): Promise<CaseListResult> {
    const filter: any = {};
    if (query.courtId) filter.circuitCourtId = query.courtId;
    if (query.stage) filter.stage = query.stage;
    if (query.status) filter.status = query.status;
    if (query.caseType) filter.caseType = query.caseType;
    if (query.complexity) filter.complexity = query.complexity;
    if (query.isCrossRegional !== undefined) {
      filter.isCrossRegional = query.isCrossRegional === "true";
    }

    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const skip = (page - 1) * pageSize;
    const limit = pageSize;

    const [cases, total] = await Promise.all([
      CaseModel.find(filter)
        .populate("circuitCourtId")
        .populate("judgeId")
        .sort({ acceptedDate: -1 })
        .skip(skip)
        .limit(limit),
      CaseModel.countDocuments(filter),
    ]);

    return {
      cases,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getCaseDetail(id: string): Promise<CaseDetailResult | null> {
    const objectId = toObjectId(id);
    const caseDoc = await this.populateCase(objectId);

    if (!caseDoc) {
      return null;
    }

    const [flowHistory, transferTrails, judgeReassignmentHistory] =
      await Promise.all([
        CaseFlowService.getCaseFlowHistory(objectId),
        CaseFlowService.getTransferTrails(objectId),
        CaseFlowService.getJudgeReassignmentHistory(objectId),
      ]);

    const durationInfo = CaseFlowService.calculateTrialDuration(caseDoc);

    return {
      case: caseDoc,
      flowHistory,
      transferTrails,
      judgeReassignmentHistory,
      durationInfo,
    };
  }

  static async transitionStage(input: StageTransitionRequest): Promise<ICase | null> {
    const objectId = toObjectId(input.caseId);
    const caseDoc = await CaseFlowService.transitionStage({
      caseId: objectId,
      toStage: input.toStage,
      operatorId: input.operatorId,
      operatorName: input.operatorName,
      remark: input.remark,
    });

    if (!caseDoc) {
      return null;
    }

    return this.populateCase(objectId);
  }

  static checkAndUpdateCaseStatus() {
    return CaseFlowService.checkAndUpdateCaseStatus();
  }

  static getJudgeWorkload(courtId?: string) {
    return CaseAssignmentService.getJudgeWorkload(toObjectIdSafe(courtId));
  }

  static reassignOverloadedCases() {
    return CaseAssignmentService.reassignOverloadedCases();
  }

  static createTransferRecord(input: TransferRecordRequest) {
    const trailInput: TransferTrailInput = {
      caseId: toObjectId(input.caseId),
      fromCourt: input.fromCourt,
      fromCourtId: toObjectIdSafe(input.fromCourtId),
      toCourt: input.toCourt,
      toCourtId: toObjectId(input.toCourtId),
      transferSource: input.transferSource,
      transferReason: input.transferReason,
      transferDate: new Date(input.transferDate),
      receivedDate: input.receivedDate ? new Date(input.receivedDate) : undefined,
      transferDocuments: input.transferDocuments,
      remark: input.remark,
      operatorName: input.operatorName,
    };
    return CaseFlowService.createTransferTrail(trailInput);
  }

  private static buildWorkloadFilter(query: WorkloadQuery): WorkloadAnalysisFilter {
    const filter: WorkloadAnalysisFilter = {};
    if (query.courtId) {
      filter.circuitCourtId = toObjectId(query.courtId);
    }
    if (
      query.specialty &&
      Object.values(JudgeSpecialty).includes(query.specialty as JudgeSpecialty)
    ) {
      filter.specialty = query.specialty as JudgeSpecialty;
    }
    return filter;
  }

  static analyzeWorkload(query: WorkloadQuery) {
    const filter = this.buildWorkloadFilter(query);
    const threshold = query.warningThreshold
      ? Number(query.warningThreshold)
      : undefined;
    return WorkloadBalanceService.analyzeWorkload(filter, threshold);
  }

  static async getReassignmentSuggestions(query: WorkloadQuery): Promise<{
    suggestions: any[];
    totalOverloaded: number;
    totalRecommendedTransfers: number;
  }> {
    const filter = this.buildWorkloadFilter(query);
    const threshold = query.warningThreshold
      ? Number(query.warningThreshold)
      : undefined;
    const suggestions = await WorkloadBalanceService.generateReassignmentSuggestions(
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

  static async executeReassignment(input: ReassignmentRequest): Promise<ReassignmentResult> {
    const executionInput: ReassignmentExecutionInput = {
      caseId: toObjectId(input.caseId),
      fromJudgeId: toObjectId(input.fromJudgeId),
      toJudgeId: toObjectId(input.toJudgeId),
      reassignmentReason: input.reassignmentReason,
      reassignmentType: input.reassignmentType as ReassignmentExecutionInput["reassignmentType"],
      operatorId: input.operatorId,
      operatorName: input.operatorName,
      remark: input.remark,
    };
    return WorkloadBalanceService.executeReassignment(executionInput);
  }

  static async batchExecuteReassignment(
    input: BatchReassignmentRequest,
  ): Promise<{
    results: ReassignmentResult[];
    successCount: number;
    failCount: number;
    totalCount: number;
  }> {
    const inputs: ReassignmentExecutionInput[] = input.reassignments.map(
      (r) => ({
        caseId: toObjectId(r.caseId),
        fromJudgeId: toObjectId(r.fromJudgeId),
        toJudgeId: toObjectId(r.toJudgeId),
        reassignmentReason: r.reassignmentReason,
        reassignmentType: r.reassignmentType as ReassignmentExecutionInput["reassignmentType"],
        operatorId: r.operatorId,
        operatorName: r.operatorName,
        remark: r.remark,
      }),
    );

    const results = await WorkloadBalanceService.batchExecuteReassignment(inputs);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      results,
      successCount,
      failCount,
      totalCount: results.length,
    };
  }

  static getReassignmentHistory(query: ReassignmentHistoryQuery) {
    const filter: any = {};
    if (query.caseId) filter.caseId = toObjectId(query.caseId);
    if (query.fromJudgeId) filter.fromJudgeId = toObjectId(query.fromJudgeId);
    if (query.toJudgeId) filter.toJudgeId = toObjectId(query.toJudgeId);
    if (query.reassignmentType) filter.reassignmentType = query.reassignmentType;
    if (query.startDate) filter.startDate = new Date(query.startDate);
    if (query.endDate) filter.endDate = new Date(query.endDate);

    return WorkloadBalanceService.getReassignmentHistory(filter);
  }

  static getJudgeWorkloadBoard(query: WorkloadBoardQuery) {
    const circuitCourtId = toObjectIdSafe(query.courtId);
    const threshold = query.warningThreshold
      ? Number(query.warningThreshold)
      : undefined;
    return WorkloadBalanceService.getJudgeWorkloadBoard(circuitCourtId, threshold);
  }

  private static async populateCase(
    id: mongoose.Types.ObjectId | string,
  ): Promise<ICase | null> {
    return CaseModel.findById(id)
      .populate("circuitCourtId")
      .populate("judgeId")
      .populate("panelJudges");
  }
}
