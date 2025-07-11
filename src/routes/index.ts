import { Express, Request, Response } from "express";
import { helloController } from "../controllers";

const setRoutes = (app: Express) => {
  app.get("/", helloController);
};

export default setRoutes;
