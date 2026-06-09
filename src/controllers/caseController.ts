import { Request, Response } from "express";
import { CaseService } from "../services/caseService";

export const registerCase = async (req: Request, res: Response) => {
  try {
    const validationError = CaseService.validateRegisterInput(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const result = await CaseService.registerCase(req.body);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message === "无法确定案件管辖法庭"
        ? error.message
        : "案件登记失败";
    const status =
      error instanceof Error && error.message === "无法确定案件管辖法庭"
        ? 400
        : 500;
    res.status(status).json({
      success: false,
      message,
      error: error instanceof Error ? error.message : "未知错误",
    });
  }
};

export const getCaseList = async (req: Request, res: Response) => {
  try {
    const result = await CaseService.getCaseList(req.query as any);
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

    const validationError = CaseService.validateStageTransition(toStage);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const caseDoc = await CaseService.transitionStage({
      caseId: id,
      toStage,
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

    res.json({
      success: true,
      data: caseDoc,
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
    const result = await CaseService.checkAndUpdateCaseStatus();
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
    const workload = await CaseService.getJudgeWorkload(courtId as string);
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
    const result = await CaseService.analyzeWorkload(req.query as any);
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
    const result = await CaseService.getReassignmentSuggestions(
      req.query as any,
    );
    res.json({
      success: true,
      data: result,
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
    const validationError = CaseService.validateReassignmentInput(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const result = await CaseService.executeReassignment(req.body);

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
    const validationError = CaseService.validateBatchReassignment(
      reassignments,
    );
    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const result = await CaseService.batchExecuteReassignment(req.body);

    res.json({
      success: true,
      data: result,
      message: `批量改派完成：成功 ${result.successCount} 件，失败 ${result.failCount} 件`,
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
    const history = await CaseService.getReassignmentHistory(req.query as any);
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
    const board = await CaseService.getJudgeWorkloadBoard(req.query as any);
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
