import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getDingTalkConfig,
  saveDingTalkConfig,
  testDingTalkPush,
  pushFundEstimations
} from '../controllers/dingtalkController';

const router = Router();

router.use(authMiddleware);

router.get('/config', getDingTalkConfig);
router.post('/config', saveDingTalkConfig);
router.post('/test', testDingTalkPush);
router.post('/push', pushFundEstimations);

export default router;
