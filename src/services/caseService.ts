import mongoose from "mongoose";
import CaseModel, { ICase } from "../models/Case";
import { JurisdictionService } from "./jurisdictionService";
import { CaseFlowService, CaseRegisterInput, TransferTrailInput } from "./caseFlowService";
import { TransferSource, CaseStage, JudgeSpecialty } from "../types/enums";

export interface CaseListQuery {
  courtId?: string;
  stage?: string;
  status?: string;
  caseType?: string;
  complexity?: string;
  isCrossRegional?: boolean;
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
  occurrenceDate: string | Date;
  transferSource: string;
  sourceCourt?: string;
  involvesMultipleParties?: boolean;
  involvesLargeAmount?: boolean;
  hasTechnicalDifficulty?: boolean;
  hasSocialImpact?: boolean;
}

export interface RegisterCaseResult {
  case: ICase | null;
  jurisdictionMatch: any;
}

export interface CaseDetailResult {
  case: ICase | null;
  flowHistory: any[];
  transferTrails: any[];
  judgeReassignmentHistory: any[];
  durationInfo: any;
}

export class CaseService {
  private static toObjectId(id: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
    return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
  }

  static async getCaseById(
    id: string | mongoose.Types.ObjectId,
    populate: string[] = ["circuitCourtId", "judgeId", "panelJudges"]
  ): Promise<ICase | null> {
    let query = CaseModel.findById(this.toObjectId(id));
    populate.forEach((field) => {
      query = query.populate(field);
    });
    return query.exec();
  }

