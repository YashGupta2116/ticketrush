import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';

export const apiRouter = Router();
// Feature routers get mounted here, e.g. apiRouter.use('/auth', authRouter);
apiRouter.use('/auth', authRouter);
