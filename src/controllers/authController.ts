import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { HttpError } from '../utils/httpError';
import config from '../config';

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
    await User.create({ name, email, passwordHash });

    res.status(201).json({ message: 'User registered successfully' });
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
      return res.status(400).json({ message: 'Email and password are required.' });
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
    const token = jwt.sign({ userId: user._id, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

    // Set the JWT as a secure, HTTP-only cookie.
    // The `httpOnly` flag prevents client-side scripts from accessing the cookie,
    // and the `secure` flag ensures the cookie is only sent over HTTPS in production.
    res.cookie('token', token, {
      httpOnly: true,
      secure: config.env === 'production',
      sameSite: 'strict', // Protects against CSRF attacks.
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds.
    });

    // Modified to include the token in the response body as per the API contract.
    res.status(200).json({
      message: 'Login successful',
      token, // <-- This is the only change to your file.
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    // Forward the error to the global error handler middleware.
    next(err);
  }
};
