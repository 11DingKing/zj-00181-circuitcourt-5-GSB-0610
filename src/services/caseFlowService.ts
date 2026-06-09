import mongoose from "mongoose";
import CaseModel, { ICase } from "../models/Case";
import CaseFlowRecord from "../models/CaseFlowRecord";
import TransferTrail from "../models/TransferTrail";
import JudgeReassignmentTrail from "../models/JudgeReassignmentTrail";
import {
  CaseStage,
  CaseStatus,
  CaseComplexity,
  TransferSource,
} from "../types/enums";
import { CaseAssignmentService } from "./caseAssignmentService";

export interface CaseFlowRecordInput {
  caseId: mongoose.Types.ObjectId;
  stage: CaseStage;
  previousStage?: CaseStage;
  status: CaseStatus;
  previousStatus?: CaseStatus;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
  operatedAt?: Date;
}

export interface CaseFlowTransitionInput {
  caseId: mongoose.Types.ObjectId;
  toStage: CaseStage;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface CaseRegisterInput {
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
  occurrenceDate: Date;
  transferSource: TransferSource;
  sourceCourt?: string;
  involvesMultipleParties?: boolean;
  involvesLargeAmount?: boolean;
  hasTechnicalDifficulty?: boolean;
  hasSocialImpact?: boolean;
}

export interface TransferTrailInput {
  caseId: mongoose.Types.ObjectId;
  fromCourt?: string;
  fromCourtId?: mongoose.Types.ObjectId;
  toCourt: string;
  toCourtId: mongoose.Types.ObjectId;
  transferSource: TransferSource;
  transferReason: string;
  transferDate: Date;
  receivedDate?: Date;
  transferDocuments?: string[];
  remark?: string;
  operatorName?: string;
}

const SIMPLE_CASE_STAGE_DAYS_LIMIT: Record<CaseStage, number> = {
  [CaseStage.ACCEPTED]: 3,
  [CaseStage.TRIAL]: 20,
  [CaseStage.JUDGMENT]: 15,
  [CaseStage.ARCHIVED]: 5,
};

const COMPLEX_CASE_STAGE_DAYS_LIMIT: Record<CaseStage, number> = {
  [CaseStage.ACCEPTED]: 7,
  [CaseStage.TRIAL]: 45,
  [CaseStage.JUDGMENT]: 30,
  [CaseStage.ARCHIVED]: 10,
};

export function getStageDaysLimit(
  complexity: CaseComplexity,
  stage: CaseStage,
): number {
  const limits =
    complexity === CaseComplexity.SIMPLE
      ? SIMPLE_CASE_STAGE_DAYS_LIMIT
      : COMPLEX_CASE_STAGE_DAYS_LIMIT;
  return limits[stage];
}

export function getTotalTrialDaysLimit(complexity: CaseComplexity): number {
  return complexity === CaseComplexity.SIMPLE ? 45 : 90;
}

export class CaseFlowService {
  static async registerCase(
    input: CaseRegisterInput,
    circuitCourtId: mongoose.Types.ObjectId,
    isCrossRegional: boolean,
    originalJurisdiction: string,
  ): Promise<ICase> {
    const complexity = CaseAssignmentService.assessComplexity({
      caseType: input.caseType as any,
      description: input.description,
      involvesMultipleParties: input.involvesMultipleParties,
      involvesLargeAmount: input.involvesLargeAmount,
      hasTechnicalDifficulty: input.hasTechnicalDifficulty,
      isCrossRegional,
      hasSocialImpact: input.hasSocialImpact,
    });

    const acceptedDate = new Date();
    const trialDaysLimit = getTotalTrialDaysLimit(complexity);
    const deadline = new Date(acceptedDate);
    deadline.setDate(deadline.getDate() + trialDaysLimit);

    const caseDoc = new CaseModel({
      caseNumber: input.caseNumber,
      caseType: input.caseType,
      title: input.title,
      description: input.description,
      occurrenceLocation: {
        province: input.occurrenceLocation.province,
        city: input.occurrenceLocation.city,
        county: input.occurrenceLocation.county,
        detail: input.occurrenceLocation.detail || "",
      },
      occurrenceDate: input.occurrenceDate,
      transferSource: input.transferSource,
      sourceCourt: input.sourceCourt,
      complexity,
      isCrossRegional,
      circuitCourtId,
      originalJurisdiction,
      stage: CaseStage.ACCEPTED,
      status: CaseStatus.PENDING,
      acceptedDate,
      deadline,
      trialDaysLimit,
    });

    await caseDoc.save();

    await CaseAssignmentService.assignCase(caseDoc, circuitCourtId).then(
      async (assignment) => {
        if (assignment) {
          caseDoc.judgeId = assignment.judge._id;
          if (assignment.isPanel && assignment.panelJudges) {
            caseDoc.panelJudges = assignment.panelJudges.map((j) => j._id);
          }
          caseDoc.status = CaseStatus.PROCESSING;
          await caseDoc.save();
        }
      },
    );

    await this.createFlowRecord({
      caseId: caseDoc._id,
      stage: CaseStage.ACCEPTED,
      status: CaseStatus.PROCESSING,
      operatorId: input.sourceCourt,
      operatorName: "系统自动",
      remark: `案件登记立案，${complexity === CaseComplexity.SIMPLE ? "简案快办" : "繁案合议"}`,
    });

    return caseDoc;
  }

