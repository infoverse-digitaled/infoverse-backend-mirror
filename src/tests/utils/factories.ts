import { faker } from '@faker-js/faker';
import User from '../../models/User';
import OakEnrollment from '../../models/OakEnrollment';
import Progress from '../../models/Progress';
import { IUser, IOakEnrollment, IProgress } from '../../models/types';

// Password hash for a test user. The actual password is 'password123'
const testPasswordHash = '$2b$10$Vp2o5z5X/h.4hW5qS3E5lO9l3Y.Z0gZkXwZ5qS3E5lO9l3Y.Z0gZk';

/**
 * Creates and saves a test User to the database.
 * @param {Partial<IUser>} overrides - Optional override values for the user.
 * @returns {Promise<IUser>} A promise that resolves to the created Mongoose User document.
 */
export const createTestUser = async (overrides: Partial<IUser> = {}): Promise<IUser> => {
  const defaultUser = {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    passwordHash: testPasswordHash,
    role: 'student',
    keyStage: 'ks3',
    ...overrides,
  };
  const user = new User(defaultUser);
  await user.save();
  return user;
};

/**
 * Creates and saves a test OakEnrollment to the database.
 * If a user is not provided, a new test user will be created automatically.
 * @param {IUser} [user] - Optional user to associate with the enrollment.
 * @param {Partial<IOakEnrollment>} [overrides] - Optional override values for the enrollment.
 * @returns {Promise<{user: IUser, enrollment: IOakEnrollment}>} A promise that resolves to an object containing the user and the created Mongoose OakEnrollment document.
 */
export const createTestOakEnrollment = async (
  user?: IUser,
  overrides: Partial<IOakEnrollment> = {},
): Promise<{ user: IUser; enrollment: IOakEnrollment }> => {
  const finalUser = user || (await createTestUser());

  const defaultEnrollment = {
    userId: finalUser._id,
    keyStage: finalUser.keyStage,
    subjectSlug: `maths-${faker.lorem.word()}`,
    status: 'active',
    ...overrides,
  };

  const enrollment = new OakEnrollment(defaultEnrollment);
  await enrollment.save();

  return { user: finalUser, enrollment };
};

/**
 * Creates and saves a test Progress record to the database.
 * If an enrollment is not provided, a new test enrollment (and user) will be created automatically.
 * @param {IOakEnrollment} [enrollment] - Optional enrollment to associate with the progress.
 * @param {IUser} [user] - Optional user to associate with the progress.
 * @param {Partial<IProgress>} [overrides] - Optional override values for the progress record.
 * @returns {Promise<{user: IUser, enrollment: IOakEnrollment, progress: IProgress}>} A promise that resolves to an object containing the user, enrollment, and the created Mongoose Progress document.
 */
export const createTestProgress = async (
  enrollment?: IOakEnrollment,
  user?: IUser,
  overrides: Partial<IProgress> = {},
): Promise<{ user: IUser; enrollment: IOakEnrollment; progress: IProgress }> => {
  let finalUser: IUser;
  let finalEnrollment: IOakEnrollment;

  if (enrollment) {
    finalEnrollment = enrollment;
    // If we have an enrollment, we must have a user.
    // We need to fetch the user if only enrollment is passed.
    finalUser = user || (await User.findById(finalEnrollment.userId))!;
  } else {
    const { user: new_user, enrollment: new_enrollment } = await createTestOakEnrollment(user);
    finalUser = new_user;
    finalEnrollment = new_enrollment;
  }

  const defaultProgress = {
    enrollmentId: finalEnrollment._id,
    userId: finalUser._id,
    unitSlug: `unit-${faker.lorem.slug()}`,
    lessonSlug: `lesson-${faker.lorem.slug()}`,
    status: 'started',
    ...overrides,
  };

  const progress = new Progress(defaultProgress);
  await progress.save();

  return { user: finalUser, enrollment: finalEnrollment, progress };
};
