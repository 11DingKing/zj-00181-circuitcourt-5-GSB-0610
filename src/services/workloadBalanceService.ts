import mongoose from 'mongoose';
import Judge, { IJudge } from '../models/Judge';
import CaseModel, { ICase } from '../models/Case';
import JudgeReassignmentTrail, { IJudgeReassignmentTrail } from '../models/JudgeReassignmentTrail';
import { CaseAssignmentService } from './caseAssignmentService';
import { CaseFlowService } from './caseFlowService';
import { CaseStage, CaseStatus, CaseType, CaseComplexity, JudgeSpecialty } from '../types/enums';

export interface WorkloadAnalysisFilter {
  circuitCourtId?: mongoose.Types.ObjectId;
  specialty?: JudgeSpecialty;
}

export interface JudgeWorkloadDetail {
  judge: IJudge;
  activeCases: number;
  activeCaseList: ICase[];
  workloadPercentage: number;
  isOverloaded: boolean;
  overloadCount: number;
  reassignableCases: ICase[];
  casesBySpecialty: Record<string, number>;
}

export interface ReassignableCase extends ICase {
  daysInCurrentStage: number;
  recommendedJudges: Array<{
    judge: IJudge;
    workloadPercentage: number;
    specialtyMatchScore: number;
    capacityAvailable: number;
    overallScore: number;
  }>;
}

export interface ReassignmentSuggestion {
  overloadedJudge: JudgeWorkloadDetail;
  reassignableCases: ReassignableCase[];
  availableJudges: Array<{
    judge: IJudge;
    workloadPercentage: number;
    capacityAvailable: number;
    matchedSpecialties: JudgeSpecialty[];
  }>;
  recommendedTransfers: Array<{
    caseItem: ReassignableCase;
    fromJudge: IJudge;
    toJudge: IJudge;
    reason: string;
  }>;
}

export interface ReassignmentExecutionInput {
  caseId: mongoose.Types.ObjectId;
  fromJudgeId: mongoose.Types.ObjectId;
  toJudgeId: mongoose.Types.ObjectId;
  reassignmentReason: string;
  reassignmentType: 'load_balance' | 'specialty_adjustment' | 'manual' | 'other';
  operatorId?: string;
  operatorName?: string;
  remark?: string;
}

export interface ReassignmentResult {
  success: boolean;
  caseId: mongoose.Types.ObjectId;
  fromJudgeId: mongoose.Types.ObjectId;
  toJudgeId: mongoose.Types.ObjectId;
  trail?: IJudgeReassignmentTrail;
  message: string;
}

const DEFAULT_WARNING_THRESHOLD = 80;
const DEFAULT_REASSIGNABLE_STAGES = [CaseStage.ACCEPTED];

export class WorkloadBalanceService {
  static async analyzeWorkload(
    filter: WorkloadAnalysisFilter = {},
    warningThreshold: number = DEFAULT_WARNING_THRESHOLD
  ): Promise<{
    allJudges: JudgeWorkloadDetail[];
    overloadedJudges: JudgeWorkloadDetail[];
    underloadedJudges: JudgeWorkloadDetail[];
    overallStats: {
      totalJudges: number;
      overloadedCount: number;
      underloadedCount: number;
      averageWorkload: number;
      maxWorkload: number;
      minWorkload: number;
      imbalanceRatio: number;
    };
  }> {
    const query: any = { isActive: true };
    if (filter.circuitCourtId) query.circuitCourtId = filter.circuitCourtId;
    if (filter.specialty) query.specialties = filter.specialty;

    const judges = await Judge.find(query).populate('circuitCourtId');

    const judgeWorkloads = await Promise.all(
      judges.map(async (judge) => this.buildJudgeWorkloadDetail(judge, warningThreshold))
    );

    const sortedWorkloads = judgeWorkloads.sort(
      (a, b) => b.workloadPercentage - a.workloadPercentage
    );

    const overloaded = sortedWorkloads.filter((j) => j.isOverloaded);
    const underloaded = sortedWorkloads.filter((j) => j.workloadPercentage < 50);

    const workloads = sortedWorkloads.map((j) => j.workloadPercentage);
    const avgWorkload = workloads.length > 0
      ? workloads.reduce((a, b) => a + b, 0) / workloads.length
      : 0;
    const maxWorkload = workloads.length > 0 ? Math.max(...workloads) : 0;
    const minWorkload = workloads.length > 0 ? Math.min(...workloads) : 0;

    const imbalanceRatio = avgWorkload > 0 ? (maxWorkload - minWorkload) / avgWorkload : 0;

    return {
      allJudges: sortedWorkloads,
      overloadedJudges: overloaded,
      underloadedJudges: underloaded,
      overallStats: {
        totalJudges: judges.length,
        overloadedCount: overloaded.length,
        underloadedCount: underloaded.length,
        averageWorkload: Math.round(avgWorkload * 10) / 10,
        maxWorkload: Math.round(maxWorkload * 10) / 10,
        minWorkload: Math.round(minWorkload * 10) / 10,
        imbalanceRatio: Math.round(imbalanceRatio * 100) / 100
      }
    };
  }

