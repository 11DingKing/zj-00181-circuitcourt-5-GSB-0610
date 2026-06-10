import { Request, Response } from "express";
import { CaseService } from "../services/caseService";
import { CaseFlowService } from "../services/caseFlowService";
import { CaseAssignmentService } from "../services/caseAssignmentService";
import { WorkloadBalanceService } from "../services/workloadBalanceService";

export const registerCase = async (req: Request, res: Response) => {
  try {
    const result = await CaseService.registerCase(req.body);
    res.status(201).json({
      success: true,
      data: {
        case: result.case,
        jurisdictionMatch: result.jurisdictionMatch,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    const statusCode = message.includes("请填写") || message.includes("无法确定") ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: message.includes("请填写") || message.includes("无法确定") ? message : "案件登记失败",
      error: message,
    });
  }
};

export const getCaseList = async (req: Request, res: Response) => {
  try {
    const query = {
      courtId: req.query.courtId as string,
      stage: req.query.stage as string,
      status: req.query.status as string,
      caseType: req.query.caseType as string,
      complexity: req.query.complexity as string,
      isCrossRegional: req.query.isCrossRegional !== undefined ? req.query.isCrossRegional === "true" : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    };

    const result = await CaseService.getCaseList(query);

    res.json({
      success: true,
      data: result,
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
    const result = await CaseService.getCaseDetail(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "未找到该案件",
      });
    }

    res.json({
      success: true,
      data: result,
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

    const caseDoc = await CaseService.transitionStage(id, toStage, operatorId, operatorName, remark);

    if (!caseDoc) {
      return res.status(404).json({
        success: false,
        message: "未找到该案件",
      });
    }

    res.json({
      success: true,
      data: caseDoc,
      message: `案件已流转至${toStage}阶段`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    const statusCode = message.includes("有效的案件阶段") ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: message.includes("有效的案件阶段") ? message : "案件流转失败",
      error: message,
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
      CaseService.toObjectIdSafe(courtId as string)
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
    const reassignedCount = await CaseAssignmentService.reassignOverloadedCases();
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
    const trail = await CaseFlowService.createTransferTrail(
      CaseService.parseTransferTrailInput(req.body)
    );
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
    const { filter, threshold } = CaseService.parseWorkloadFilter(req.query);
    const result = await WorkloadBalanceService.analyzeWorkload(filter, threshold);

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

export const getReassignmentSuggestions = async (req: Request, res: Response) => {
  try {
    const { filter, threshold } = CaseService.parseWorkloadFilter(req.query);
    const suggestions = await WorkloadBalanceService.generateReassignmentSuggestions(
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
    const validation = CaseService.validateReassignmentInput(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const result = await WorkloadBalanceService.executeReassignment(
      CaseService.parseReassignmentInput(req.body)
    );

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

    const inputs = CaseService.parseBatchReassignmentInputs(reassignments);
    const results = await WorkloadBalanceService.batchExecuteReassignment(inputs);

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
    const filter = CaseService.parseReassignmentHistoryFilter(req.query);
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

    const circuitCourtId = CaseService.toObjectIdSafe(courtId as string);
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
