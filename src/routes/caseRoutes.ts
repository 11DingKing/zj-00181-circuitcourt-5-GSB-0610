import express from "express";
import {
  registerCase,
  getCaseList,
  getCaseDetail,
  transitionCaseStage,
  checkCaseStatus,
  getJudgeWorkload,
  reassignOverloadedCases,
  createTransferRecord,
  analyzeWorkload,
  getReassignmentSuggestions,
  executeReassignment,
  batchExecuteReassignment,
  getReassignmentHistory,
  getJudgeWorkloadBoard,
} from "../controllers/caseController";

const router = express.Router();

router.post("/", registerCase);
router.get("/", getCaseList);
router.get("/:id", getCaseDetail);
router.put("/:id/transition", transitionCaseStage);
router.post("/check-status", checkCaseStatus);
router.get("/workload/judges", getJudgeWorkload);
router.post("/workload/reassign", reassignOverloadedCases);
router.post("/transfer", createTransferRecord);

router.get("/workload/analyze", analyzeWorkload);
router.get("/workload/suggestions", getReassignmentSuggestions);
router.post("/workload/reassign-execute", executeReassignment);
router.post("/workload/reassign-batch", batchExecuteReassignment);
router.get("/workload/reassignment-history", getReassignmentHistory);
router.get("/workload/board", getJudgeWorkloadBoard);

export default router;
