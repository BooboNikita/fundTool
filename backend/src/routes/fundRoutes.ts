import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  searchFund,
  getAllFunds,
  addFund,
  updateFundFlags,
  removeFund,
  getPortfolio,
  getPortfolioEstimation,
  getFundEstimation
} from '../controllers/fundController';

const router = Router();

router.use(authMiddleware);

router.get('/search', searchFund);
router.get('/all', getAllFunds);
router.post('/add', addFund);
router.patch('/:code/flags', updateFundFlags);
router.delete('/:code', removeFund);
router.get('/portfolio', getPortfolio);
router.get('/portfolio/estimation', getPortfolioEstimation);
router.get('/estimation/:code', getFundEstimation);

export default router;
