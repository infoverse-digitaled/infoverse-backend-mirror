import { Worker } from 'bullmq';

// This is a placeholder for your actual email sending logic (e.g., using Nodemailer)
const sendConfirmationEmail = async (email: string, name: string) => {
  console.log(`WORKER: Sending confirmation email to ${name} at ${email}...`);
  // Simulate a network delay for sending the email
  await new Promise(resolve => setTimeout(resolve, 3000)); 
  console.log(`WORKER: Email sent to ${email}!`);
};

const redisConnection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
};

console.log('Email worker process started. Waiting for jobs...');

new Worker('email-sending', async (job) => {
  const { email, name } = job.data;
  console.log(`WORKER: Processing job ${job.id} for user ${email}`);
  await sendConfirmationEmail(email, name);
}, { connection: redisConnection });