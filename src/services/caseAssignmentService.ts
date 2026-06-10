import mongoose from "mongoose";
import Judge, { IJudge } from "../models/Judge";
import CaseModel, { ICase } from "../models/Case";
import { CaseComplexity, CaseType, JudgeSpecialty } from "../types/enums";
import { toOptionalObjectId } from "./serviceHelpers";

export interface CaseAssignmentResult {
  judge: IJudge;
  isPanel: boolean;
  panelJudges?: IJudge[];
  assignmentReason: string;
  workloadScore: number;
}

export interface ComplexityAssessmentInput {
  caseType: CaseType;
  description: string;
  involvesMultipleParties?: boolean;
  involvesLargeAmount?: boolean;
  hasTechnicalDifficulty?: boolean;
  isCrossRegional?: boolean;
  hasSocialImpact?: boolean;
}

const CaseTypeToSpecialtyMap: Partial<Record<CaseType, JudgeSpecialty[]>> = {
  [CaseType.POLLUTION_ENVIRONMENT]: [
    JudgeSpecialty.POLLUTION_CONTROL,
    JudgeSpecialty.ECOLOGICAL_RESTORATION,
  ],
  [CaseType.ILLEGAL_MINING]: [
    JudgeSpecialty.MINERAL_RESOURCES,
    JudgeSpecialty.ECOLOGICAL_RESTORATION,
  ],
  [CaseType.ILLEGAL_HUNTING]: [JudgeSpecialty.WILDLIFE],
  [CaseType.ECOLOGICAL_DAMAGE_COMPENSATION]: [
    JudgeSpecialty.ECOLOGICAL_RESTORATION,
    JudgeSpecialty.POLLUTION_CONTROL,
  ],
  [CaseType.ILLEGAL_LOGGING]: [
    JudgeSpecialty.WILDLIFE,
    JudgeSpecialty.ECOLOGICAL_RESTORATION,
  ],
  [CaseType.ILLEGAL_FISHING]: [
    JudgeSpecialty.WATER_RESOURCES,
    JudgeSpecialty.WILDLIFE,
  ],
  [CaseType.WILDLIFE_PROTECTION]: [JudgeSpecialty.WILDLIFE],
  [CaseType.WATER_RESOURCE_PROTECTION]: [
    JudgeSpecialty.WATER_RESOURCES,
    JudgeSpecialty.POLLUTION_CONTROL,
  ],
};

export class CaseAssignmentService {
  static assessComplexity(input: ComplexityAssessmentInput): CaseComplexity {
    let complexityScore = 0;

    if (input.involvesMultipleParties) complexityScore += 20;
    if (input.involvesLargeAmount) complexityScore += 25;
    if (input.hasTechnicalDifficulty) complexityScore += 30;
    if (input.isCrossRegional) complexityScore += 15;
    if (input.hasSocialImpact) complexityScore += 25;

    const keywords = [
      "重大",
      "恶劣",
      "严重",
      "跨省",
      "跨市",
      "集团",
      "系列",
      "疑难",
      "复杂",
    ];
    const desc = input.description || "";
    keywords.forEach((kw) => {
      if (desc.includes(kw)) complexityScore += 10;
    });

    return complexityScore >= 50
      ? CaseComplexity.COMPLEX
      : CaseComplexity.SIMPLE;
  }

  static async assignCase(
    caseData: ICase,
    circuitCourtId: mongoose.Types.ObjectId,
  ): Promise<CaseAssignmentResult | null> {
    const availableJudges = await Judge.find({
      circuitCourtId,
      isActive: true,
    }).populate("circuitCourtId");

    if (availableJudges.length === 0) {
      return null;
    }

    if (caseData.complexity === CaseComplexity.COMPLEX) {
      return this.assignComplexCase(caseData, availableJudges);
    } else {
      return this.assignSimpleCase(caseData, availableJudges);
    }
  }

  private static async assignSimpleCase(
    caseData: ICase,
    judges: IJudge[],
  ): Promise<CaseAssignmentResult> {
    const preferredSpecialties = CaseTypeToSpecialtyMap[caseData.caseType] || [
      JudgeSpecialty.GENERAL,
    ];

    const scoredJudges = judges.map((judge) => {
      let score = 0;

      const workloadRatio = judge.currentCaseCount / judge.maxCaseLoad;
      score -= workloadRatio * 50;

      const hasSpecialty = judge.specialties.some((s) =>
        preferredSpecialties.includes(s),
      );
      if (hasSpecialty) score += 30;

      if (judge.specialties.includes(JudgeSpecialty.GENERAL)) score += 10;

      return { judge, score };
    });

    scoredJudges.sort((a, b) => b.score - a.score);

    const selectedJudge = scoredJudges[0].judge;
    await this.incrementJudgeCaseCount(selectedJudge._id);

    return {
      judge: selectedJudge,
      isPanel: false,
      assignmentReason: `简案快办通道，按专业匹配度和工作量均衡指派，得分: ${scoredJudges[0].score.toFixed(1)}`,
      workloadScore: scoredJudges[0].score,
    };
  }

