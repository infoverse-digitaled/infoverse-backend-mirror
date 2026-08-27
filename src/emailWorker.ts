import { Worker, Job } from 'bullmq';
import { redisConnection } from './utils/emailQueue';

// TODO(pre-launch): this is a mock - it only logs and never actually sends
// mail. No mail library (nodemailer etc.) is installed anywhere in this
// codebase despite config.mail (SMTP host/user/pass) being fully configured.
// Password reset, enrollment confirmation, and bug-report emails currently
// never reach a real inbox.
const sendEmail = async (to: string, subject: string, text: string) => {
  console.log(`WORKER: Sending email to ${to}...`);
  console.log(`WORKER: Subject: ${subject}`);
  console.log(`WORKER: Body: ${text}`);
  // Simulate a network delay for sending the email
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 3000);
  });
  console.log(`WORKER: Email sent to ${to}!`);
};

// Specific function for sending a password reset email
const sendPasswordResetEmail = async (job: Job) => {
  const { email, name, subject, text } = job.data;
  console.log(`WORKER: Processing password reset for ${name} at ${email}`);
  await sendEmail(email, subject, text);
};

// Specific function for sending a bug report notification email
const sendBugReportEmail = async (job: Job) => {
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
const sendEnrollmentConfirmationEmail = async (job: Job) => {
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

const worker = new Worker(
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
  { connection: redisConnection },
);

worker.on('failed', (job, err) => {
  console.error(`WORKER: Job ${job?.id} (${job?.name}) failed:`, err);
});
