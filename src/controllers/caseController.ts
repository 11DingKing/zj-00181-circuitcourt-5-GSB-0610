import { Request, Response } from "express";
import mongoose from "mongoose";
import CaseModel from "../models/Case";
import { JurisdictionService } from "../services/jurisdictionService";
import { CaseFlowService } from "../services/caseFlowService";
import { CaseAssignmentService } from "../services/caseAssignmentService";
import { WorkloadBalanceService } from "../services/workloadBalanceService";
import { CaseStage, TransferSource, JudgeSpecialty } from "../types/enums";

export const registerCase = async (req: Request, res: Response) => {
  try {
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
    } = req.body;

    if (
      !caseNumber ||
      !caseType ||
      !title ||
      !occurrenceLocation ||
      !occurrenceDate ||
      !transferSource
    ) {
      return res.status(400).json({
        success: false,
        message: "请填写完整的案件信息",
      });
    }

    const jurisdictionResult = await JurisdictionService.matchCircuitCourt({
      province: occurrenceLocation.province,
      city: occurrenceLocation.city,
      county: occurrenceLocation.county,
    });

    if (!jurisdictionResult) {
      return res.status(400).json({
        success: false,
        message: "无法确定案件管辖法庭",
      });
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

    res.status(201).json({
      success: true,
      data: {
        case: populatedCase,
        jurisdictionMatch: jurisdictionResult,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "案件登记失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getCaseList = async (req: Request, res: Response) => {
  try {
    const {
      courtId,
      stage,
      status,
      caseType,
      complexity,
      isCrossRegional,
      page = 1,
      pageSize = 20,
    } = req.query;

    const query: any = {};
    if (courtId) query.circuitCourtId = courtId;
    if (stage) query.stage = stage;
    if (status) query.status = status;
    if (caseType) query.caseType = caseType;
    if (complexity) query.complexity = complexity;
    if (isCrossRegional !== undefined)
      query.isCrossRegional = isCrossRegional === "true";

    const skip = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);

    const cases = await CaseModel.find(query)
      .populate("circuitCourtId")
      .populate("judgeId")
      .sort({ acceptedDate: -1 })
      .skip(skip)
      .limit(limit);

    const total = await CaseModel.countDocuments(query);

    res.json({
      success: true,
      data: {
        cases,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "获取案件列表失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getCaseDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseDoc = await CaseModel.findById(id)
      .populate("circuitCourtId")
      .populate("judgeId")
      .populate("panelJudges");

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        message: "未找到该案件",
      });
    }

    const flowHistory = await CaseFlowService.getCaseFlowHistory(
      new mongoose.Types.ObjectId(id),
    );
    const transferTrails = await CaseFlowService.getTransferTrails(
      new mongoose.Types.ObjectId(id),
    );
    const judgeReassignmentHistory =
      await CaseFlowService.getJudgeReassignmentHistory(
        new mongoose.Types.ObjectId(id),
      );
    const durationInfo = CaseFlowService.calculateTrialDuration(caseDoc);

    res.json({
      success: true,
      data: {
        case: caseDoc,
        flowHistory,
        transferTrails,
        judgeReassignmentHistory,
        durationInfo,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "获取案件详情失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const transitionCaseStage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { toStage, operatorId, operatorName, remark } = req.body;

    if (!toStage || !Object.values(CaseStage).includes(toStage)) {
      return res.status(400).json({
        success: false,
        message: "请提供有效的案件阶段",
      });
    }

    const caseDoc = await CaseFlowService.transitionStage({
      caseId: new mongoose.Types.ObjectId(id),
      toStage: toStage as CaseStage,
      operatorId,
      operatorName,
      remark,
    });

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        message: "未找到该案件",
      });
    }

    const populatedCase = await CaseModel.findById(id)
      .populate("circuitCourtId")
      .populate("judgeId")
      .populate("panelJudges");

    res.json({
      success: true,
      data: populatedCase,
      message: `案件已流转至${toStage}阶段`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "案件流转失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const checkCaseStatus = async (req: Request, res: Response) => {
  try {
    const result = await CaseFlowService.checkAndUpdateCaseStatus();
    res.json({
      success: true,
      data: result,
      message: `已处理 ${result.notifiedCases.length} 个案件的状态更新`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "案件状态检查失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getJudgeWorkload = async (req: Request, res: Response) => {
  try {
    const { courtId } = req.query;
    const workload = await CaseAssignmentService.getJudgeWorkload(
      courtId ? new mongoose.Types.ObjectId(courtId as string) : undefined,
    );
    res.json({
      success: true,
      data: workload,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "获取法官工作量失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const reassignOverloadedCases = async (req: Request, res: Response) => {
  try {
    const reassignedCount =
      await CaseAssignmentService.reassignOverloadedCases();
    res.json({
      success: true,
      data: { reassignedCount },
      message: `已重新分配 ${reassignedCount} 个积压案件`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "案件重新分配失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const createTransferRecord = async (req: Request, res: Response) => {
  try {
    const trail = await CaseFlowService.createTransferTrail({
      ...req.body,
      caseId: new mongoose.Types.ObjectId(req.body.caseId),
      toCourtId: new mongoose.Types.ObjectId(req.body.toCourtId),
      transferDate: new Date(req.body.transferDate),
    });
    res.status(201).json({
      success: true,
      data: trail,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "创建移送记录失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const analyzeWorkload = async (req: Request, res: Response) => {
  try {
    const { courtId, specialty, warningThreshold } = req.query;

    const filter: any = {};
    if (courtId)
      filter.circuitCourtId = new mongoose.Types.ObjectId(courtId as string);
    if (
      specialty &&
      Object.values(JudgeSpecialty).includes(specialty as JudgeSpecialty)
    ) {
      filter.specialty = specialty as JudgeSpecialty;
    }

    const threshold = warningThreshold ? Number(warningThreshold) : undefined;
    const result = await WorkloadBalanceService.analyzeWorkload(
      filter,
      threshold,
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "负荷分析失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getReassignmentSuggestions = async (
  req: Request,
  res: Response,
) => {
  try {
    const { courtId, specialty, warningThreshold } = req.query;

    const filter: any = {};
    if (courtId)
      filter.circuitCourtId = new mongoose.Types.ObjectId(courtId as string);
    if (
      specialty &&
      Object.values(JudgeSpecialty).includes(specialty as JudgeSpecialty)
    ) {
      filter.specialty = specialty as JudgeSpecialty;
    }

    const threshold = warningThreshold ? Number(warningThreshold) : undefined;
    const suggestions =
      await WorkloadBalanceService.generateReassignmentSuggestions(
        filter,
        threshold,
      );

    res.json({
      success: true,
      data: {
        suggestions,
        totalOverloaded: suggestions.length,
        totalRecommendedTransfers: suggestions.reduce(
          (sum, s) => sum + s.recommendedTransfers.length,
          0,
        ),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "生成改派建议失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const executeReassignment = async (req: Request, res: Response) => {
  try {
    const {
      caseId,
      fromJudgeId,
      toJudgeId,
      reassignmentReason,
      reassignmentType,
      operatorId,
      operatorName,
      remark,
    } = req.body;

    if (
      !caseId ||
      !fromJudgeId ||
      !toJudgeId ||
      !reassignmentReason ||
      !reassignmentType
    ) {
      return res.status(400).json({
        success: false,
        message: "请填写完整的改派信息",
      });
    }

    const validTypes = [
      "load_balance",
      "specialty_adjustment",
      "manual",
      "other",
    ];
    if (!validTypes.includes(reassignmentType)) {
      return res.status(400).json({
        success: false,
        message: "无效的改派类型",
      });
    }

    const result = await WorkloadBalanceService.executeReassignment({
      caseId: new mongoose.Types.ObjectId(caseId),
      fromJudgeId: new mongoose.Types.ObjectId(fromJudgeId),
      toJudgeId: new mongoose.Types.ObjectId(toJudgeId),
      reassignmentReason,
      reassignmentType: reassignmentType as any,
      operatorId,
      operatorName,
      remark,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.json({
      success: true,
      data: result,
      message: "案件改派成功",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "案件改派失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const batchExecuteReassignment = async (req: Request, res: Response) => {
  try {
    const { reassignments } = req.body;

    if (!Array.isArray(reassignments) || reassignments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "请提供改派列表",
      });
    }

    const inputs = reassignments.map((r: any) => ({
      caseId: new mongoose.Types.ObjectId(r.caseId),
      fromJudgeId: new mongoose.Types.ObjectId(r.fromJudgeId),
      toJudgeId: new mongoose.Types.ObjectId(r.toJudgeId),
      reassignmentReason: r.reassignmentReason,
      reassignmentType: r.reassignmentType,
      operatorId: r.operatorId,
      operatorName: r.operatorName,
      remark: r.remark,
    }));

    const results =
      await WorkloadBalanceService.batchExecuteReassignment(inputs);

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    res.json({
      success: true,
      data: {
        results,
        successCount,
        failCount,
        totalCount: results.length,
      },
      message: `批量改派完成：成功 ${successCount} 件，失败 ${failCount} 件`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "批量改派失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getReassignmentHistory = async (req: Request, res: Response) => {
  try {
    const {
      caseId,
      fromJudgeId,
      toJudgeId,
      startDate,
      endDate,
      reassignmentType,
    } = req.query;

    const filter: any = {};
    if (caseId) filter.caseId = new mongoose.Types.ObjectId(caseId as string);
    if (fromJudgeId)
      filter.fromJudgeId = new mongoose.Types.ObjectId(fromJudgeId as string);
    if (toJudgeId)
      filter.toJudgeId = new mongoose.Types.ObjectId(toJudgeId as string);
    if (reassignmentType) filter.reassignmentType = reassignmentType;
    if (startDate) filter.startDate = new Date(startDate as string);
    if (endDate) filter.endDate = new Date(endDate as string);

    const history = await WorkloadBalanceService.getReassignmentHistory(filter);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "获取改派历史失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getJudgeWorkloadBoard = async (req: Request, res: Response) => {
  try {
    const { courtId, warningThreshold } = req.query;

    const circuitCourtId = courtId
      ? new mongoose.Types.ObjectId(courtId as string)
      : undefined;

    const threshold = warningThreshold ? Number(warningThreshold) : undefined;
    const board = await WorkloadBalanceService.getJudgeWorkloadBoard(
      circuitCourtId,
      threshold,
    );

    res.json({
      success: true,
      data: board,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "获取法官负荷看板失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};
