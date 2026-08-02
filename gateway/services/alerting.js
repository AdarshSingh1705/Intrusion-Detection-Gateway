const Alert = require('../models/Alert');

let brevo = null;
if (process.env.BREVO_API_KEY) {
  const { BrevoClient } = require('@getbrevo/brevo');
  brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });
}

async function sendAlert(tenantId, event) {
  // Always write an Alert doc referencing the triggering event
  await Alert.create({
    tenantId,
    eventId: event._id,
    channel: process.env.BREVO_API_KEY ? 'email' : 'dashboard',
  }).catch((err) => console.error('Alert doc write failed', err.message));

  // Only send email if Brevo is configured
  if (!brevo || !process.env.ADMIN_ALERT_EMAIL) return;

  try {
    await brevo.transactionalEmails.sendTransacEmail({
      subject: `[Gateway Alert] ${event.ruleTriggered} — ${event.severity}`,
      textContent: `Verdict: ${event.verdict}\nRule: ${event.ruleTriggered}\nIP: ${event.ip}\nTime: ${new Date().toISOString()}`,
      sender: { name: 'Gateway Alerts', email: process.env.ALERT_SENDER_EMAIL },
      to: [{ email: process.env.ADMIN_ALERT_EMAIL }],
    });
  } catch (err) {
    console.error('Alert email failed', err.message);
  }
}

module.exports = { sendAlert };