  static async transitionStage(
    input: CaseFlowTransitionInput,
  ): Promise<ICase | null> {
    const caseDoc = await CaseModel.findById(input.caseId);
    if (!caseDoc) return null;

    const previousStage = caseDoc.stage;
    const previousStatus = caseDoc.status;

    caseDoc.stage = input.toStage;

    const now = new Date();
    switch (input.toStage) {
      case CaseStage.TRIAL:
        caseDoc.trialStartDate = now;
        break;
      case CaseStage.JUDGMENT:
        caseDoc.judgmentDate = now;
        break;
      case CaseStage.ARCHIVED:
        caseDoc.archivedDate = now;
        caseDoc.status = CaseStatus.COMPLETED;
        if (caseDoc.judgeId) {
          await CaseAssignmentService.decrementJudgeCaseCount(caseDoc.judgeId);
        }
        if (caseDoc.panelJudges) {
          for (const judgeId of caseDoc.panelJudges) {
            await CaseAssignmentService.decrementJudgeCaseCount(judgeId);
          }
        }
        break;
    }

    if (input.toStage !== CaseStage.ARCHIVED) {
      caseDoc.status = CaseStatus.PROCESSING;
      caseDoc.isUrgent = false;
      caseDoc.isOverdue = false;

      const deadline = new Date(caseDoc.deadline);
      const daysRemaining = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const urgentThresholdDays = 7;

      if (daysRemaining < 0) {
        caseDoc.isOverdue = true;
        caseDoc.status = CaseStatus.OVERDUE;
      } else if (daysRemaining <= urgentThresholdDays) {
        caseDoc.isUrgent = true;
        caseDoc.status = CaseStatus.URGENT;
      }
    }

    await caseDoc.save();

    await this.createFlowRecord({
      caseId: caseDoc._id,
      stage: input.toStage,
      previousStage,
      status: caseDoc.status,
      previousStatus,
      operatorId: input.operatorId,
      operatorName: input.operatorName,
      remark: input.remark,
    });

    return caseDoc;
  }

  static async createFlowRecord(input: CaseFlowRecordInput) {
    const record = new CaseFlowRecord(input);
    return record.save();
  }

  static async createTransferTrail(input: TransferTrailInput) {
    const trail = new TransferTrail({
      ...input,
      transferDocuments: input.transferDocuments || [],
    });
    return trail.save();
  }

  static async getCaseFlowHistory(caseId: mongoose.Types.ObjectId) {
    return CaseFlowRecord.find({ caseId }).sort({ operatedAt: -1 });
  }

  static async getTransferTrails(caseId: mongoose.Types.ObjectId) {
    return TransferTrail.find({ caseId }).sort({ transferDate: -1 });
  }

