import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import crypto from 'crypto';
import User from '../models/User';
import LicenseBatch from '../models/LicenseBatch';
import { HttpError } from '../utils/httpError';
import config from '../config';
import { successResponse } from '../middleware/response';
import { emailQueue } from '../utils/emailQueue';
import { isTrialExpired, getSubscriptionTier } from '../utils/subscriptionUtils';

// Extend Request to include user info from auth middleware
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    subscription?: {
      plan: 'free' | 'premium';
      status: 'free' | 'active' | 'inactive' | 'cancelled' | 'trialing' | 'past_due';
      expiresAt?: Date;
      trialEndsAt?: Date;
    };
  };
}

/**
 * Handles user registration.
 * If user already exists, verifies password and logs them in (unified auth flow).
 * Supports B2B school licensing via optional licenseKey parameter.
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, licenseKey } = req.body;

    // Check if a user with the same email already exists.
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // User exists - check if OAuth user (no password)
      if (!existingUser.passwordHash) {
        throw new HttpError(401, 'OAUTH_USER', 'This account uses Google sign-in. Please continue with Google.');
      }
      
      throw new HttpError(400, 'USER_EXISTS', 'A user with this email already exists. Please log in instead.');
    }

    // Hash the user's password with a salt round of 10 for security.
    const passwordHash = await bcrypt.hash(password, 10);

    // Default subscription (14-day trial)
    let subscriptionData: {
      status: 'free' | 'active' | 'inactive' | 'cancelled' | 'trialing' | 'past_due';
      plan: 'free' | 'premium';
      trialEndsAt?: Date;
    } = {
      status: 'trialing',
      plan: 'premium',
      trialEndsAt: new Date(Date.now() + config.payment.trialDays * 24 * 60 * 60 * 1000), // Configurable trial period
    };

    let userLicenseKey: string | undefined;
    let organizationName: string | undefined;

    // Handle B2B license registration
    if (licenseKey) {
      // Normalize: remove dashes, spaces, and make uppercase
      const normalizedKey = licenseKey.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      
      // 1. Try to find an official LicenseBatch
      let license = await LicenseBatch.findOne({
        licenseKey: { $regex: new RegExp(`^${normalizedKey.split('').join('[- ]*')}$`, 'i') }
      });

      if (license) {
        // Validation for official batches
        if (!license.isActive) {
          throw new HttpError(400, 'LICENSE_INACTIVE', 'This license is no longer active.');
        }

        if (new Date(license.expiryDate) <= new Date()) {
          throw new HttpError(400, 'LICENSE_EXPIRED', 'This license has expired.');
        }

        if (license.enrolledCount >= license.maxUsers) {
          throw new HttpError(400, 'LICENSE_FULL', 'This license has reached its maximum user limit.');
        }

        // Increment count
        license.enrolledCount += 1;
        await license.save();
        
        userLicenseKey = license.licenseKey;
        organizationName = license.schoolName;
      } else {
        // 2. Fallback: Check if a School Admin has this code (for trials/unpurchased tiers)
        // Note: Students are often the first to join a trial begun by an admin
        const schoolAdmin = await User.findOne({
          role: 'schooladmin',
          schoolCode: { $regex: new RegExp(`^${normalizedKey.split('').join('[- ]*')}$`, 'i') }
        });

        if (!schoolAdmin) {
          throw new HttpError(400, 'INVALID_LICENSE', 'Invalid license code.');
        }

        // Check if the school admin's account is actually in good standing
        const adminSubscription = schoolAdmin.subscription?.status;
        const isAdminActive = adminSubscription === 'active' || 
                             (adminSubscription === 'trialing' && schoolAdmin.subscription?.trialEndsAt && new Date(schoolAdmin.subscription.trialEndsAt) > new Date());

        if (!isAdminActive) {
          throw new HttpError(400, 'LICENSE_INACTIVE', 'The school associated with this code does not have an active subscription.');
        }

        userLicenseKey = schoolAdmin.schoolCode;
        organizationName = schoolAdmin.schoolName || schoolAdmin.organizationName;
      }

      // Set premium subscription without trial (bypasses payment)
      subscriptionData = {
        status: 'active',
        plan: 'premium',
      };
    }

    // Create the new user in the database
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      subscription: subscriptionData,
      licenseKey: userLicenseKey, // For student/B2B access logic
      schoolCode: userLicenseKey, // Also save to schoolCode for compatibility
      organizationName,
    });

    // Create a JSON Web Token for the new user for auto-login
    const secret = new TextEncoder().encode(config.jwt.secret);
    const token = await new SignJWT({ userId: String(newUser._id), role: newUser.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(config.jwt.expiresIn)
      .sign(secret);

    // Set the JWT as a secure, HTTP-only cookie.
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds.
    });

    // Include a flag to indicate if payment should be skipped
    const responseData = {
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        subscription: newUser.subscription,
      },
      token,
      skipPayment: !!licenseKey, // Frontend uses this to redirect directly to dashboard
    };

    successResponse(res, responseData, 'User registered successfully', 201);
  } catch (err) {
    // Forward the error to the global error handler middleware.
    next(err);
  }
};

/**
 * Handles user login and generates a secure JWT.
 * If user doesn't exist, auto-creates account with the provided credentials.
 * This provides a unified auth experience.
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;

    // Find the user by their email.
    let user = await User.findOne({ email });

    if (!user) {
      // User doesn't exist - auto-create account
      const passwordHash = await bcrypt.hash(password, 10);
      const defaultName = name || email.split('@')[0]; // Use provided name or email prefix

      user = await User.create({
        name: defaultName,
        email,
        passwordHash,
        subscription: {
          status: 'trialing',
          plan: 'premium',
          trialEndsAt: new Date(Date.now() + config.payment.trialDays * 24 * 60 * 60 * 1000), // Configurable trial period
        },
      });

      console.log(`[Auth] Auto-created account for: ${email}`);
    } else {
      // User exists - verify password
      // Check if user signed up with OAuth (no password)
      if (!user.passwordHash) {
        throw new HttpError(401, 'OAUTH_USER', 'This account uses Google sign-in. Please continue with Google.');
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
      }
    }

    // Create a JSON Web Token with the user's ID and role, expiring in 7 days.
    const secret = new TextEncoder().encode(config.jwt.secret);
    const token = await new SignJWT({ userId: String(user._id), role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(config.jwt.expiresIn)
      .sign(secret);

    // Set the JWT as a secure, HTTP-only cookie.
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds.
    });

    const data = {
      token,
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        subscription: user.subscription,
        schoolCode: user.schoolCode,
        schoolName: user.schoolName,
        licenseKey: user.licenseKey,
        keyStage: user.keyStage
      },
    };
    successResponse(res, data, 'Login successful');
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Get user based on posted email
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return successResponse(
        res,
        null,
        'If a user with that email exists, a password reset token has been sent.',
      );
    }

    // 2. Generate the random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 3. Hash the token and save it to the user's document
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // Token expires in 10 minutes
    await user.save();

    // 4. Send the token to the user's email
    try {
      const resetURL = `${config.frontendUrl}/reset-password/${resetToken}`;
      const message = `Forgot your password? Click the link to reset it: ${resetURL}\n\nIf you didn't forget your password, please ignore this email. This link is valid for 10 minutes.`;

      // Add email job to the queue
      await emailQueue.add('sendEmail', {
        name: user.name,
        email: user.email,
        subject: 'Your Password Reset Token',
        text: message,
      });

      successResponse(
        res,
        null,
        'If a user with that email exists, a password reset token has been sent.',
      );

    } catch (err) {
      // If email fails, clear the token from the database
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return next(
        new HttpError(
          500,
          'EMAIL_SENDING_ERROR',
          'There was an error sending the email. Please try again later.',
        ),
      );
    }

  } catch (error) {
    next(new HttpError(500, 'INTERNAL_SERVER_ERROR', 'An unexpected error occurred.'));
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Get user based on the token from the URL
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }, // Check if the token is not expired
    });
    // 2. If token is invalid or expired, return an error
    if (!user) {
      return next(new HttpError(400, 'INVALID_TOKEN', 'Token is invalid or has expired.'));
    }

    // 3. Check if a new password is provided
    if (!req.body.password) {
      return next(new HttpError(400, 'MISSING_PASSWORD', 'Please provide a new password.'));
    }

    // 4. Hash the new password and update the user document
    user.passwordHash = await bcrypt.hash(req.body.password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();


    // 5. Log the user in by sending a new JWT
    const secret = new TextEncoder().encode(config.jwt.secret);
    const token = await new SignJWT({ userId: String(user._id), role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(config.jwt.expiresIn)
      .sign(secret);

    successResponse(res, { token }, 'Password has been reset successfully.');

  } catch (error) {
    next(
      new HttpError(
        500,
        'INTERNAL_SERVER_ERROR',
        'Something went wrong while resetting the password.',
      ),
    );
  }
};

/**
 * Get current authenticated user's information
 * Also checks and updates expired trial status automatically.
 */
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new HttpError(401, 'UNAUTHORIZED', 'User not authenticated.');
    }

    // Find user and exclude password hash
    const user = await User.findById(userId).select('-passwordHash');

    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    // 1. Check if trial has expired and update status if needed
    if (user.subscription?.status === 'trialing' && user.subscription.trialEndsAt) {
      if (new Date(user.subscription.trialEndsAt) <= new Date()) {
        user.subscription.status = 'free';
        user.subscription.plan = 'free';
        await user.save();
      }
    }

    // 2. Check if school license has expired (Dynamic check)
    if (user.subscription?.status === 'active' && user.licenseKey) {
      const license = await LicenseBatch.findOne({ licenseKey: user.licenseKey });
      
      const isExpired = !license || !license.isActive || new Date(license.expiryDate) <= new Date();
      
      if (isExpired) {
        // Downgrade user because school access is no longer valid
        user.subscription.status = 'free';
        user.subscription.plan = 'free';
        await user.save();
        console.log(`[Auth] User ${user.email} downgraded due to expired school license: ${user.licenseKey}`);
      }
    }

    successResponse(res, user, 'User retrieved successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Complete user onboarding by saving role preference and key stage.
 * PATCH /api/v1/auth/onboarding
 */
export const completeOnboarding = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest;

    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'User not authenticated.');
    }

    const { role, keyStage } = req.body;

    // Validate role
    const validRoles = ['student', 'instructor'];
    if (role && !validRoles.includes(role)) {
      throw new HttpError(400, 'INVALID_ROLE', 'Role must be either "student" or "instructor".');
    }

    // Validate keyStage
    const validKeyStages = ['ks1', 'ks2', 'ks3', 'ks4'];
    if (keyStage && !validKeyStages.includes(keyStage)) {
      throw new HttpError(400, 'INVALID_KEY_STAGE', 'Key stage must be one of: ks1, ks2, ks3, ks4.');
    }

    // Update user with onboarding data
    const updateData: { role?: string; keyStage?: string } = {};
    if (role) updateData.role = role;
    if (keyStage) updateData.keyStage = keyStage;

    const updatedUser = await User.findByIdAndUpdate(
      user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    successResponse(res, updatedUser, 'Onboarding completed successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Update user profile (name)
 * PATCH /api/v1/auth/profile
 */
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest;

    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'User not authenticated.');
    }

    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new HttpError(400, 'INVALID_NAME', 'Name must be at least 2 characters long.');
    }

    const updatedUser = await User.findByIdAndUpdate(
      user.id,
      { $set: { name: name.trim() } },
      { new: true, runValidators: true }
    ).select('-passwordHash');

    if (!updatedUser) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    successResponse(res, updatedUser, 'Profile updated successfully');
  } catch (err) {
    next(err);
  }
};

/**
 * Change user password
 * PATCH /api/v1/auth/change-password
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { user } = req as AuthenticatedRequest;

    if (!user) {
      throw new HttpError(401, 'UNAUTHORIZED', 'User not authenticated.');
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new HttpError(400, 'MISSING_FIELDS', 'Current password and new password are required.');
    }

    // Get user with password hash
    const userDoc = await User.findById(user.id);
    if (!userDoc) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    // Check if OAuth user (no password to change)
    if (!userDoc.passwordHash) {
      throw new HttpError(400, 'OAUTH_USER', 'Cannot change password for Google sign-in accounts.');
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, userDoc.passwordHash);
    if (!isMatch) {
      throw new HttpError(401, 'INVALID_PASSWORD', 'Current password is incorrect.');
    }

    // Hash and save new password
    userDoc.passwordHash = await bcrypt.hash(newPassword, 10);
    await userDoc.save();

    successResponse(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
};
