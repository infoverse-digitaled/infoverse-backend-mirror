import express from 'express';

const startServer = (app: express.Application) => {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

export default startServer;
