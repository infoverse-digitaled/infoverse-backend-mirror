import { Express } from 'express';
import mainRoutes from './index';

const setRoutes = (app: Express) => {
  app.use('/api', mainRoutes);
};

export default setRoutes;
