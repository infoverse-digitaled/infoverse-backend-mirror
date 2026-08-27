import request from './setup';

// The 'describe' block groups related tests together.
// This test checks the /health endpoint which returns a JSON object.
describe('GET /health', () => {
  // A single test case for the /health endpoint.
  it('should return a 200 status code and a JSON object with status UP', async () => {
    // Make a GET request to the /health endpoint.
    const response = await request.get('/health');

    // Assert that the response status is 200.
    expect(response.status).toBe(200);

    // Assert that the response body is a JSON object.
    expect(response.body).toHaveProperty('status');
    expect(response.body.status).toBe('UP');

    // Also check for the timestamp property.
    expect(response.body).toHaveProperty('timestamp');
  });
});

// A new 'describe' block to group tests for user authentication.
describe('User Authentication Tests', () => {
  // A test case for a successful user registration.
  it('should register a new user successfully', async () => {
    // Generate a unique email for the test to avoid conflicts.
    const uniqueEmail = `testuser${Date.now()}@example.com`;

    // Make a POST request to the registration endpoint with user data.
    const response = await request.post('/api/v1/auth/register').send({
      username: 'Test User',
      email: uniqueEmail,
      password: 'password123',
    });

    // Assert that the registration was successful (201 Created).
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('message', 'User registered successfully');
  });

  // A test case for handling a duplicate email during registration.
  it('should return 409 Conflict if email is already in use', async () => {
    // Use an email that is known to exist from a previous test or setup.
    // For this example, we'll assume a user with 'test@example.com' exists.
    const response = await request.post('/api/v1/auth/register').send({
      username: 'Another User',
      email: 'test@example.com', // This email should already exist.
      password: 'password123',
    });

    // Assert that the server responds with a 409 Conflict status.
    expect(response.status).toBe(409);
    expect(response.body).toHaveProperty('message', 'Email is already in use');
  });

  // A test case for a successful user login.
  it('should login a registered user successfully', async () => {
    // Make a POST request to the login endpoint.
    const response = await request.post('/api/v1/auth/login').send({
      email: 'test@example.com', // Use the same test user's email.
      password: 'password123',
    });

    // Assert that the login was successful (200 OK).
    expect(response.status).toBe(200);

    // Assert that the response body contains a JWT token.
    expect(response.body).toHaveProperty('token');
  });

  // A test case for a failed login with incorrect credentials.
  it('should return 401 Unauthorized for invalid credentials', async () => {
    // Make a POST request with incorrect password.
    const response = await request.post('/api/v1/auth/login').send({
      email: 'test@example.com',
      password: 'wrong-password',
    });

    // Assert that the server responds with a 401 Unauthorized status.
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Invalid credentials');
  });
});
