import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User';
import { HttpError } from '../utils/httpError';
import config from '../config';
import { successResponse } from '../middleware/response';
import { emailQueue } from '../utils/emailQueue';

/**
 * Handles user registration.
 * It hashes the password, checks for existing users, and creates a new user document.
 */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if a user with the same email already exists.
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Use a custom HttpError to handle the response uniformly.
      throw new HttpError(400, 'EMAIL_EXISTS', 'Email already in use');
    }
    
    // Hash the user's password with a salt round of 10 for security.
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create the new user in the database.
    const newUser = await User.create({ name, email, passwordHash });

    successResponse(res, newUser, 'User registered successfully', 201);
  } catch (err) {
    // Forward the error to the global error handler middleware.
    next(err);
  }
};

/**
 * Handles user login and generates a secure JWT.
 * It compares the provided password with the stored hash and sets the JWT in a secure cookie.
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    
    // Validate that both email and password were provided in the request body.
    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required.', 'BAD_REQUEST');
    }

    // Find the user by their email.
    const user = await User.findOne({ email });
    if (!user) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    // Compare the provided password with the stored password hash.
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }
    
    // Create a JSON Web Token with the user's ID and role, expiring in 7 days.
    const options: SignOptions = {
      expiresIn: config.jwt.expiresIn as any,
    };
    const token = jwt.sign({ userId: user._id, role: user.role }, config.jwt.secret, options);

    // Set the JWT as a secure, HTTP-only cookie.
    // The `httpOnly` flag prevents client-side scripts from accessing the cookie,
    // and the `secure` flag ensures the cookie is only sent over HTTPS in production.
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict', // Protects against CSRF attacks.
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds.
    });

    const data = {
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    };
    successResponse(res, data, 'Login successful');
  } catch (err) {
    // Forward the error to the global error handler middleware.
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
        'If a user with that email exists, a password reset token has been sent.');
    }

    // 2. Generate the random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 3. Hash the token and save it to the user's document
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000); // Token expires in 10 minutes
    await user.save();

    // 4. Send the token to the user's email
    try {
      const resetURL = `${req.protocol}://${req.get('host')}/api/v1/auth/reset-password/${resetToken}`;
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
          'There was an error sending the email. Please try again later.',
          'EMAIL_SENDING_ERROR',
        ),
      );
    }

  } catch (error) {
    next(new HttpError(500, 'An unexpected error occurred.', 'INTERNAL_SERVER_ERROR'));
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Get user based on the token from the URL
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');
    console.log('hashedtoken now');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }, // Check if the token is not expired
    });
    console.log('founduser');
    // 2. If token is invalid or expired, return an error
    if (!user) {
      return next(new HttpError(400, 'Token is invalid or has expired.', 'INVALID_TOKEN'));
    }

    // 3. Check if a new password is provided
    if (!req.body.password) {
      return next(new HttpError(400, 'Please provide a new password.', 'MISSING_PASSWORD'));
    }

    // 4. Hash the new password and update the user document
    user.passwordHash = await bcrypt.hash(req.body.password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    console.log('new pasasword saved');
    console.log('attempting log in now...');

    // 5. Log the user in by sending a new JWT
    const token = jwt.sign({ userId: user._id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as any,
    });

    successResponse(res, { token }, 'Password has been reset successfully.');

  } catch (error) {
    next(
      new HttpError(
        500,
        'Something went wrong while resetting the password.',
        'INTERNAL_SERVER_ERROR',
      ),
    );
  }
};
