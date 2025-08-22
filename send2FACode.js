// utils/send2FACode.js
const nodemailer = require('nodemailer');

function createTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email service is not configured. Set EMAIL_USER and EMAIL_PASS in environment.');
  }
  return process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: String(process.env.SMTP_SECURE || 'false') === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      })
    : nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
}

const send2FACode = async (email, code, subject = 'Your 2FA Code') => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email service is not configured. Set EMAIL_USER and EMAIL_PASS in environment.');
  }
  const transporter = createTransporter();

  // Define email options
  const mailOptions = {
    from: process.env.EMAIL_USER, // Sender address
    to: email, // Recipient address
    subject,
    html: `<div style="font-family:Arial,sans-serif"><h2>${subject}</h2><p>Your code is:</p><div style="font-size:32px;font-weight:bold;letter-spacing:4px">${code}</div><p>This code expires in 5 minutes.</p><p>— MaggieGPT</p></div>`
  };

  try {
    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`2FA code sent to ${email}`);
  } catch (error) {
    console.error('Error sending 2FA code:', error);
    throw new Error('Failed to send 2FA code');
  }
};

module.exports = send2FACode;

module.exports.sendEmail = async (email, subject, html) => {
  const transporter = createTransporter();
  await transporter.sendMail({ from: process.env.EMAIL_USER, to: email, subject, html });
};
