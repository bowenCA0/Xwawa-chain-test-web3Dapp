const nodemailer = require('nodemailer');
const path = require('path');
const MailComposer = require('nodemailer/lib/mail-composer');
let ImapFlow; // 延迟加载以避免缺依赖时报错

// Create a reusable transporter using SMTP settings from environment variables
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const authMethod = process.env.SMTP_AUTH_METHOD; // e.g., 'LOGIN' or 'PLAIN'

  if (!host || !user || !pass) {
    throw new Error('SMTP configuration missing: ensure SMTP_HOST, SMTP_USER, SMTP_PASS are set');
  }

  const secure = port === 465;

  const transportOptions = {
    host,
    port,
    secure,
    auth: { user, pass },
  };

  // For STARTTLS on port 587, explicitly require TLS
  if (!secure) {
    transportOptions.requireTLS = true;
    transportOptions.tls = {
      minVersion: 'TLSv1.2',
      // You can relax verification in development if needed, but prefer true in production
      // rejectUnauthorized: false,
    };
  }

  if (authMethod) {
    transportOptions.authMethod = authMethod; // provider-specific override
  }

  return nodemailer.createTransport(transportOptions);
}

// Build base HTML email template
// NOTE: Keep structure simple for compatibility across clients.
// You can modify styles and copy as needed later.
function buildEmailHTML({ walletAddress, txHash, prizeName }) {
  const safeWallet = walletAddress || 'N/A';
  const safeTx = txHash || 'N/A';
  const safePrize = prizeName || 'Prize';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Xwawa Marketing — Prize Confirmation</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; color: #333; background-color: #f9f9f9; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .header { background-color: #f4f6f8; text-align: center; padding: 0; }
    .header img { width: 100%; display: block; height: auto; object-fit: cover; }
    .content { padding: 24px; }
    .title { font-size: 22px; font-weight: 600; color: #1a237e; margin-bottom: 16px; text-align: center; }
    .card { border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin-bottom: 20px; background: #fafafa; }
    .label { font-weight: bold; margin-top: 12px; color: #111; }
    .footer { font-size: 12px; color: #555; background: #f4f6f8; padding: 16px 24px; border-top: 1px solid #e0e0e0; }
    .footer p { margin: 6px 0; }
    a { color: #1a73e8; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Logo -->
    <div class="header">
      <img src="cid:headerLogo" alt="Xwawa Logo" />
    </div>
    <div class="content">
      <div class="title">Xwawa Lottery — Prize Confirmation</div>
      <div class="card">
        <p>Dear Participant,</p>
        <p>Thank you for providing your email address. We have successfully recorded your prize details as follows:</p>
        
        <p class="label">Prize:</p>
        <p>${safePrize}</p>
        
        <p class="label">Wallet Address:</p>
        <p>${safeWallet}</p>
        
        <p class="label">Transaction Hash:</p>
        <p>
          ${safeTx !== 'N/A' ? `<a href="https://okx.com/okbc/explorer/tx/${safeTx}" target="_blank" rel="noopener noreferrer">${safeTx}</a>` : 'N/A'}
        </p>

        <p>
          To proceed with prize delivery, please reply to this email with your full shipping address in the following format, or send it to
          <a href="mailto:market@xwawa.meme">market@xwawa.meme</a>:
        </p>
        <p class="label">Required format:</p>
        <p>
          Country, State/Province/City, Street Address (house/building, floor, unit), Postal Code
        </p>
      </div>

      <p>Best regards,</p>
      <p><strong>Xwawa Marketing Department</strong></p>
    </div>
    
    <!-- Footer -->
    <div class="footer">
      <p><strong>Contact Information</strong></p>
      <p>Marketing Department: <a href="mailto:market@xwawa.meme">market@xwawa.meme</a></p>
      <p>Customer Support: <a href="mailto:support@email.xwawa.meme">support@email.xwawa.meme</a></p>
      <p>Consultation & Feedback: <a href="mailto:help@email.xwawa.meme">help@email.xwawa.meme</a></p>
      <p>Development & Technical Department: <a href="mailto:dev@email.xwawa.meme">dev@email.xwawa.meme</a></p>
    </div>
  </div>
</body>
</html>`;
}


async function sendPrizeEmail({ to, walletAddress, txHash, prizeName }) {
  const transporter = createTransporter();
  const html = buildEmailHTML({ walletAddress, txHash, prizeName });

  const fromName = 'Xwawa Marketing';
  const fromAddress = process.env.SMTP_USER;
  const subject = 'Your Xwawa Lottery Prize Confirmation';

  // 判断是否配置了 IMAP，用于保存到“已发送”
  const imapConfig = getImapConfig();
  const hasImap = !!imapConfig;

  // 如果未配置 IMAP，则在首次发送时给自己隐抄一份
  const bccSelf = hasImap ? undefined : fromAddress;

  // 先构建原始邮件（用于 IMAP 追加）
  const attachments = [
    {
      filename: 'Email.png',
      path: path.resolve(__dirname, '..', 'images', 'Email.png'),
      cid: 'headerLogo',
    },
  ];

  const composer = new MailComposer({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    html,
    attachments,
  });
  const raw = await composer.compile().build();

  // 发送邮件
  const info = await transporter.sendMail({
    from: `${fromName} <${fromAddress}>`,
    to,
    subject,
    html,
    attachments,
    bcc: bccSelf,
  });

  // 若配置了 IMAP，尽力将原始邮件追加到“已发送”
  if (hasImap && raw) {
    try {
      await appendToSentRaw({ raw, imapConfig });
      console.log('邮件已追加到 IMAP 的“已发送”文件夹');
    } catch (e) {
      console.warn('追加到“已发送”失败，改为自抄送：', e && e.message ? e.message : e);
      try {
        await transporter.sendMail({
          from: `${fromName} <${fromAddress}>`,
          to: fromAddress, // 自抄送到自己的收件箱
          subject: `[Copy] ${subject}`,
          html,
        });
      } catch (fallbackErr) {
        console.warn('自抄送备份亦失败：', fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr);
      }
    }
  }

  return info;
}

function getImapConfig() {
  // 若未提供 IMAP 主机或认证信息，则认为未配置
  const host = process.env.IMAP_HOST; // 例如 imap.secureserver.net
  const port = parseInt(process.env.IMAP_PORT || '993', 10);
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  const secure = String(process.env.IMAP_SECURE || 'true').toLowerCase() !== 'false';
  const sentFolder = process.env.IMAP_SENT_FOLDER || 'Sent'; // 有些服务是 "Sent Items"

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port, secure, auth: { user, pass }, sentFolder };
}

async function appendToSentRaw({ raw, imapConfig }) {
  if (!ImapFlow) {
    try {
      ImapFlow = require('imapflow').ImapFlow;
    } catch (e) {
      throw new Error('未安装 imapflow 依赖，无法追加到“已发送”');
    }
  }

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: imapConfig.secure,
    auth: imapConfig.auth,
    logger: false,
  });

  await client.connect();
  try {
    const mailbox = imapConfig.sentFolder;
    await client.append(mailbox, raw, ['\\Seen']);
  } finally {
    await client.logout();
  }
}

module.exports = {
  sendPrizeEmail,
};