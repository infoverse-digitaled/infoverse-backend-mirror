import request from 'supertest';
import app from './app'; 

describe('Course Endpoints', () => {
  it('GET /api/courses → should return 200 and a paginated object', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
  });

  it('POST /api/courses → should return 401 without token', async () => {
    const res = await request(app).post('/api/courses').send({
      title: 'Test Course',
      description: 'Testing 123',
      price: 0,
    });

    expect(res.status).toBe(401);
  });
});
