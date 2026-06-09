import { Request, Response } from "express";
import { CaseService } from "../services/caseService";
import { WorkloadService } from "../services/workloadService";

function isValidationError(error: unknown): string | null {
  if (error instanceof Error && error.message.startsWith("VALIDATION_ERROR:")) {
    return error.message.replace("VALIDATION_ERROR:", "");
  }
  return null;
}

export const registerCase = async (req: Request, res: Response) => {
  try {
    const result = await CaseService.registerCase(req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const validationMsg = isValidationError(error);
    if (validationMsg) {
      return res.status(400).json({ success: false, message: validationMsg });
    }
    res.status(500).json({
      success: false,
      message: "案件登记失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getCaseList = async (req: Request, res: Response) => {
  try {
    const data = await CaseService.getCaseList(req.query as any);
    res.json({ success: true, data });
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
    const data = await CaseService.getCaseDetail(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: "未找到该案件" });
    }
    res.json({ success: true, data });
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
    const { toStage, operatorId, operatorName, remark } = req.body;
    const populatedCase = await CaseService.transitionCaseStage(
      req.params.id,
      toStage,
      operatorId,
      operatorName,
      remark,
    );
    if (!populatedCase) {
      return res.status(404).json({ success: false, message: "未找到该案件" });
    }
    res.json({
      success: true,
      data: populatedCase,
      message: `案件已流转至${toStage}阶段`,
    });
  } catch (error) {
    const validationMsg = isValidationError(error);
    if (validationMsg) {
      return res.status(400).json({ success: false, message: validationMsg });
    }
    res.status(500).json({
      success: false,
      message: "案件流转失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const checkCaseStatus = async (req: Request, res: Response) => {
  try {
    const result = await CaseService.checkCaseStatus();
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
    const data = await CaseService.getJudgeWorkload(
      req.query.courtId as string,
    );
    res.json({ success: true, data });
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
    const reassignedCount = await CaseService.reassignOverloadedCases();
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
    const trail = await CaseService.createTransferRecord(req.body);
    res.status(201).json({ success: true, data: trail });
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
    const data = await WorkloadService.analyzeWorkload(req.query as any);
    res.json({ success: true, data });
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
    const data = await WorkloadService.getReassignmentSuggestions(
      req.query as any,
    );
    res.json({ success: true, data });
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
    const result = await WorkloadService.executeReassignment(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    res.json({ success: true, data: result, message: "案件改派成功" });
  } catch (error) {
    const validationMsg = isValidationError(error);
    if (validationMsg) {
      return res.status(400).json({ success: false, message: validationMsg });
    }
    res.status(500).json({
      success: false,
      message: "案件改派失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const batchExecuteReassignment = async (req: Request, res: Response) => {
  try {
    const { results, successCount, failCount, totalCount } =
      await WorkloadService.batchExecuteReassignment(req.body);
    res.json({
      success: true,
      data: { results, successCount, failCount, totalCount },
      message: `批量改派完成：成功 ${successCount} 件，失败 ${failCount} 件`,
    });
  } catch (error) {
    const validationMsg = isValidationError(error);
    if (validationMsg) {
      return res.status(400).json({ success: false, message: validationMsg });
    }
    res.status(500).json({
      success: false,
      message: "批量改派失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getReassignmentHistory = async (req: Request, res: Response) => {
  try {
    const data = await WorkloadService.getReassignmentHistory(req.query as any);
    res.json({ success: true, data });
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
    const data = await WorkloadService.getJudgeWorkloadBoard(req.query as any);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "获取法官负荷看板失败",
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};
