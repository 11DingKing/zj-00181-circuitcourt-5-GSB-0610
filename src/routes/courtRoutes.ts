import express from 'express';
import {
  getAllCourts,
  getCourtByCode,
  getCourtCoverage,
  matchJurisdiction,
  createCourt,
  updateCourt
} from '../controllers/courtController';

const router = express.Router();

router.get('/', getAllCourts);
router.get('/code/:code', getCourtByCode);
router.get('/coverage', getCourtCoverage);
router.post('/match', matchJurisdiction);
router.post('/', createCourt);
router.put('/:id', updateCourt);

export default router;
