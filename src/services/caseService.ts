import mongoose from "mongoose";
import CaseModel from "../models/Case";
import { JurisdictionService } from "./jurisdictionService";
import { CaseFlowService } from "./caseFlowService";
import { CaseAssignmentService } from "./caseAssignmentService";
import { CaseStage, TransferSource } from "../types/enums";

export interface RegisterCaseInput {
  caseNumber: string;
  caseType: string;
  title: string;
  description: string;
  occurrenceLocation: {
    province: string;
    city: string;
    county: string;
    detail?: string;
  };
  occurrenceDate: string;
  transferSource: string;
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
  page?: string;
  pageSize?: string;
}

export interface CaseListResult {
  cases: any[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CaseDetailResult {
  case: any;
  flowHistory: any;
  transferTrails: any;
  judgeReassignmentHistory: any;
  durationInfo: any;
}

export interface RegisterCaseResult {
  case: any;
  jurisdictionMatch: any;
}

export class CaseService {
  static async registerCase(
    input: RegisterCaseInput,
  ): Promise<RegisterCaseResult> {
    const {
      caseNumber,
      caseType,
      title,
      description,
      occurrenceLocation,
      occurrenceDate,
      transferSource,
      sourceCourt,
      involvesMultipleParties,
      involvesLargeAmount,
      hasTechnicalDifficulty,
      hasSocialImpact,
    } = input;

    if (
      !caseNumber ||
      !caseType ||
      !title ||
      !occurrenceLocation ||
      !occurrenceDate ||
      !transferSource
    ) {
      throw new Error("VALIDATION_ERROR:请填写完整的案件信息");
    }

    const jurisdictionResult = await JurisdictionService.matchCircuitCourt({
      province: occurrenceLocation.province,
      city: occurrenceLocation.city,
      county: occurrenceLocation.county,
    });

    if (!jurisdictionResult) {
      throw new Error("VALIDATION_ERROR:无法确定案件管辖法庭");
    }

    const caseDoc = await CaseFlowService.registerCase(
      {
        caseNumber,
        caseType,
        title,
        description,
        occurrenceLocation,
        occurrenceDate: new Date(occurrenceDate),
        transferSource: transferSource as TransferSource,
        sourceCourt,
        involvesMultipleParties,
        involvesLargeAmount,
        hasTechnicalDifficulty,
        hasSocialImpact,
      },
      jurisdictionResult.circuitCourt._id,
      jurisdictionResult.isCrossRegional,
      jurisdictionResult.originalJurisdiction,
    );

    if (jurisdictionResult.isCrossRegional) {
      const fromCourtName =
        sourceCourt || `${jurisdictionResult.originalJurisdiction}人民法院`;
      const now = new Date();
      await CaseFlowService.createTransferTrail({
        caseId: caseDoc._id,
        fromCourt: fromCourtName,
        toCourt: jurisdictionResult.circuitCourt.name,
        toCourtId: jurisdictionResult.circuitCourt._id,
        transferSource: transferSource as TransferSource,
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

    const populatedCase = await CaseModel.findById(caseDoc._id)
      .populate("circuitCourtId")
      .populate("judgeId")
      .populate("panelJudges");

    return {
      case: populatedCase,
      jurisdictionMatch: jurisdictionResult,
    };
  }

  static async getCaseList(query: CaseListQuery): Promise<CaseListResult> {
    const {
      courtId,
      stage,
      status,
      caseType,
      complexity,
      isCrossRegional,
      page = "1",
      pageSize = "20",
    } = query;

    const filter: any = {};
    if (courtId) filter.circuitCourtId = courtId;
    if (stage) filter.stage = stage;
    if (status) filter.status = status;
    if (caseType) filter.caseType = caseType;
    if (complexity) filter.complexity = complexity;
    if (isCrossRegional !== undefined)
      filter.isCrossRegional = isCrossRegional === "true";

    const pageNum = Number(page);
    const pageSizeNum = Number(pageSize);
    const skip = (pageNum - 1) * pageSizeNum;

    const [cases, total] = await Promise.all([
      CaseModel.find(filter)
        .populate("circuitCourtId")
        .populate("judgeId")
        .sort({ acceptedDate: -1 })
        .skip(skip)
        .limit(pageSizeNum),
      CaseModel.countDocuments(filter),
    ]);

    return {
      cases,
      total,
      page: pageNum,
      pageSize: pageSizeNum,
      totalPages: Math.ceil(total / pageSizeNum),
    };
  }

  static async getCaseDetail(id: string): Promise<CaseDetailResult> {
    const objectId = new mongoose.Types.ObjectId(id);
    const caseDoc = await CaseModel.findById(objectId)
      .populate("circuitCourtId")
      .populate("judgeId")
      .populate("panelJudges");

    if (!caseDoc) {
      return null as any;
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

  static async transitionCaseStage(
    id: string,
    toStage: string,
    operatorId?: string,
    operatorName?: string,
    remark?: string,
  ): Promise<any> {
    if (!toStage || !Object.values(CaseStage).includes(toStage as CaseStage)) {
      throw new Error("VALIDATION_ERROR:请提供有效的案件阶段");
    }

    const caseDoc = await CaseFlowService.transitionStage({
      caseId: new mongoose.Types.ObjectId(id),
      toStage: toStage as CaseStage,
      operatorId,
      operatorName,
      remark,
    });

    if (!caseDoc) {
      return null;
    }

    const populatedCase = await CaseModel.findById(id)
      .populate("circuitCourtId")
      .populate("judgeId")
      .populate("panelJudges");

    return populatedCase;
  }

  static async checkCaseStatus() {
    return CaseFlowService.checkAndUpdateCaseStatus();
  }

  static async getJudgeWorkload(courtId?: string) {
    const circuitCourtId = courtId
      ? new mongoose.Types.ObjectId(courtId)
      : undefined;
    return CaseAssignmentService.getJudgeWorkload(circuitCourtId);
  }

  static async reassignOverloadedCases() {
    return CaseAssignmentService.reassignOverloadedCases();
  }

  static async createTransferRecord(input: Record<string, any>) {
    const { caseId, toCourtId, transferDate, ...rest } = input;
    return CaseFlowService.createTransferTrail({
      ...rest,
      caseId: new mongoose.Types.ObjectId(caseId),
      toCourtId: new mongoose.Types.ObjectId(toCourtId),
      transferDate: new Date(transferDate),
    } as any);
  }
}
