const nodemailer = require("nodemailer");

// Create a transporter using Ethereal test credentials.
// For production, replace with your actual SMTP server details.
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // Use true for port 465, false for port 587
  auth: {
    user: "mayurthigale2002@gmail.com",
    pass: "ucom cvjg zisi adtl",
  },
});

// Send an email using async/await
const sendGmail=async (mail,otp) => {
  const info = await transporter.sendMail({
    from: 'mayurthigale2002@gmail.com',
    to: mail,
    subject: "Verify User Account",
    text: "Testing Email",
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>OTP Verification</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f6f8; padding:20px;">
    <tr>
      <td align="center">

        <!-- Email Container -->
        <table width="400" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td align="center" style="background:linear-gradient(135deg,#6a11cb,#2575fc); padding:20px; color:#ffffff;">
              <h2 style="margin:0;">Verify Your Account</h2>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px; text-align:center; color:#333;">
              <p style="font-size:16px; margin-bottom:20px;">
                Use the following One-Time Password (OTP) to complete your verification:
              </p>

              <!-- OTP Box -->
              <div style="display:inline-block; padding:15px 25px; background:#f1f3f6; border-radius:8px; letter-spacing:10px; font-size:28px; font-weight:bold; color:#2575fc;">
                ${otp}
              </div>

              <p style="font-size:14px; margin-top:25px; color:#666;">
                This OTP is valid for 5 minutes. Do not share it with anyone.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px; font-size:12px; color:#999;">
              If you didn’t request this, you can safely ignore this email.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`, // HTML version of the message
  });

  console.log("Message sent:", info.messageId);
};

module.exports=sendGmail