  static async getCaseList(query: CaseListQuery): Promise<CaseListResult> {
    const filter: any = {};
    if (query.courtId) filter.circuitCourtId = this.toObjectId(query.courtId);
    if (query.stage) filter.stage = query.stage;
    if (query.status) filter.status = query.status;
    if (query.caseType) filter.caseType = query.caseType;
    if (query.complexity) filter.complexity = query.complexity;
    if (query.isCrossRegional !== undefined) filter.isCrossRegional = query.isCrossRegional;

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;
    const limit = pageSize;

    const cases = await CaseModel.find(filter)
      .populate("circuitCourtId")
      .populate("judgeId")
      .sort({ acceptedDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CaseModel.countDocuments(filter);

    return {
      cases,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getCaseDetail(id: string | mongoose.Types.ObjectId): Promise<CaseDetailResult | null> {
    const objectId = this.toObjectId(id);
    const caseDoc = await this.getCaseById(objectId);

    if (!caseDoc) {
      return null;
    }

    const flowHistory = await CaseFlowService.getCaseFlowHistory(objectId);
    const transferTrails = await CaseFlowService.getTransferTrails(objectId);
    const judgeReassignmentHistory = await CaseFlowService.getJudgeReassignmentHistory(objectId);
    const durationInfo = CaseFlowService.calculateTrialDuration(caseDoc);

    return {
      case: caseDoc,
      flowHistory,
      transferTrails,
      judgeReassignmentHistory,
      durationInfo,
    };
  }

  static validateRegisterCaseInput(input: RegisterCaseInput): { valid: boolean; message?: string } {
    const { caseNumber, caseType, title, occurrenceLocation, occurrenceDate, transferSource } = input;

    if (
      !caseNumber ||
      !caseType ||
      !title ||
      !occurrenceLocation ||
      !occurrenceLocation.province ||
      !occurrenceLocation.city ||
      !occurrenceLocation.county ||
      !occurrenceDate ||
      !transferSource
    ) {
      return { valid: false, message: "请填写完整的案件信息" };
    }

    return { valid: true };
  }

  static async registerCase(input: RegisterCaseInput): Promise<RegisterCaseResult> {
    const validation = this.validateRegisterCaseInput(input);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

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
      description: input.description,
      occurrenceLocation: input.occurrenceLocation,
      occurrenceDate: new Date(input.occurrenceDate),
      transferSource: input.transferSource as TransferSource,
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
        transferSource: input.transferSource as TransferSource,
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

    const populatedCase = await this.getCaseById(caseDoc._id);

    return {
      case: populatedCase,
      jurisdictionMatch: jurisdictionResult,
    };
  }

  static async transitionStage(
    caseId: string | mongoose.Types.ObjectId,
    toStage: string,
    operatorId?: string,
    operatorName?: string,
    remark?: string
  ): Promise<ICase | null> {
    if (!toStage || !Object.values(CaseStage).includes(toStage as CaseStage)) {
      throw new Error("请提供有效的案件阶段");
    }

    const objectId = this.toObjectId(caseId);

    const caseDoc = await CaseFlowService.transitionStage({
      caseId: objectId,
      toStage: toStage as CaseStage,
      operatorId,
      operatorName,
      remark,
    });

    if (!caseDoc) {
      return null;
    }

    return this.getCaseById(objectId);
  }

  static validateReassignmentInput(input: any): { valid: boolean; message?: string } {
    const { caseId, fromJudgeId, toJudgeId, reassignmentReason, reassignmentType } = input;

    if (!caseId || !fromJudgeId || !toJudgeId || !reassignmentReason || !reassignmentType) {
      return { valid: false, message: "请填写完整的改派信息" };
    }

    const validTypes = [
      "load_balance",
      "specialty_adjustment",
      "manual",
      "other",
    ];
    if (!validTypes.includes(reassignmentType)) {
      return { valid: false, message: "无效的改派类型" };
    }

    return { valid: true };
  }

  static parseWorkloadFilter(query: any): { filter: any; threshold?: number } {
    const filter: any = {};
    if (query.courtId) {
      filter.circuitCourtId = this.toObjectId(query.courtId);
    }
    if (query.specialty && Object.values(JudgeSpecialty).includes(query.specialty as JudgeSpecialty)) {
      filter.specialty = query.specialty as JudgeSpecialty;
    }
    const threshold = query.warningThreshold ? Number(query.warningThreshold) : undefined;
    return { filter, threshold };
  }

  static parseReassignmentHistoryFilter(query: any): any {
    const filter: any = {};
    if (query.caseId) filter.caseId = this.toObjectId(query.caseId);
    if (query.fromJudgeId) filter.fromJudgeId = this.toObjectId(query.fromJudgeId);
    if (query.toJudgeId) filter.toJudgeId = this.toObjectId(query.toJudgeId);
    if (query.reassignmentType) filter.reassignmentType = query.reassignmentType;
    if (query.startDate) filter.startDate = new Date(query.startDate);
    if (query.endDate) filter.endDate = new Date(query.endDate);
    return filter;
  }

  static parseTransferTrailInput(body: any): TransferTrailInput {
    return {
      ...body,
      caseId: this.toObjectId(body.caseId),
      toCourtId: this.toObjectId(body.toCourtId),
      transferDate: new Date(body.transferDate),
    };
  }

  static parseReassignmentInput(body: any): any {
    return {
      ...body,
      caseId: this.toObjectId(body.caseId),
      fromJudgeId: this.toObjectId(body.fromJudgeId),
      toJudgeId: this.toObjectId(body.toJudgeId),
    };
  }

  static parseBatchReassignmentInputs(reassignments: any[]): any[] {
    return reassignments.map((r: any) => ({
      caseId: this.toObjectId(r.caseId),
      fromJudgeId: this.toObjectId(r.fromJudgeId),
      toJudgeId: this.toObjectId(r.toJudgeId),
      reassignmentReason: r.reassignmentReason,
      reassignmentType: r.reassignmentType,
      operatorId: r.operatorId,
      operatorName: r.operatorName,
      remark: r.remark,
    }));
  }

  static toObjectIdSafe(id: string | mongoose.Types.ObjectId | undefined): mongoose.Types.ObjectId | undefined {
    if (!id) return undefined;
    return this.toObjectId(id);
  }
}
