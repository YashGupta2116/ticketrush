import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes';
import { venuesRouter } from './modules/venues/venues.routes';
import { eventsRouter } from './modules/events/events.routes';
import { showsRouter } from './modules/shows/shows.routes';

export const apiRouter = Router();
// Feature routers get mounted here, e.g. apiRouter.use('/auth', authRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/venues', venuesRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/shows', showsRouter);
