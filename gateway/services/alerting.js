const Alert = require('../models/Alert');

let brevo = null;

function getBrevo() {
  if (brevo) return brevo;
  if (!process.env.BREVO_API_KEY) return null;
  try {
    const { TransactionalEmailsApi, SendSmtpEmail } = require('@getbrevo/brevo');
    const instance = new TransactionalEmailsApi();
    instance.authentications['apiKey'].apiKey = process.env.BREVO_API_KEY;
    brevo = { instance, SendSmtpEmail };
  } catch (err) {
    console.error('Brevo init failed', err.message);
  }
  return brevo;
}

async function _sendEmail(to, subject, textContent) {
  const client = getBrevo();
  if (!client || !process.env.ALERT_SENDER_EMAIL) return;
  try {
    const email = new client.SendSmtpEmail();
    email.subject = subject;
    email.textContent = textContent;
    email.sender = { name: 'Gateway Security', email: process.env.ALERT_SENDER_EMAIL };
    email.to = [{ email: to }];
    await client.instance.sendTransacEmail(email);
  } catch (err) {
    console.error('Brevo send failed', err.message);
  }
}

async function sendAlert(tenantId, event) {
  await Alert.create({
    tenantId,
    eventId: event._id,
    channel: process.env.BREVO_API_KEY ? 'email' : 'dashboard',
  }).catch((err) => console.error('Alert doc write failed', err.message));

  if (!process.env.ADMIN_ALERT_EMAIL) return;
  await _sendEmail(
    process.env.ADMIN_ALERT_EMAIL,
    `[Gateway Alert] ${event.ruleTriggered} — ${event.severity}`,
    `Verdict: ${event.verdict}\nRule: ${event.ruleTriggered}\nIP: ${event.ip}\nTime: ${new Date().toISOString()}`
  );
}

// Notify the affected user directly (account locked, IP blocked, etc.)
async function notifyUser(userEmail, subject, body) {
  if (!userEmail) return;
  await _sendEmail(userEmail, subject, body);
}

module.exports = { sendAlert, notifyUser };
