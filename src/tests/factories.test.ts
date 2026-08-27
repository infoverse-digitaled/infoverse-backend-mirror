import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createTestUser, createTestOakEnrollment, createTestProgress } from './utils/factories';
import User from '../models/User';
import OakEnrollment from '../models/OakEnrollment';
import Progress from '../models/Progress';

let mongoServer: MongoMemoryServer;

// Setup MongoDB in-memory server before all tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}, 180000);

// Tear down MongoDB in-memory server after all tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Clear all test data after each test
afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

describe('Test Data Factories', () => {
  it('should create a test user with default values', async () => {
    const user = await createTestUser();
    expect(user).toBeDefined();
    expect(user.name).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.role).toBe('student');
    expect(user.keyStage).toBe('ks3');

    const dbUser = await User.findById(user._id);
    expect(dbUser).toBeDefined();
  });

  it('should create a test user with overridden values', async () => {
    const user = await createTestUser({
      role: 'instructor',
      keyStage: 'ks4',
    });
    expect(user.role).toBe('instructor');
    expect(user.keyStage).toBe('ks4');
  });

  it('should create a test oak enrollment and a new user', async () => {
    const { user, enrollment } = await createTestOakEnrollment();
    expect(user).toBeDefined();
    expect(enrollment).toBeDefined();
    expect(enrollment.userId).toEqual(user._id);

    const dbEnrollment = await OakEnrollment.findById(enrollment._id);
    expect(dbEnrollment).toBeDefined();
    const dbUser = await User.findById(user._id);
    expect(dbUser).toBeDefined();
  });

  it('should create a test oak enrollment for an existing user', async () => {
    const user = await createTestUser();
    const { enrollment } = await createTestOakEnrollment(user);

    expect(enrollment.userId).toEqual(user._id);
    const enrollmentCount = await OakEnrollment.countDocuments({
      userId: user._id,
    });
    expect(enrollmentCount).toBe(1);
  });

  it('should create test progress, a new enrollment, and a new user', async () => {
    const { user, enrollment, progress } = await createTestProgress();
    expect(user).toBeDefined();
    expect(enrollment).toBeDefined();
    expect(progress).toBeDefined();

    expect(progress.userId).toEqual(user._id);
    expect(progress.enrollmentId).toEqual(enrollment._id);

    const dbProgress = await Progress.findById(progress._id);
    expect(dbProgress).toBeDefined();
  });

  it('should create test progress for an existing enrollment', async () => {
    const { user, enrollment } = await createTestOakEnrollment();
    const { progress } = await createTestProgress(enrollment, user);

    expect(progress.enrollmentId).toEqual(enrollment._id);
    const progressCount = await Progress.countDocuments({
      enrollmentId: enrollment._id,
    });
    expect(progressCount).toBe(1);
  });

  it('Demonstrates how to use factories in a test', async () => {
    // Create an enrollment record. A user is automatically created.
    const { enrollment, user } = await createTestOakEnrollment();

    // Create a progress record for that specific enrollment.
    const { progress } = await createTestProgress(enrollment, user, {
      lessonSlug: 'my-specific-lesson',
      status: 'completed',
    });

    expect(progress.lessonSlug).toBe('my-specific-lesson');
    expect(progress.status).toBe('completed');
    expect(progress.enrollmentId).toEqual(enrollment._id);
    expect(progress.userId).toEqual(user._id);

    // You can now use these linked records in your assertions
    const userProgress = await Progress.find({ userId: user._id });
    expect(userProgress).toHaveLength(1);
  });
});
