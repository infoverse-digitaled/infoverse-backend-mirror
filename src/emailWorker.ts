import { Worker } from 'bullmq';
import config from './config';

// This is a placeholder for your actual email sending logic (e.g., using Nodemailer)
const sendConfirmationEmail = async (email: string, name: string) => {
  console.log(`WORKER: Sending confirmation email to ${name} at ${email}...`);
  // Simulate a network delay for sending the email
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log(`WORKER: Email sent to ${email}!`);
};

console.log('Email worker process started. Waiting for jobs...');

new Worker(
  'email-sending',
  async (job) => {
    const { email, name } = job.data;
    console.log(`WORKER: Processing job ${job.id} for user ${email}`);
    await sendConfirmationEmail(email, name);
  },
  { connection: config.redis.url },
);
