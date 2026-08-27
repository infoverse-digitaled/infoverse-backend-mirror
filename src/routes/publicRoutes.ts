import { Router, Request, Response } from 'express';
import Subscriber from '../models/Subscriber';
import ContactMessage from '../models/ContactMessage';
import BugReport from '../models/BugReport';
import { successResponse } from '../middleware/response';
import { bugReportLimiter } from '../middleware/rateLimiter';
import { emailQueue } from '../utils/emailQueue';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Public
 *   description: Public endpoints for newsletter and contact
 */

/**
 * @swagger
 * /api/v1/public/subscribe:
 *   post:
 *     summary: Subscribe to newsletter
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *     responses:
 *       201:
 *         description: Successfully subscribed
 *       400:
 *         description: Invalid email or already subscribed
 */
router.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if already subscribed
    const existing = await Subscriber.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.isActive) {
        return res.status(400).json({ error: 'This email is already subscribed' });
      }
      // Reactivate if previously unsubscribed
      existing.isActive = true;
      await existing.save();
      return successResponse(
        res,
        { email: existing.email },
        'Successfully resubscribed to newsletter',
        200,
      );
    }

    const subscriber = await Subscriber.create({ email: email.toLowerCase() });
    successResponse(res, { email: subscriber.email }, 'Successfully subscribed to newsletter', 201);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'This email is already subscribed' });
    }
    console.error('Subscribe Error:', error);
    res.status(500).json({ error: 'Failed to subscribe. Please try again.' });
  }
});

/**
 * @swagger
 * /api/v1/public/contact:
 *   post:
 *     summary: Submit a contact form message
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - subject
 *               - message
 *             properties:
 *               name:
 *                 type: string
 *                 example: "John Doe"
 *               email:
 *                 type: string
 *                 example: "john@example.com"
 *               subject:
 *                 type: string
 *                 example: "General Inquiry"
 *               message:
 *                 type: string
 *                 example: "I have a question about your services."
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Missing required fields
 */
router.post('/contact', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const contactMessage = await ContactMessage.create({
      name,
      email,
      subject,
      message,
    });

    // TODO: Send email notification to support@infoversedigitaleducation.net
    // This would use a service like SendGrid, Mailgun, or AWS SES

    successResponse(
      res,
      { id: contactMessage._id },
      'Your message has been sent successfully. We will get back to you soon!',
      201,
    );
  } catch (error: any) {
    console.error('Contact Error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

/**
 * @swagger
 * /api/v1/public/bug-report:
 *   post:
 *     summary: Submit a bug report or feedback
 *     tags: [Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - message
 *               - page
 *               - userAgent
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [bug, feature, general, improvement]
 *               message:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               email:
 *                 type: string
 *               userId:
 *                 type: string
 *               page:
 *                 type: string
 *               userAgent:
 *                 type: string
 *               website:
 *                 type: string
 *                 description: Honeypot field - should be empty
 *     responses:
 *       201:
 *         description: Bug report submitted successfully
 *       400:
 *         description: Invalid input or spam detected
 *       429:
 *         description: Too many requests
 */
router.post('/bug-report', bugReportLimiter, async (req: Request, res: Response) => {
  try {
    const { type, message, rating, email, userId, page, userAgent, website } = req.body;

    // Honeypot check - bots will fill this hidden field
    if (website) {
      return res.status(400).json({ error: 'Invalid submission.' });
    }

    if (!type || !message || !page || !userAgent) {
      return res.status(400).json({ error: 'Type, message, page, and userAgent are required.' });
    }

    const validTypes = ['bug', 'feature', 'general', 'improvement'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Type must be bug, feature, general, or improvement.' });
    }

    if (rating !== undefined && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5.' });
    }

    const report = await BugReport.create({
      type,
      message,
      rating,
      email,
      userId,
      page,
      userAgent,
    });

    // Queue email notification
    await emailQueue.add('send-bug-report', {
      type,
      message,
      rating,
      email: email || 'Not provided',
      userId: userId || 'Not provided',
      page,
    });

    successResponse(res, { id: report._id }, 'Bug report submitted successfully', 201);
  } catch (error: any) {
    console.error('Bug Report Error:', error);
    res.status(500).json({ error: 'Failed to submit bug report. Please try again.' });
  }
});

export default router;