  private static async buildJudgeWorkloadDetail(
    judge: IJudge,
    warningThreshold: number
  ): Promise<JudgeWorkloadDetail> {
    const activeCaseList = await CaseModel.find({
      judgeId: judge._id,
      status: { $in: [CaseStatus.PENDING, CaseStatus.PROCESSING, CaseStatus.URGENT] }
    }).sort({ acceptedDate: 1 });

    const reassignableCases = activeCaseList.filter(
      (c) =>
        DEFAULT_REASSIGNABLE_STAGES.includes(c.stage) &&
        !c.trialStartDate
    );

    const casesBySpecialty: Record<string, number> = {};
    activeCaseList.forEach((c) => {
      const type = c.caseType;
      casesBySpecialty[type] = (casesBySpecialty[type] || 0) + 1;
    });

    const workloadPercentage = (activeCaseList.length / judge.maxCaseLoad) * 100;

    return {
      judge,
      activeCases: activeCaseList.length,
      activeCaseList,
      workloadPercentage: Math.round(workloadPercentage * 10) / 10,
      isOverloaded: workloadPercentage >= warningThreshold,
      overloadCount: Math.max(0, activeCaseList.length - Math.floor((warningThreshold / 100) * judge.maxCaseLoad)),
      reassignableCases,
      casesBySpecialty
    };
  }

  static async generateReassignmentSuggestions(
    filter: WorkloadAnalysisFilter = {},
    warningThreshold: number = DEFAULT_WARNING_THRESHOLD
  ): Promise<ReassignmentSuggestion[]> {
    const analysis = await this.analyzeWorkload(filter, warningThreshold);

    const suggestions: ReassignmentSuggestion[] = [];

    for (const overloadedJudge of analysis.overloadedJudges) {
      if (overloadedJudge.reassignableCases.length === 0) continue;

      const reassignableCasesWithRecommendations = await Promise.all(
        overloadedJudge.reassignableCases.map(async (caseItem) =>
          this.enhanceCaseWithJudgeRecommendations(
            caseItem,
            overloadedJudge.judge,
            analysis.allJudges
          )
        )
      );

      const availableJudges = analysis.allJudges
        .filter(
          (j) =>
            !j.isOverloaded &&
            j.judge._id.toString() !== overloadedJudge.judge._id.toString() &&
            j.judge.circuitCourtId.toString() === overloadedJudge.judge.circuitCourtId.toString()
        )
        .map((j) => ({
          judge: j.judge,
          workloadPercentage: j.workloadPercentage,
          capacityAvailable: j.judge.maxCaseLoad - j.activeCases,
          matchedSpecialties: this.getMatchedSpecialtiesForCase(
            overloadedJudge.reassignableCases[0],
            j.judge
          )
        }))
        .sort((a, b) => a.workloadPercentage - b.workloadPercentage);

      const recommendedTransfers = this.generateRecommendedTransfers(
        reassignableCasesWithRecommendations,
        overloadedJudge
      );

      suggestions.push({
        overloadedJudge,
        reassignableCases: reassignableCasesWithRecommendations,
        availableJudges,
        recommendedTransfers
      });
    }

    return suggestions;
  }

