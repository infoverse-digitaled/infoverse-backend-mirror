import supertest from 'supertest';
import app from '../app';

// Create a supertest agent to use for making requests.
const request = supertest(app);

// Export the 'request' object so it can be used in other test files.
export default request;