  private static async assignComplexCase(
    caseData: ICase,
    judges: IJudge[],
  ): Promise<CaseAssignmentResult> {
    const preferredSpecialties = CaseTypeToSpecialtyMap[caseData.caseType] || [
      JudgeSpecialty.GENERAL,
    ];

    const scoredJudges = judges.map((judge) => {
      let score = 0;

      const workloadRatio = judge.currentCaseCount / judge.maxCaseLoad;
      score -= workloadRatio * 40;

      const specialtyMatchCount = judge.specialties.filter((s) =>
        preferredSpecialties.includes(s),
      ).length;
      score += specialtyMatchCount * 25;

      if (judge.specialties.includes(JudgeSpecialty.GENERAL)) score += 10;

      return { judge, score };
    });

    scoredJudges.sort((a, b) => b.score - a.score);

    const panelSize = Math.min(3, judges.length);
    const panelJudges = scoredJudges.slice(0, panelSize).map((sj) => sj.judge);
    const presidingJudge = panelJudges[0];

    for (const j of panelJudges) {
      await this.incrementJudgeCaseCount(j._id);
    }

    return {
      judge: presidingJudge,
      isPanel: true,
      panelJudges,
      assignmentReason: `繁案合议庭审理，${panelSize}名法官组成合议庭，按专业匹配度和工作量均衡指派`,
      workloadScore: scoredJudges[0].score,
    };
  }

  private static async incrementJudgeCaseCount(
    judgeId: mongoose.Types.ObjectId,
  ): Promise<void> {
    await Judge.findByIdAndUpdate(
      judgeId,
      { $inc: { currentCaseCount: 1 } },
      { new: true },
    );
  }

  static async decrementJudgeCaseCount(
    judgeId: mongoose.Types.ObjectId,
  ): Promise<void> {
    await Judge.findByIdAndUpdate(
      judgeId,
      { $inc: { currentCaseCount: -1 } },
      { new: true },
    );
  }

  static async getJudgeWorkload(
    circuitCourtId?: mongoose.Types.ObjectId,
  ): Promise<
    Array<{
      judge: IJudge;
      activeCases: number;
      workloadPercentage: number;
      isOverloaded: boolean;
    }>
  > {
    const query = circuitCourtId
      ? { circuitCourtId, isActive: true }
      : { isActive: true };
    const judges = await Judge.find(query).populate("circuitCourtId");

    const result = await Promise.all(
      judges.map(async (judge) => {
        const activeCases = await CaseModel.countDocuments({
          judgeId: judge._id,
          status: { $in: ["pending", "processing", "urgent"] },
        });

        const workloadPercentage = (activeCases / judge.maxCaseLoad) * 100;

        return {
          judge,
          activeCases,
          workloadPercentage: Math.round(workloadPercentage * 10) / 10,
          isOverloaded: activeCases > judge.maxCaseLoad,
        };
      }),
    );

    return result.sort((a, b) => b.workloadPercentage - a.workloadPercentage);
  }

  static async reassignOverloadedCases(): Promise<number> {
    const workloads = await this.getJudgeWorkload();
    const overloaded = workloads.filter((w) => w.isOverloaded);
    let reassignedCount = 0;

    for (const over of overloaded) {
      const excess = over.activeCases - over.judge.maxCaseLoad;
      const cases = await CaseModel.find({
        judgeId: over.judge._id,
        status: "pending",
        complexity: CaseComplexity.SIMPLE,
      }).limit(excess);

      for (const caseItem of cases) {
        const otherJudges = workloads
          .filter(
            (w) =>
              !w.isOverloaded &&
              w.judge.circuitCourtId.toString() ===
                over.judge.circuitCourtId.toString(),
          )
          .sort((a, b) => a.workloadPercentage - b.workloadPercentage);

        if (otherJudges.length > 0) {
          const newJudge = otherJudges[0].judge;
          await CaseModel.findByIdAndUpdate(caseItem._id, {
            judgeId: newJudge._id,
          });
          await this.decrementJudgeCaseCount(over.judge._id);
          await this.incrementJudgeCaseCount(newJudge._id);
          reassignedCount++;
        }
      }
    }

    return reassignedCount;
  }

  static async handleGetJudgeWorkload(query: any) {
    const courtId = toOptionalObjectId(query?.courtId);
    return this.getJudgeWorkload(courtId);
  }
}