  private static async enhanceCaseWithJudgeRecommendations(
    caseItem: ICase,
    fromJudge: IJudge,
    allJudges: JudgeWorkloadDetail[]
  ): Promise<ReassignableCase> {
    const now = new Date();
    const acceptedDate = new Date(caseItem.acceptedDate);
    const daysInCurrentStage = Math.ceil(
      (now.getTime() - acceptedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const preferredSpecialties = this.getPreferredSpecialtiesForCase(caseItem.caseType as CaseType);

    const recommendedJudges = allJudges
      .filter(
        (j) =>
          !j.isOverloaded &&
          j.judge._id.toString() !== fromJudge._id.toString() &&
          j.judge.circuitCourtId.toString() === fromJudge.circuitCourtId.toString()
      )
      .map((j) => {
        const specialtyMatchCount = j.judge.specialties.filter((s) =>
          preferredSpecialties.includes(s)
        ).length;
        const specialtyMatchScore = specialtyMatchCount * 25;
        const workloadRatio = j.workloadPercentage / 100;
        const workloadScore = (1 - workloadRatio) * 50;
        const capacityAvailable = j.judge.maxCaseLoad - j.activeCases;

        return {
          judge: j.judge,
          workloadPercentage: j.workloadPercentage,
          specialtyMatchScore,
          capacityAvailable,
          overallScore: Math.round((specialtyMatchScore + workloadScore) * 10) / 10
        };
      })
      .sort((a, b) => b.overallScore - a.overallScore);

    return {
      ...caseItem.toObject(),
      daysInCurrentStage,
      recommendedJudges
    } as ReassignableCase;
  }

  private static getPreferredSpecialtiesForCase(caseType: CaseType): JudgeSpecialty[] {
    const map: Partial<Record<CaseType, JudgeSpecialty[]>> = {
      [CaseType.POLLUTION_ENVIRONMENT]: [JudgeSpecialty.POLLUTION_CONTROL, JudgeSpecialty.ECOLOGICAL_RESTORATION],
      [CaseType.ILLEGAL_MINING]: [JudgeSpecialty.MINERAL_RESOURCES, JudgeSpecialty.ECOLOGICAL_RESTORATION],
      [CaseType.ILLEGAL_HUNTING]: [JudgeSpecialty.WILDLIFE],
      [CaseType.ECOLOGICAL_DAMAGE_COMPENSATION]: [JudgeSpecialty.ECOLOGICAL_RESTORATION, JudgeSpecialty.POLLUTION_CONTROL],
      [CaseType.ILLEGAL_LOGGING]: [JudgeSpecialty.WILDLIFE, JudgeSpecialty.ECOLOGICAL_RESTORATION],
      [CaseType.ILLEGAL_FISHING]: [JudgeSpecialty.WATER_RESOURCES, JudgeSpecialty.WILDLIFE],
      [CaseType.WILDLIFE_PROTECTION]: [JudgeSpecialty.WILDLIFE],
      [CaseType.WATER_RESOURCE_PROTECTION]: [JudgeSpecialty.WATER_RESOURCES, JudgeSpecialty.POLLUTION_CONTROL]
    };
    return map[caseType] || [JudgeSpecialty.GENERAL];
  }

  private static getMatchedSpecialtiesForCase(
    caseItem: ICase | undefined,
    judge: IJudge
  ): JudgeSpecialty[] {
    if (!caseItem) return [];
    const preferred = this.getPreferredSpecialtiesForCase(caseItem.caseType as CaseType);
    return judge.specialties.filter((s) => preferred.includes(s));
  }

  private static generateRecommendedTransfers(
    cases: ReassignableCase[],
    overloadedJudge: JudgeWorkloadDetail
  ): Array<{
    caseItem: ReassignableCase;
    fromJudge: IJudge;
    toJudge: IJudge;
    reason: string;
  }> {
    const transfers: Array<{
      caseItem: ReassignableCase;
      fromJudge: IJudge;
      toJudge: IJudge;
      reason: string;
    }> = [];

    const needToTransfer = overloadedJudge.overloadCount;

    for (let i = 0; i < Math.min(needToTransfer, cases.length); i++) {
      const caseItem = cases[i];
      if (caseItem.recommendedJudges.length > 0) {
        const bestJudge = caseItem.recommendedJudges[0];
        transfers.push({
          caseItem,
          fromJudge: overloadedJudge.judge,
          toJudge: bestJudge.judge,
          reason: `负荷均衡调剂：原法官负荷 ${overloadedJudge.workloadPercentage}%，建议转至法官 ${bestJudge.judge.name}（当前负荷 ${bestJudge.workloadPercentage}%，专业匹配度得分 ${bestJudge.specialtyMatchScore}）`
        });
      }
    }

    return transfers;
  }

  static async executeReassignment(
    input: ReassignmentExecutionInput
  ): Promise<ReassignmentResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const caseDoc = await CaseModel.findById(input.caseId).session(session);
      if (!caseDoc) {
        await session.abortTransaction();
        return { success: false, caseId: input.caseId, fromJudgeId: input.fromJudgeId, toJudgeId: input.toJudgeId, message: '案件不存在' };
      }

      if (caseDoc.judgeId?.toString() !== input.fromJudgeId.toString()) {
        await session.abortTransaction();
        return { success: false, caseId: input.caseId, fromJudgeId: input.fromJudgeId, toJudgeId: input.toJudgeId, message: '案件当前承办人与指定的原法官不一致' };
      }

      if (caseDoc.trialStartDate || !DEFAULT_REASSIGNABLE_STAGES.includes(caseDoc.stage)) {
        await session.abortTransaction();
        return { success: false, caseId: input.caseId, fromJudgeId: input.fromJudgeId, toJudgeId: input.toJudgeId, message: '该案件已进入实质审理阶段，无法改派' };
      }

      const fromJudge = await Judge.findById(input.fromJudgeId).session(session);
      const toJudge = await Judge.findById(input.toJudgeId).session(session);

      if (!fromJudge || !toJudge) {
        await session.abortTransaction();
        return { success: false, caseId: input.caseId, fromJudgeId: input.fromJudgeId, toJudgeId: input.toJudgeId, message: '法官不存在' };
      }

      if (toJudge.circuitCourtId.toString() !== fromJudge.circuitCourtId.toString()) {
        await session.abortTransaction();
        return { success: false, caseId: input.caseId, fromJudgeId: input.fromJudgeId, toJudgeId: input.toJudgeId, message: '不能跨法庭改派案件' };
      }

      const fromActiveCases = await CaseModel.countDocuments({
        judgeId: fromJudge._id,
        status: { $in: [CaseStatus.PENDING, CaseStatus.PROCESSING, CaseStatus.URGENT] }
      }).session(session);

      const toActiveCases = await CaseModel.countDocuments({
        judgeId: toJudge._id,
        status: { $in: [CaseStatus.PENDING, CaseStatus.PROCESSING, CaseStatus.URGENT] }
      }).session(session);

      caseDoc.judgeId = toJudge._id;
      await caseDoc.save({ session });

      await Judge.findByIdAndUpdate(
        fromJudge._id,
        { $inc: { currentCaseCount: -1 } },
        { session, new: true }
      );

      await Judge.findByIdAndUpdate(
        toJudge._id,
        { $inc: { currentCaseCount: 1 } },
        { session, new: true }
      );

      const matchedSpecialties = this.getMatchedSpecialtiesForCase(caseDoc, toJudge);

      const trail = new JudgeReassignmentTrail({
        caseId: caseDoc._id,
        fromJudgeId: fromJudge._id,
        fromJudgeName: fromJudge.name,
        toJudgeId: toJudge._id,
        toJudgeName: toJudge.name,
        reassignmentReason: input.reassignmentReason,
        reassignmentType: input.reassignmentType,
        workloadBeforeFrom: fromActiveCases,
        workloadAfterFrom: fromActiveCases - 1,
        workloadBeforeTo: toActiveCases,
        workloadAfterTo: toActiveCases + 1,
        caseType: caseDoc.caseType,
        caseComplexity: caseDoc.complexity,
        caseStage: caseDoc.stage,
        matchedSpecialties,
        operatorId: input.operatorId,
        operatorName: input.operatorName,
        remark: input.remark
      });
      await trail.save({ session });

      await CaseFlowService.createFlowRecord({
        caseId: caseDoc._id,
        stage: caseDoc.stage,
        status: caseDoc.status,
        operatorId: input.operatorId,
        operatorName: input.operatorName || '系统调剂',
        remark: `案件改派：由 ${fromJudge.name} 转至 ${toJudge.name}。原因：${input.reassignmentReason}`
      });

      await session.commitTransaction();
      await session.endSession();

      return {
        success: true,
        caseId: caseDoc._id,
        fromJudgeId: fromJudge._id,
        toJudgeId: toJudge._id,
        trail,
        message: '案件改派成功'
      };
    } catch (error) {
      await session.abortTransaction();
      await session.endSession();
      throw error;
    }
  }

