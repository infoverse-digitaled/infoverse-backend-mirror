import { Router, Request, Response } from 'express';
import Subscriber from '../models/Subscriber';
import ContactMessage from '../models/ContactMessage';
import { successResponse } from '../middleware/response';

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
      return successResponse(res, { email: existing.email }, 'Successfully resubscribed to newsletter', 200);
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
      201
    );
  } catch (error: any) {
    console.error('Contact Error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

export default router;
