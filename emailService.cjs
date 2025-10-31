const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
const upload = multer();

// POST /send-quiz-email
app.post('/send-quiz-email', upload.single('quizZip'), async (req, res) => {
  try {
    const {
      to,
      quizName,
      quizCode,
      subject,
      course,
      instructor,
      date,
      time,
      duration
    } = req.body;
    const zipBuffer = req.file.buffer;

    // Create Nodemailer transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for 587
      auth: {
        user: 'noreply@bmu.edu.in',
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      connectionTimeout: 10000, // optional, 10s timeout
    });


    // Helper to pad numbers
    const pad = (n) => n.toString().padStart(2, '0');

    // Parse date and time in GMT+5:30
    const localDate = new Date(`${date}T${time}:00+05:30`);
    const durationMinutes = parseInt(duration) || 60; // fallback to 60 if not provided
    const endDate = new Date(localDate.getTime() + durationMinutes * 60000);

    // Convert to UTC and format for Google Calendar
    const formatForGoogle = (d) =>
      d.getUTCFullYear().toString() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      'T' +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      'Z';

    const startStr = formatForGoogle(localDate);
    const endStr = formatForGoogle(endDate);

    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(quizName)}` +
      `&dates=${startStr}/${endStr}` +
      `&details=${encodeURIComponent('Quiz: ' + quizName)}`;

    // Email template
    const html = `
      <p>Hello,</p>
      <p>This is the details for your upcoming quiz. Please review the details below:</p>
      <ul>
        <li>📘 <b>Quiz Name:</b> ${quizName}</li>
        <li>🧾 <b>Quiz Code:</b> ${quizCode}</li>
        <li>📚 <b>Subject:</b> ${subject}</li>
        <li>🏫 <b>Course:</b> ${course}</li>
        <li>👨‍🏫 <b>Instructor:</b> ${instructor}</li>
        <li>🗓️ <b>Date:</b> ${date}</li>
        <li>⏰ <b>Time:</b> ${time}</li>
        <li>⌛ <b>Duration:</b> ${duration}</li>
      </ul>
      <p>Please make sure you’re prepared in advance. Good luck!</p>
      <p><a href="${calendarUrl}" target="_blank">➕ Add to Google Calendar</a></p>
      <p>Best regards,<br/>PrashnaSetu</p>
    `;

    await transporter.sendMail({
      from: 'PrashnaSetu <noreply@bmu.edu.in>',
      to,
      subject: 'Quiz details',
      html,
      attachments: [
        {
          filename: 'quiz.zip',
          content: zipBuffer,
        },
      ],
    });

    // Schedule a second email 1 hour before quiz time
    try {
      const quizDateTime = new Date(`${date}T${time}:00`);
      const now = new Date();
      const msUntilScheduled = quizDateTime.getTime() - 60 * 60 * 1000 - now.getTime(); // 1 hour before
      if (msUntilScheduled > 0) {
        console.log(`Scheduling reminder email to ${to} in ${msUntilScheduled / 1000 / 60} minutes (1 hour before quiz)`);
        setTimeout(async () => {
          try {
            await transporter.sendMail({
              from: 'PrashnaSetu <noreply@bmu.edu.in>',
              to,
              subject: 'Reminder: Quiz details',
              html,
              attachments: [
                {
                  filename: 'quiz.zip',
                  content: zipBuffer,
                },
              ],
            });
            console.log(`Scheduled reminder email sent to ${to} (1 hour before quiz)`);
          } catch (err) {
            console.error('Error sending scheduled email:', err);
          }
        }, msUntilScheduled);
      } else {
        console.log('Quiz time is less than 1 hour from now; scheduled email not set.');
      }
    } catch (err) {
      console.error('Error scheduling reminder email:', err);
    }

    res.status(200).json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Email service running on port ${PORT}`);
});