  static async getReassignmentHistory(
    filter: {
      caseId?: mongoose.Types.ObjectId;
      fromJudgeId?: mongoose.Types.ObjectId;
      toJudgeId?: mongoose.Types.ObjectId;
      startDate?: Date;
      endDate?: Date;
      reassignmentType?: string;
    } = {}
  ): Promise<IJudgeReassignmentTrail[]> {
    const query: any = {};
    if (filter.caseId) query.caseId = filter.caseId;
    if (filter.fromJudgeId) query.fromJudgeId = filter.fromJudgeId;
    if (filter.toJudgeId) query.toJudgeId = filter.toJudgeId;
    if (filter.reassignmentType) query.reassignmentType = filter.reassignmentType;
    if (filter.startDate || filter.endDate) {
      query.reassignedAt = {};
      if (filter.startDate) query.reassignedAt.$gte = filter.startDate;
      if (filter.endDate) query.reassignedAt.$lte = filter.endDate;
    }

    return JudgeReassignmentTrail.find(query)
      .populate('caseId')
      .populate('fromJudgeId')
      .populate('toJudgeId')
      .sort({ reassignedAt: -1 });
  }

  static async getJudgeWorkloadBoard(
    circuitCourtId?: mongoose.Types.ObjectId,
    warningThreshold: number = DEFAULT_WARNING_THRESHOLD
  ): Promise<{
    judges: Array<{
      judge: IJudge;
      currentLoad: number;
      maxLoad: number;
      percentage: number;
      status: 'normal' | 'warning' | 'overload';
      recentReassignmentCount: number;
    }>;
    summary: {
      totalJudges: number;
      normalCount: number;
      warningCount: number;
      overloadCount: number;
      averagePercentage: number;
      totalActiveCases: number;
      todayReassignments: number;
    };
  }> {
    const query: any = { isActive: true };
    if (circuitCourtId) query.circuitCourtId = circuitCourtId;

    const judges = await Judge.find(query).populate('circuitCourtId');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await Promise.all(
      judges.map(async (judge) => {
        const activeCases = await CaseModel.countDocuments({
          judgeId: judge._id,
          status: { $in: [CaseStatus.PENDING, CaseStatus.PROCESSING, CaseStatus.URGENT] }
        });

        const percentage = (activeCases / judge.maxCaseLoad) * 100;
        let status: 'normal' | 'warning' | 'overload' = 'normal';
        if (percentage >= 100) status = 'overload';
        else if (percentage >= warningThreshold) status = 'warning';

        const recentReassignments = await JudgeReassignmentTrail.countDocuments({
          $or: [{ fromJudgeId: judge._id }, { toJudgeId: judge._id }],
          reassignedAt: { $gte: today }
        });

        return {
          judge,
          currentLoad: activeCases,
          maxLoad: judge.maxCaseLoad,
          percentage: Math.round(percentage * 10) / 10,
          status,
          recentReassignmentCount: recentReassignments
        };
      })
    );

    const totalActiveCases = result.reduce((sum, r) => sum + r.currentLoad, 0);
    const averagePercentage = result.length > 0
      ? result.reduce((sum, r) => sum + r.percentage, 0) / result.length
      : 0;

    const todayReassignments = await JudgeReassignmentTrail.countDocuments({
      reassignedAt: { $gte: today }
    });

    return {
      judges: result.sort((a, b) => b.percentage - a.percentage),
      summary: {
        totalJudges: judges.length,
        normalCount: result.filter((r) => r.status === 'normal').length,
        warningCount: result.filter((r) => r.status === 'warning').length,
        overloadCount: result.filter((r) => r.status === 'overload').length,
        averagePercentage: Math.round(averagePercentage * 10) / 10,
        totalActiveCases,
        todayReassignments
      }
    };
  }

  static async batchExecuteReassignment(
    inputs: ReassignmentExecutionInput[]
  ): Promise<ReassignmentResult[]> {
    const results: ReassignmentResult[] = [];
    for (const input of inputs) {
      try {
        const result = await this.executeReassignment(input);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          caseId: input.caseId,
          fromJudgeId: input.fromJudgeId,
          toJudgeId: input.toJudgeId,
          message: error instanceof Error ? error.message : '未知错误'
        });
      }
    }
    return results;
  }
}
