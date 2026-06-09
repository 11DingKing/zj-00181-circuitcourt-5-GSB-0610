import { Request, Response } from "express";
import { CaseFlowService } from "../services/caseFlowService";
import { CaseAssignmentService } from "../services/caseAssignmentService";
import { WorkloadBalanceService } from "../services/workloadBalanceService";
import { ServiceValidationError } from "../services/serviceHelpers";

type Handler = (req: Request, res: Response) => Promise<any>;

const handle = (
  fallbackMessage: string,
  handler: Handler,
): ((req: Request, res: Response) => Promise<void>) => {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof ServiceValidationError) {
        res.status(error.status).json({
          success: false,
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        message: fallbackMessage,
        error: error instanceof Error ? error.message : "未知错误",
      });
    }
  };
};

export const registerCase = handle("案件登记失败", async (req, res) => {
  const result = await CaseFlowService.handleRegisterCase(req.body);
  res.status(201).json({
    success: true,
    data: {
      case: result.case,
      jurisdictionMatch: result.jurisdictionMatch,
    },
  });
});

export const getCaseList = handle("获取案件列表失败", async (req, res) => {
  const data = await CaseFlowService.listCases(req.query);
  res.json({ success: true, data });
});

export const getCaseDetail = handle("获取案件详情失败", async (req, res) => {
  const data = await CaseFlowService.getCaseDetail(req.params.id);
  if (!data) {
    res.status(404).json({ success: false, message: "未找到该案件" });
    return;
  }
  res.json({ success: true, data });
});

export const transitionCaseStage = handle("案件流转失败", async (req, res) => {
  const populatedCase = await CaseFlowService.handleStageTransition(
    req.params.id,
    req.body,
  );
  if (!populatedCase) {
    res.status(404).json({ success: false, message: "未找到该案件" });
    return;
  }
  res.json({
    success: true,
    data: populatedCase,
    message: `案件已流转至${req.body.toStage}阶段`,
  });
});

export const checkCaseStatus = handle("案件状态检查失败", async (_req, res) => {
  const result = await CaseFlowService.checkAndUpdateCaseStatus();
  res.json({
    success: true,
    data: result,
    message: `已处理 ${result.notifiedCases.length} 个案件的状态更新`,
  });
});

export const getJudgeWorkload = handle(
  "获取法官工作量失败",
  async (req, res) => {
    const workload = await CaseAssignmentService.handleGetJudgeWorkload(
      req.query,
    );
    res.json({ success: true, data: workload });
  },
);

export const reassignOverloadedCases = handle(
  "案件重新分配失败",
  async (_req, res) => {
    const reassignedCount =
      await CaseAssignmentService.reassignOverloadedCases();
    res.json({
      success: true,
      data: { reassignedCount },
      message: `已重新分配 ${reassignedCount} 个积压案件`,
    });
  },
);

export const createTransferRecord = handle(
  "创建移送记录失败",
  async (req, res) => {
    const trail = await CaseFlowService.handleCreateTransferRecord(req.body);
    res.status(201).json({ success: true, data: trail });
  },
);

export const analyzeWorkload = handle("负荷分析失败", async (req, res) => {
  const result = await WorkloadBalanceService.handleAnalyzeWorkload(req.query);
  res.json({ success: true, data: result });
});

export const getReassignmentSuggestions = handle(
  "生成改派建议失败",
  async (req, res) => {
    const data = await WorkloadBalanceService.handleReassignmentSuggestions(
      req.query,
    );
    res.json({ success: true, data });
  },
);

export const executeReassignment = handle("案件改派失败", async (req, res) => {
  const result = await WorkloadBalanceService.handleExecuteReassignment(
    req.body,
  );
  if (!result.success) {
    res.status(400).json({ success: false, message: result.message });
    return;
  }
  res.json({ success: true, data: result, message: "案件改派成功" });
});

export const batchExecuteReassignment = handle(
  "批量改派失败",
  async (req, res) => {
    const data = await WorkloadBalanceService.handleBatchExecuteReassignment(
      req.body,
    );
    res.json({
      success: true,
      data,
      message: `批量改派完成：成功 ${data.successCount} 件，失败 ${data.failCount} 件`,
    });
  },
);

export const getReassignmentHistory = handle(
  "获取改派历史失败",
  async (req, res) => {
    const history = await WorkloadBalanceService.handleReassignmentHistory(
      req.query,
    );
    res.json({ success: true, data: history });
  },
);

export const getJudgeWorkloadBoard = handle(
  "获取法官负荷看板失败",
  async (req, res) => {
    const board = await WorkloadBalanceService.handleJudgeWorkloadBoard(
      req.query,
    );
    res.json({ success: true, data: board });
  },
);
