import { Resend } from 'resend';
import { env } from '../config/env';

const isTest = env.NODE_ENV === 'test';
let _resend: Resend | null = null;
function getResend() {
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  if (isTest) return;

  const link = `https://mh-datapedia-web.fly.dev/verify-email?token=${token}`;

  const { error } = await getResend().emails.send({
    from: 'onboarding@resend.dev',
    to,
    subject: 'Verify your MH Datapedia account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0c0a09;color:#fafaf9;border-radius:8px;">
        <h1 style="color:#2f9e8f;font-size:20px;margin-bottom:16px;">MH Datapedia</h1>
        <p style="margin-bottom:24px;">Click the button below to verify your email address. This link expires in 24 hours.</p>
        <a href="${link}" style="display:inline-block;background:#2f9e8f;color:#fafaf9;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Verify Email</a>
        <p style="margin-top:24px;font-size:12px;color:#78716c;">If you didn't create an account, ignore this email.</p>
      </div>
    `,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}
