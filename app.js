const express = require('express');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Configure the Gmail API client
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
});

const gmail = google.gmail({ version: 'v1', auth });

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

app.post('/send-drafts', async (req, res) => {
  try {
    const { user_email } = req.body;

    if (!user_email) {
      return res.status(400).json({ error: 'Missing required fields in the request.' });
    }

    // Fetch draft emails from Gmail
    const response = await gmail.users.drafts.list({ userId: 'me' });
    const drafts = response.data.drafts;

    for (const draft of drafts) {
      const draftMessage = await gmail.users.drafts.get({
        userId: 'me',
        id: draft.id,
      });

      // Extract email content from the draft
      const subject = draftMessage.data.message.payload.headers.find(
        (header) => header.name === 'Subject'
      ).value;
      const body = Buffer.from(
        draftMessage.data.message.payload.body.data,
        'base64'
      ).toString('ascii');

      // Send the draft email to the customer
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: user_email,
        subject: subject,
        html: body,
      });
    }

    res.status(200).json({ message: 'Draft emails sent to customer.' });
  } catch (error) {
    console.error('Error sending draft emails:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`APP LISTENING ON PORT ${PORT}`);
});