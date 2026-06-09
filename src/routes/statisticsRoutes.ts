import express from 'express';
import {
  getOverallStatistics,
  getCourtStatistics,
  getCaseTypeDistribution,
  getComplexityDistribution,
  getTrialDurationTrend
} from '../controllers/statisticsController';

const router = express.Router();

router.get('/overall', getOverallStatistics);
router.get('/court/:courtId', getCourtStatistics);
router.get('/case-type-distribution', getCaseTypeDistribution);
router.get('/complexity-distribution', getComplexityDistribution);
router.get('/trial-duration-trend', getTrialDurationTrend);

export default router;
