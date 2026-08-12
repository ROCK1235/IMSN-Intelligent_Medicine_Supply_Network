export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Sends an email. No provider (SendGrid/SES) is wired up yet — see
 * PROJECT.md's tech stack and PHASES.md Phase 6 — so this currently just
 * logs the message. Swap the body of this function for a real provider
 * call later; every caller (email verification, password reset, ...)
 * already goes through this single function, so nothing else needs to
 * change when that happens.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  console.log(
    `📧 [stub email] to=${message.to} subject="${message.subject}"\n${message.text}`
  );
}
