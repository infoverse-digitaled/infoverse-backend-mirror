import { Worker } from 'bullmq';
import config from './config';

// Generic email sending function
const sendEmail = async (to: string, subject: string, text: string) => {
  console.log(`WORKER: Sending email to ${to}...`);
  console.log(`WORKER: Subject: ${subject}`);
  console.log(`WORKER: Body: ${text}`);
  // Simulate a network delay for sending the email
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log(`WORKER: Email sent to ${to}!`);
};

// Specific function for sending a password reset email
const sendPasswordResetEmail = async (job: any) => {
  const { email, name, subject, text } = job.data;
  console.log(`WORKER: Processing password reset for ${name} at ${email}`);
  await sendEmail(email, subject, text);
};

// Specific function for sending a bug report notification email
const sendBugReportEmail = async (job: any) => {
  const { type, message, rating, email, userId, page } = job.data;
  const subject = `[Bug Report] New ${type} report received`;
  const text = `A new ${type} report has been submitted.

Type: ${type}
Message: ${message}
Rating: ${rating || 'Not provided'}
User Email: ${email}
User ID: ${userId}
Page: ${page}

---
Submitted via Infoverse Bug Report System`;
  console.log(`WORKER: Processing bug report notification`);
  await sendEmail('support@infoversedigitaleducation.net', subject, text);
};

// Specific function for sending an enrollment confirmation email
const sendEnrollmentConfirmationEmail = async (job: any) => {
  const { email, name, courseTitle } = job.data;
  const subject = `Confirmation of enrollment in ${courseTitle}`;
  const text = `Hi ${name},

You have successfully enrolled in the course: ${courseTitle}.

We are excited to have you!

Best regards,
The Infoverse Team`;
  console.log(`WORKER: Processing enrollment confirmation for ${name} at ${email}`);
  await sendEmail(email, subject, text);
};

console.log('Email worker process started. Waiting for jobs...');

new Worker(
  'email-sending',
  async (job) => {
    console.log(`WORKER: Processing job ${job.id} with name ${job.name}`);
    switch (job.name) {
      case 'sendEmail':
        await sendPasswordResetEmail(job);
        break;
      case 'send-enrollment-confirmation':
        await sendEnrollmentConfirmationEmail(job);
        break;
      case 'send-bug-report':
        await sendBugReportEmail(job);
        break;
      default:
        console.error(`WORKER: Unknown job name: ${job.name}`);
    }
  },
  { connection: config.redis.url as any },
);