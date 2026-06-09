import mongoose from "mongoose";
import CaseModel, { ICase } from "../models/Case";
import CircuitCourt from "../models/CircuitCourt";
import {
  CaseType,
  CaseComplexity,
  CaseStage,
  CaseStatus,
} from "../types/enums";

export interface CourtStatistics {
  courtId: string;
  courtName: string;
  courtCode: string;
  totalCases: number;
  casesByType: Record<string, number>;
  casesByComplexity: {
    simple: number;
    complex: number;
    simpleRatio: number;
  };
  casesByStage: Record<string, number>;
  casesByStatus: Record<string, number>;
  crossRegionalCases: number;
  crossRegionalRatio: number;
  averageTrialDays: number;
  completedCases: number;
  pendingCases: number;
  overdueCases: number;
  urgentCases: number;
}

export interface OverallStatistics {
  totalCases: number;
  totalCourts: number;
  casesByType: Record<string, number>;
  casesByComplexity: {
    simple: number;
    complex: number;
    simpleRatio: number;
  };
  crossRegionalCases: number;
  crossRegionalRatio: number;
  averageTrialDays: number;
  averageTrialDaysSimple: number;
  averageTrialDaysComplex: number;
  completedCases: number;
  pendingCases: number;
  overdueCases: number;
  urgentCases: number;
  courtStats: CourtStatistics[];
  crossRegionalTrend: Array<{
    period: string;
    beforeConcentration: number;
    afterConcentration: number;
  }>;
}

export class StatisticsService {
  static async getOverallStatistics(): Promise<OverallStatistics> {
    const allCases = await CaseModel.find().populate("circuitCourtId");
    const courts = await CircuitCourt.find({ isActive: true });

    const casesByType = this.countByField(allCases, "caseType");
    const casesByComplexity = this.countByComplexity(allCases);
    const crossRegionalCases = allCases.filter((c) => c.isCrossRegional).length;
    const averageTrialDays = this.calculateAverageTrialDays(allCases);
    const averageTrialDaysSimple = this.calculateAverageTrialDays(
      allCases.filter((c) => c.complexity === CaseComplexity.SIMPLE),
    );
    const averageTrialDaysComplex = this.calculateAverageTrialDays(
      allCases.filter((c) => c.complexity === CaseComplexity.COMPLEX),
    );

    const completedCases = allCases.filter(
      (c) => c.stage === CaseStage.ARCHIVED,
    ).length;
    const pendingCases = allCases.filter(
      (c) =>
        c.stage !== CaseStage.ARCHIVED && c.status !== CaseStatus.COMPLETED,
    ).length;
    const overdueCases = allCases.filter(
      (c) => c.isOverdue || c.status === CaseStatus.OVERDUE,
    ).length;
    const urgentCases = allCases.filter(
      (c) => (c.isUrgent && !c.isOverdue) || c.status === CaseStatus.URGENT,
    ).length;

    const courtStats = await Promise.all(
      courts.map((court) => this.getCourtStatistics(court._id, allCases)),
    );

    const crossRegionalTrend = this.generateCrossRegionalTrend(allCases);

    return {
      totalCases: allCases.length,
      totalCourts: courts.length,
      casesByType,
      casesByComplexity,
      crossRegionalCases,
      crossRegionalRatio:
        allCases.length > 0 ? crossRegionalCases / allCases.length : 0,
      averageTrialDays,
      averageTrialDaysSimple,
      averageTrialDaysComplex,
      completedCases,
      pendingCases,
      overdueCases,
      urgentCases,
      courtStats,
      crossRegionalTrend,
    };
  }

  static async getCourtStatistics(
    courtId: mongoose.Types.ObjectId | string,
    allCases?: ICase[],
  ): Promise<CourtStatistics> {
    const court = await CircuitCourt.findById(courtId);
    if (!court) {
      throw new Error("Court not found");
    }

    const cases = allCases
      ? allCases.filter(
          (c) => c.circuitCourtId._id.toString() === courtId.toString(),
        )
      : await CaseModel.find({ circuitCourtId: courtId });

    const casesByType = this.countByField(cases, "caseType");
    const casesByComplexity = this.countByComplexity(cases);
    const casesByStage = this.countByField(cases, "stage");
    const casesByStatus = this.countByField(cases, "status");
    const crossRegionalCases = cases.filter((c) => c.isCrossRegional).length;
    const averageTrialDays = this.calculateAverageTrialDays(cases);

    const completedCases = cases.filter(
      (c) => c.stage === CaseStage.ARCHIVED,
    ).length;
    const pendingCases = cases.filter(
      (c) =>
        c.stage !== CaseStage.ARCHIVED && c.status !== CaseStatus.COMPLETED,
    ).length;
    const overdueCases = cases.filter(
      (c) => c.isOverdue || c.status === CaseStatus.OVERDUE,
    ).length;
    const urgentCases = cases.filter(
      (c) => (c.isUrgent && !c.isOverdue) || c.status === CaseStatus.URGENT,
    ).length;

    return {
      courtId: court._id.toString(),
      courtName: court.name,
      courtCode: court.code,
      totalCases: cases.length,
      casesByType,
      casesByComplexity,
      casesByStage,
      casesByStatus,
      crossRegionalCases,
      crossRegionalRatio:
        cases.length > 0 ? crossRegionalCases / cases.length : 0,
      averageTrialDays,
      completedCases,
      pendingCases,
      overdueCases,
      urgentCases,
    };
  }