  static async checkAndUpdateCaseStatus(): Promise<{
    urgentCount: number;
    overdueCount: number;
    notifiedCases: string[];
  }> {
    const now = new Date();
    const urgentThresholdDays = 7;
    const urgentCases: string[] = [];
    const overdueCases: string[] = [];

    const activeCases = await CaseModel.find({
      status: {
        $in: [
          CaseStatus.PENDING,
          CaseStatus.PROCESSING,
          CaseStatus.URGENT,
          CaseStatus.OVERDUE,
        ],
      },
      stage: { $ne: CaseStage.ARCHIVED },
    });

    for (const caseDoc of activeCases) {
      const deadline = new Date(caseDoc.deadline);
      const daysRemaining = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const previousStatus = caseDoc.status;
      const previousIsUrgent = caseDoc.isUrgent;
      const previousIsOverdue = caseDoc.isOverdue;

      if (daysRemaining < 0) {
        caseDoc.isOverdue = true;
        caseDoc.isUrgent = false;
        caseDoc.status = CaseStatus.OVERDUE;

        if (!previousIsOverdue || previousStatus !== CaseStatus.OVERDUE) {
          overdueCases.push(caseDoc.caseNumber);
          await this.createFlowRecord({
            caseId: caseDoc._id,
            stage: caseDoc.stage,
            status: CaseStatus.OVERDUE,
            previousStatus,
            operatorName: "系统预警",
            remark: `案件已超审限 ${Math.abs(daysRemaining)} 天，请尽快处理`,
          });
        }
      } else if (daysRemaining <= urgentThresholdDays) {
        caseDoc.isUrgent = true;
        caseDoc.isOverdue = false;
        caseDoc.status = CaseStatus.URGENT;

        if (!previousIsUrgent || previousStatus !== CaseStatus.URGENT) {
          urgentCases.push(caseDoc.caseNumber);
          await this.createFlowRecord({
            caseId: caseDoc._id,
            stage: caseDoc.stage,
            status: CaseStatus.URGENT,
            previousStatus,
            operatorName: "系统催办",
            remark: `案件审理期限剩余 ${daysRemaining} 天，请抓紧处理`,
          });
        }
      } else {
        caseDoc.isOverdue = false;
        caseDoc.isUrgent = false;
        caseDoc.status = CaseStatus.PROCESSING;

        if (
          previousIsUrgent ||
          previousIsOverdue ||
          previousStatus === CaseStatus.URGENT ||
          previousStatus === CaseStatus.OVERDUE
        ) {
          await this.createFlowRecord({
            caseId: caseDoc._id,
            stage: caseDoc.stage,
            status: CaseStatus.PROCESSING,
            previousStatus,
            operatorName: "系统自动",
            remark: `案件状态恢复正常，审理期限剩余 ${daysRemaining} 天`,
          });
        }
      }

      if (
        caseDoc.status !== previousStatus ||
        caseDoc.isUrgent !== previousIsUrgent ||
        caseDoc.isOverdue !== previousIsOverdue
      ) {
        await caseDoc.save();
      }
    }

    return {
      urgentCount: urgentCases.length,
      overdueCount: overdueCases.length,
      notifiedCases: [...urgentCases, ...overdueCases],
    };
  }

  static calculateTrialDuration(caseDoc: ICase): {
    totalDays: number;
    remainingDays: number;
    isOverdue: boolean;
    stageProgress: Record<CaseStage, { duration: number; limit: number }>;
  } {
    const now = new Date();
    const acceptedDate = new Date(caseDoc.acceptedDate);
    const deadline = new Date(caseDoc.deadline);

    const totalDays = Math.ceil(
      (deadline.getTime() - acceptedDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const remainingDays = Math.ceil(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    const stageProgress = {} as Record<
      CaseStage,
      { duration: number; limit: number }
    >;

    const stages = Object.values(CaseStage);
    let lastDate = acceptedDate;

    for (const stage of stages) {
      let duration = 0;
      if (caseDoc.stage === stage) {
        duration = Math.ceil(
          (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
        );
      } else if (
        (stage === CaseStage.TRIAL && caseDoc.trialStartDate) ||
        (stage === CaseStage.JUDGMENT && caseDoc.judgmentDate) ||
        (stage === CaseStage.ARCHIVED && caseDoc.archivedDate)
      ) {
        const stageDate =
          stage === CaseStage.TRIAL
            ? caseDoc.trialStartDate
            : stage === CaseStage.JUDGMENT
              ? caseDoc.judgmentDate
              : caseDoc.archivedDate;
        if (stageDate) {
          duration = Math.ceil(
            (stageDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          lastDate = stageDate;
        }
      }
      stageProgress[stage] = {
        duration,
        limit: getStageDaysLimit(caseDoc.complexity, stage),
      };
    }

    return {
      totalDays,
      remainingDays,
      isOverdue: remainingDays < 0,
      stageProgress,
    };
  }

  static async getJudgeReassignmentHistory(caseId: mongoose.Types.ObjectId) {
    return JudgeReassignmentTrail.find({ caseId })
      .populate("fromJudgeId")
      .populate("toJudgeId")
      .sort({ reassignedAt: -1 });
  }
}
