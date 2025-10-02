const dotenv = require('dotenv');
dotenv.config();

const nodemailer = require('nodemailer');

async function main() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const authMethod = process.env.SMTP_AUTH_METHOD; // optional

  if (!host || !user || !pass) {
    console.error('Missing SMTP env: SMTP_HOST, SMTP_USER, SMTP_PASS');
    process.exit(1);
  }

  const secure = port === 465;
  const transportOptions = {
    host,
    port,
    secure,
    auth: { user, pass },
  };

  if (!secure) {
    transportOptions.requireTLS = true;
    transportOptions.tls = { minVersion: 'TLSv1.2' };
  }

  if (authMethod) {
    transportOptions.authMethod = authMethod;
  }

  const transporter = nodemailer.createTransport(transportOptions);

  try {
    await transporter.verify();
    console.log('SMTP verify success');
  } catch (err) {
    console.error('SMTP verify failed:', err && err.message ? err.message : err);
    process.exit(2);
  }

  try {
    const info = await transporter.sendMail({
      from: `Xwawa Lottery <${user}>`,
      to: user,
      subject: 'SMTP Test: Xwawa Lottery',
      text: 'This is a test email to verify SMTP settings.',
    });
    console.log('SMTP test email sent:', info && info.messageId ? info.messageId : info);
  } catch (err) {
    console.error('SMTP sendMail failed:', err && err.message ? err.message : err);
    process.exit(3);
  }
}

main();