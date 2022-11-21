const nodemailer = require('nodemailer');

const sendEmail = async options => {
  // 1) Create a transporter
  const port = Number(process.env.EMAIL_PORT);
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: port,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  // 2) Define the email options
  const mailOptions = {
    from: 'Jitender Joshi <admin@natours.com>',
    to: options.email,
    subject: options.subject,
    text: options.message
    // html:
  };

  // 3) Actually send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;

//we are using mailtrap

//FOR GMAIL
// const nodemailer = require('nodemailer');

// const sendEmail = options => {
//   //1. create a transporter (service)
//   const transporter = nodemailer.createTransporter({
//     service: 'Gmail',
//     auth: {
//       user: process.env.EMAIL_USERNAME,
//       pass: process.env.EMAIL_PASSWORD
//     }
//     //Activate in gmail "less secure app" option
//   });

//   //2. define email options

//   //3. Actuall senf the email
// };
