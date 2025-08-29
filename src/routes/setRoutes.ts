import { Express } from 'express';
import mainRoutes from './index';

const setRoutes = (app: Express) => {
  app.use('/api/v1', mainRoutes);
};

export default setRoutes;
