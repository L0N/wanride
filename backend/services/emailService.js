const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.supportEmail = process.env.SUPPORT_EMAIL || 'frank@wantekpng.com';
    this.businessName = process.env.BUSINESS_NAME || 'WanTek PNG';
    this.businessContact = process.env.BUSINESS_CONTACT || 'frank@wantekpng.com';
    
    // Initialize email transporter
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter with configuration
   */
  initializeTransporter() {
    try {
      if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        this.transporter = nodemailer.createTransporter({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT) || 587,
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        
        console.log('Email service initialized successfully');
      } else {
        console.warn('Email credentials not provided. Email service will use mock mode.');
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  /**
   * Send ride receipt via email
   */
  async sendRideReceipt(passengerEmail, rideDetails) {
    try {
      const subject = `WanRide Receipt - Ride #${rideDetails.rideId}`;
      const htmlContent = this.buildReceiptHTML(rideDetails);
      const textContent = this.buildReceiptText(rideDetails);

      return await this.sendEmail({
        to: passengerEmail,
        subject: subject,
        html: htmlContent,
        text: textContent
      });

    } catch (error) {
      console.error('Failed to send ride receipt:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send driver welcome email
   */
  async sendDriverWelcomeEmail(driverEmail, driverName) {
    try {
      const subject = `Welcome to WanRide Fleet - ${driverName}`;
      const htmlContent = this.buildDriverWelcomeHTML(driverName);
      const textContent = this.buildDriverWelcomeText(driverName);

      return await this.sendEmail({
        to: driverEmail,
        subject: subject,
        html: htmlContent,
        text: textContent
      });

    } catch (error) {
      console.error('Failed to send driver welcome email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send system notification email
   */
  async sendSystemNotification(recipientEmail, subject, message, isUrgent = false) {
    try {
      const emailSubject = isUrgent ? `[URGENT] ${subject}` : `WanRide: ${subject}`;
      const htmlContent = this.buildNotificationHTML(subject, message, isUrgent);
      const textContent = this.buildNotificationText(subject, message);

      return await this.sendEmail({
        to: recipientEmail,
        subject: emailSubject,
        html: htmlContent,
        text: textContent
      });

    } catch (error) {
      console.error('Failed to send system notification:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send generic email
   */
  async sendEmail({ to, subject, html, text }) {
    try {
      if (!this.transporter) {
        // Mock mode for development
        console.log(`[EMAIL MOCK] Sending email to ${to}:`);
        console.log(`Subject: ${subject}`);
        console.log(`Content: ${text || html}`);
        return {
          success: true,
          messageId: `mock_${Date.now()}`,
          mock: true
        };
      }

      const mailOptions = {
        from: `"WanRide Fleet" <${this.supportEmail}>`,
        to: to,
        subject: subject,
        text: text,
        html: html
      };

      const result = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: result.messageId,
        mock: false
      };

    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message,
        mock: !this.transporter
      };
    }
  }

  /**
   * Build HTML content for ride receipt
   */
  buildReceiptHTML(rideDetails) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>WanRide Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #007bff; margin-bottom: 10px; }
          .receipt-details { margin-bottom: 30px; }
          .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; padding: 8px 0; border-bottom: 1px solid #eee; }
          .detail-label { font-weight: bold; color: #333; }
          .detail-value { color: #666; }
          .total-row { font-size: 18px; font-weight: bold; color: #007bff; border-top: 2px solid #007bff; padding-top: 15px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .support { margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">WanRide Fleet</div>
            <div>Port Moresby's Premier Transport Service</div>
          </div>
          
          <div class="receipt-details">
            <h2>Ride Receipt</h2>
            
            <div class="detail-row">
              <span class="detail-label">Ride ID:</span>
              <span class="detail-value">#${rideDetails.rideId}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Date:</span>
              <span class="detail-value">${new Date(rideDetails.completedAt).toLocaleDateString('en-PG')}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Time:</span>
              <span class="detail-value">${new Date(rideDetails.completedAt).toLocaleTimeString('en-PG')}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">From:</span>
              <span class="detail-value">${rideDetails.pickupAddress}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">To:</span>
              <span class="detail-value">${rideDetails.dropoffAddress}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Distance:</span>
              <span class="detail-value">${rideDetails.distance} km</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Driver:</span>
              <span class="detail-value">${rideDetails.driverName}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Vehicle:</span>
              <span class="detail-value">${rideDetails.vehiclePlate}</span>
            </div>
            
            <div class="detail-row total-row">
              <span class="detail-label">Total Fare:</span>
              <span class="detail-value">K${rideDetails.fare}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Payment Method:</span>
              <span class="detail-value">Cash</span>
            </div>
          </div>
          
          <div class="support">
            <strong>Need Help?</strong><br>
            Contact our support team at <a href="mailto:${this.supportEmail}">${this.supportEmail}</a><br>
            ${this.businessName} - Reliable Transport Solutions
          </div>
          
          <div class="footer">
            <p>Thank you for choosing WanRide Fleet!</p>
            <p>This is an automated receipt. Please keep it for your records.</p>
            <p>&copy; 2026 ${this.businessName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Build text content for ride receipt
   */
  buildReceiptText(rideDetails) {
    return `
WanRide Fleet - Ride Receipt

Ride ID: #${rideDetails.rideId}
Date: ${new Date(rideDetails.completedAt).toLocaleDateString('en-PG')}
Time: ${new Date(rideDetails.completedAt).toLocaleTimeString('en-PG')}

From: ${rideDetails.pickupAddress}
To: ${rideDetails.dropoffAddress}
Distance: ${rideDetails.distance} km
Driver: ${rideDetails.driverName}
Vehicle: ${rideDetails.vehiclePlate}

Total Fare: K${rideDetails.fare}
Payment Method: Cash

Need Help?
Contact our support team at ${this.supportEmail}
${this.businessName} - Reliable Transport Solutions

Thank you for choosing WanRide Fleet!
This is an automated receipt. Please keep it for your records.

© 2026 ${this.businessName}. All rights reserved.
    `.trim();
  }

  /**
   * Build HTML content for driver welcome email
   */
  buildDriverWelcomeHTML(driverName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to WanRide Fleet</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #28a745; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #28a745; margin-bottom: 10px; }
          .welcome-content { margin-bottom: 30px; line-height: 1.6; }
          .highlight { background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .support { margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">Welcome to WanRide Fleet!</div>
            <div>Port Moresby's Premier Transport Service</div>
          </div>
          
          <div class="welcome-content">
            <h2>Welcome aboard, ${driverName}!</h2>
            
            <p>Congratulations on joining the WanRide Fleet family! You are now part of Port Moresby's premier transport service, and we're excited to have you on our team.</p>
            
            <div class="highlight">
              <strong>What's Next?</strong><br>
              • Complete your driver verification process<br>
              • Attend the mandatory safety briefing<br>
              • Get assigned to your company vehicle<br>
              • Start earning with our competitive commission structure
            </div>
            
            <p>As a WanRide driver, you'll enjoy:</p>
            <ul>
              <li>Competitive commission rates (15% - 30% based on your rating)</li>
              <li>Company-provided vehicles and maintenance</li>
              <li>24/7 dispatcher support</li>
              <li>Weekly salary plus commission</li>
              <li>Professional development opportunities</li>
            </ul>
            
            <p>Remember to always prioritize safety, provide excellent customer service, and represent WanRide with pride.</p>
          </div>
          
          <div class="support">
            <strong>Need Help or Have Questions?</strong><br>
            Contact our support team at <a href="mailto:${this.supportEmail}">${this.supportEmail}</a><br>
            ${this.businessName} - Your Success is Our Success
          </div>
          
          <div class="footer">
            <p>Drive safely and welcome to the team!</p>
            <p>&copy; 2026 ${this.businessName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Build text content for driver welcome email
   */
  buildDriverWelcomeText(driverName) {
    return `
Welcome to WanRide Fleet!

Dear ${driverName},

Congratulations on joining the WanRide Fleet family! You are now part of Port Moresby's premier transport service, and we're excited to have you on our team.

What's Next?
• Complete your driver verification process
• Attend the mandatory safety briefing
• Get assigned to your company vehicle
• Start earning with our competitive commission structure

As a WanRide driver, you'll enjoy:
• Competitive commission rates (15% - 30% based on your rating)
• Company-provided vehicles and maintenance
• 24/7 dispatcher support
• Weekly salary plus commission
• Professional development opportunities

Remember to always prioritize safety, provide excellent customer service, and represent WanRide with pride.

Need Help or Have Questions?
Contact our support team at ${this.supportEmail}
${this.businessName} - Your Success is Our Success

Drive safely and welcome to the team!

© 2026 ${this.businessName}. All rights reserved.
    `.trim();
  }

  /**
   * Build HTML content for system notifications
   */
  buildNotificationHTML(subject, message, isUrgent) {
    const urgentStyle = isUrgent ? 'border-left: 4px solid #dc3545; background-color: #f8d7da;' : 'border-left: 4px solid #007bff; background-color: #d1ecf1;';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>WanRide Notification</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
          .logo { font-size: 28px; font-weight: bold; color: #007bff; margin-bottom: 10px; }
          .notification { padding: 20px; border-radius: 5px; margin: 20px 0; ${urgentStyle} }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          .support { margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">WanRide Fleet</div>
            <div>System Notification</div>
          </div>
          
          <div class="notification">
            <h3>${subject}</h3>
            <p>${message}</p>
          </div>
          
          <div class="support">
            <strong>Need Assistance?</strong><br>
            Contact our support team at <a href="mailto:${this.supportEmail}">${this.supportEmail}</a><br>
            ${this.businessName} - Always Here to Help
          </div>
          
          <div class="footer">
            <p>This is an automated notification from WanRide Fleet.</p>
            <p>&copy; 2026 ${this.businessName}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Build text content for system notifications
   */
  buildNotificationText(subject, message) {
    return `
WanRide Fleet - System Notification

${subject}

${message}

Need Assistance?
Contact our support team at ${this.supportEmail}
${this.businessName} - Always Here to Help

This is an automated notification from WanRide Fleet.

© 2026 ${this.businessName}. All rights reserved.
    `.trim();
  }

  /**
   * Get email service status
   */
  getServiceStatus() {
    return {
      configured: !!this.transporter,
      mockMode: !this.transporter,
      supportEmail: this.supportEmail,
      businessName: this.businessName,
      businessContact: this.businessContact
    };
  }
}

module.exports = new EmailService();