  static async getCaseTypeDistribution(
    courtId?: mongoose.Types.ObjectId,
  ): Promise<Array<{ type: string; count: number; percentage: number }>> {
    const query = courtId ? { circuitCourtId: courtId } : {};
    const cases = await CaseModel.find(query);
    const byType = this.countByField(cases, "caseType");
    const total = cases.length;

    return Object.entries(byType)
      .map(([type, count]) => ({
        type,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  static async getComplexityDistribution(
    courtId?: mongoose.Types.ObjectId,
  ): Promise<
    Array<{
      complexity: string;
      count: number;
      percentage: number;
      avgDays: number;
    }>
  > {
    const query = courtId ? { circuitCourtId: courtId } : {};
    const cases = await CaseModel.find(query);

    const simpleCases = cases.filter(
      (c) => c.complexity === CaseComplexity.SIMPLE,
    );
    const complexCases = cases.filter(
      (c) => c.complexity === CaseComplexity.COMPLEX,
    );

    return [
      {
        complexity: CaseComplexity.SIMPLE,
        count: simpleCases.length,
        percentage:
          cases.length > 0
            ? Math.round((simpleCases.length / cases.length) * 1000) / 10
            : 0,
        avgDays: this.calculateAverageTrialDays(simpleCases),
      },
      {
        complexity: CaseComplexity.COMPLEX,
        count: complexCases.length,
        percentage:
          cases.length > 0
            ? Math.round((complexCases.length / cases.length) * 1000) / 10
            : 0,
        avgDays: this.calculateAverageTrialDays(complexCases),
      },
    ];
  }

  static async getTrialDurationTrend(months: number = 6): Promise<
    Array<{
      month: string;
      totalCases: number;
      avgTrialDays: number;
      simpleAvgDays: number;
      complexAvgDays: number;
    }>
  > {
    const result = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const monthCases = await CaseModel.find({
        acceptedDate: { $gte: monthStart, $lte: monthEnd },
      });

      const simpleCases = monthCases.filter(
        (c) => c.complexity === CaseComplexity.SIMPLE,
      );
      const complexCases = monthCases.filter(
        (c) => c.complexity === CaseComplexity.COMPLEX,
      );

      result.push({
        month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
        totalCases: monthCases.length,
        avgTrialDays: this.calculateAverageTrialDays(monthCases),
        simpleAvgDays: this.calculateAverageTrialDays(simpleCases),
        complexAvgDays: this.calculateAverageTrialDays(complexCases),
      });
    }

    return result;
  }

  private static countByField(
    cases: ICase[],
    field: keyof ICase,
  ): Record<string, number> {
    const count: Record<string, number> = {};
    for (const c of cases) {
      const value = String(c[field]);
      count[value] = (count[value] || 0) + 1;
    }
    return count;
  }

  private static countByComplexity(cases: ICase[]): {
    simple: number;
    complex: number;
    simpleRatio: number;
  } {
    const simple = cases.filter(
      (c) => c.complexity === CaseComplexity.SIMPLE,
    ).length;
    const complex = cases.filter(
      (c) => c.complexity === CaseComplexity.COMPLEX,
    ).length;
    return {
      simple,
      complex,
      simpleRatio: cases.length > 0 ? simple / cases.length : 0,
    };
  }

  private static calculateAverageTrialDays(cases: ICase[]): number {
    if (cases.length === 0) return 0;

    const completedCases = cases.filter(
      (c) => c.stage === CaseStage.ARCHIVED && c.archivedDate,
    );

    if (completedCases.length === 0) {
      const activeCases = cases.filter((c) => c.stage !== CaseStage.ARCHIVED);
      if (activeCases.length === 0) return 0;

      const totalDays = activeCases.reduce((sum, c) => {
        const now = new Date();
        const accepted = new Date(c.acceptedDate);
        return (
          sum +
          Math.ceil(
            (now.getTime() - accepted.getTime()) / (1000 * 60 * 60 * 24),
          )
        );
      }, 0);

      return Math.round((totalDays / activeCases.length) * 10) / 10;
    }

    const totalDays = completedCases.reduce((sum, c) => {
      if (!c.archivedDate) return sum;
      const archived = new Date(c.archivedDate);
      const accepted = new Date(c.acceptedDate);
      return (
        sum +
        Math.ceil(
          (archived.getTime() - accepted.getTime()) / (1000 * 60 * 60 * 24),
        )
      );
    }, 0);

    return Math.round((totalDays / completedCases.length) * 10) / 10;
  }

  private static generateCrossRegionalTrend(allCases: ICase[]): Array<{
    period: string;
    beforeConcentration: number;
    afterConcentration: number;
  }> {
    const concentrationStartDate = new Date("2024-01-01");

    const quarters = [
      {
        label: "2023 Q1",
        start: new Date("2023-01-01"),
        end: new Date("2023-03-31"),
      },
      {
        label: "2023 Q2",
        start: new Date("2023-04-01"),
        end: new Date("2023-06-30"),
      },
      {
        label: "2023 Q3",
        start: new Date("2023-07-01"),
        end: new Date("2023-09-30"),
      },
      {
        label: "2023 Q4",
        start: new Date("2023-10-01"),
        end: new Date("2023-12-31"),
      },
      {
        label: "2024 Q1",
        start: new Date("2024-01-01"),
        end: new Date("2024-03-31"),
      },
      {
        label: "2024 Q2",
        start: new Date("2024-04-01"),
        end: new Date("2024-06-30"),
      },
    ];

    return quarters.map((q) => {
      const quarterCases = allCases.filter(
        (c) =>
          new Date(c.acceptedDate) >= q.start &&
          new Date(c.acceptedDate) <= q.end,
      );

      const crossRegional = quarterCases.filter(
        (c) => c.isCrossRegional,
      ).length;
      const isAfter = q.start >= concentrationStartDate;

      return {
        period: q.label,
        beforeConcentration: isAfter ? 0 : crossRegional,
        afterConcentration: isAfter ? crossRegional : 0,
      };
    });
  }
}
