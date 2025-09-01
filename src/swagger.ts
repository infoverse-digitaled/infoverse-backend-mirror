import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import path from 'path';

// Swagger configuration options
const options = {
  definition: {
    openapi: '3.0.0', // Specify the version of the OpenAPI Specification
    info: {
      title: 'Infoverse API', // The title of your API
      version: '1.0.0', // The version of your API
      description: 'API documentation for the Infoverse platform, a comprehensive learning management system.',
    },
    // Define the base path for your API
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Local development server',
      },
    ],
    // Define security schemes, which are referenced in your route files
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    // A list of the API tags used in your JSDoc comments
    tags: [
      {
        name: 'Auth',
        description: 'User authentication and authorization',
      },
      {
        name: 'Courses',
        description: 'Course management',
      },
      {
        name: 'Reviews',
        description: 'Course reviews and ratings',
      },
    ],
  },
  // The path to your API route files, using path.resolve for robustness
  apis: [path.resolve(__dirname, './routes/*.ts')],
};

// Initialize swagger-jsdoc
const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  // Serve the Swagger UI at /api-docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  
  // Expose the raw JSON spec for external tools
  app.get('/swagger.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};
