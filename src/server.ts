import { Application } from 'express';
import config from './config';
import logger from './utils/logger';

const startServer = (app: Application) => {
  const server = app.listen(config.port, () => {
    logger.info(`
      ################################################
      🛡️  Server listening on port: ${config.port} 🛡️
      ################################################
    `);
  });

  // CATCH THE ERROR causing the crash
  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `❌ Port ${config.port} is already in use! Please kill the process running on this port.`,
      );
    } else {
      logger.error('❌ Server error:', err);
    }
    process.exit(1);
  });
};

export default startServer;
