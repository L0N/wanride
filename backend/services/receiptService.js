const moment = require('moment-timezone');
const { formatKina } = require('../utils/k5Rounding');

const PNG_TIMEZONE = 'Pacific/Port_Moresby';

/**
 * Receipt Generation Service for WanRide PNG
 * 
 * Generates professional receipts for completed rides with:
 * - Unique receipt numbers
 * - PNG timezone formatting
 * - K5-rounded amounts
 * - Multiple formats (SMS, HTML, Email)
 */

/**
 * Generate receipt data for a completed ride
 * @param {Object} ride - Ride document with populated fields
 * @returns {Object} Receipt data
 */
function generateReceipt(ride) {
  const receiptNumber = ride.payment.receiptNumber || ride.generateReceiptNumber();
  
  const receiptData = {
    receiptNumber: receiptNumber,
    dateTime: moment(ride.payment.collectedAt || ride.timestamps.completed)
      .tz(PNG_TIMEZONE)
      .format('DD/MM/YYYY HH:mm'),
    
    // Company details
    company: {
      name: 'WanRide',
      address: 'Port Moresby, Papua New Guinea',
      phone: process.env.COMPANY_PHONE || '+675 XXX XXXX',
      email: process.env.COMPANY_EMAIL || 'info@wanride.com.pg'
    },
    
    // Passenger details (privacy-protected)
    passenger: {
      name: ride.passenger.name,
      phone: ride.passenger.phone ? `***${ride.passenger.phone.slice(-4)}` : 'N/A'
    },
    
    // Driver details
    driver: {
      name: ride.driver.name,
      id: ride.driver.employeeId || ride.driver._id.toString().slice(-6)
    },
    
    // Vehicle details
    vehicle: {
      make: ride.vehicle.make,
      model: ride.vehicle.model,
      plate: ride.vehicle.licensePlate
    },
    
    // Trip details
    trip: {
      from: ride.pickup.address,
      to: ride.destination.address,
      distance: ride.fareCalculation.distanceKm 
        ? `${ride.fareCalculation.distanceKm.toFixed(1)} km` 
        : 'N/A',
      duration: ride.fareCalculation.timeMinutes 
        ? `${ride.fareCalculation.timeMinutes} min` 
        : 'N/A'
    },
    
    // Fare breakdown
    fare: {
      method: ride.fareCalculation.method,
      items: [],
      total: formatKina(ride.fareCalculation.finalFare)
    },
    
    // Payment details
    payment: {
      method: ride.payment.paymentMethod || 'CASH',
      status: ride.payment.status,
      amountPaid: formatKina(ride.payment.amountCollected || ride.payment.amountDue)
    }
  };
  
  // Build fare breakdown based on method
  if (ride.fareCalculation.method === 'FLAT_NCD') {
    receiptData.fare.items.push({
      description: 'Flat rate (Port Moresby)',
      amount: formatKina(ride.fareCalculation.baseFare)
    });
  } else if (ride.fareCalculation.method === 'FLAT_NCD_AIRPORT') {
    receiptData.fare.items.push(
      {
        description: 'Base fare',
        amount: formatKina(ride.fareCalculation.baseFare)
      },
      {
        description: '✈️ Airport fee',
        amount: formatKina(ride.fareCalculation.airportAddon)
      }
    );
  } else if (ride.fareCalculation.method === 'DISTANCE_BASED') {
    receiptData.fare.items.push(
      {
        description: 'Base fare',
        amount: formatKina(ride.fareCalculation.baseFare)
      },
      {
        description: `Distance (${ride.fareCalculation.distanceKm.toFixed(1)} km)`,
        amount: formatKina(ride.fareCalculation.distanceCharge, false)
      },
      {
        description: `Time (${ride.fareCalculation.timeMinutes} min)`,
        amount: formatKina(ride.fareCalculation.timeCharge, false)
      }
    );
    
    if (ride.fareCalculation.returnFee > 0) {
      receiptData.fare.items.push({
        description: 'Return costs',
        amount: formatKina(ride.fareCalculation.returnFee)
      });
    }
  }
  
  return receiptData;
}

/**
 * Generate receipt text (for SMS)
 * @param {Object} receiptData - Receipt data from generateReceipt
 * @returns {string} SMS-formatted receipt text
 */
function generateReceiptSMS(receiptData) {
  let sms = `🚗 WanRide Receipt\n`;
  sms += `#${receiptData.receiptNumber}\n`;
  sms += `${receiptData.dateTime}\n\n`;
  sms += `📍 From: ${receiptData.trip.from}\n`;
  sms += `📍 To: ${receiptData.trip.to}\n\n`;
  sms += `💰 Fare: ${receiptData.fare.total}\n`;
  sms += `✅ Paid: ${receiptData.payment.amountPaid} (${receiptData.payment.method})\n\n`;
  sms += `👨‍✈️ Driver: ${receiptData.driver.name}\n`;
  sms += `🚙 Vehicle: ${receiptData.vehicle.make} ${receiptData.vehicle.model}\n\n`;
  sms += `Thank you for riding with WanRide! 🇵🇬\n`;
  sms += `📞 Support: ${receiptData.company.phone}`;
  
  return sms;
}

/**
 * Generate receipt HTML (for email or display)
 * @param {Object} receiptData - Receipt data from generateReceipt
 * @returns {string} HTML receipt
 */
function generateReceiptHTML(receiptData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>WanRide Receipt #${receiptData.receiptNumber}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
          color: #333;
        }
        .receipt {
          background: white;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.1);
          border: 1px solid #e0e0e0;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #1976D2;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        .company-name {
          font-size: 36px;
          font-weight: bold;
          color: #1976D2;
          margin-bottom: 5px;
        }
        .receipt-number {
          font-size: 16px;
          color: #666;
          font-weight: 500;
        }
        .receipt-date {
          font-size: 14px;
          color: #888;
          margin-top: 8px;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-weight: bold;
          color: #1976D2;
          margin-bottom: 12px;
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e0e0e0;
          padding-bottom: 5px;
        }
        .info-line {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
          border-bottom: 1px solid #f5f5f5;
        }
        .info-line:last-child {
          border-bottom: none;
        }
        .info-label {
          font-weight: 500;
          color: #555;
        }
        .info-value {
          color: #333;
          text-align: right;
        }
        .fare-item {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
          font-size: 14px;
        }
        .fare-item:last-child {
          border-bottom: none;
        }
        .fare-total {
          display: flex;
          justify-content: space-between;
          padding: 20px 0 10px 0;
          font-size: 22px;
          font-weight: bold;
          border-top: 3px solid #1976D2;
          margin-top: 15px;
          color: #1976D2;
        }
        .payment-status {
          display: inline-block;
          background: #4CAF50;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }
        .footer {
          text-align: center;
          margin-top: 35px;
          padding-top: 25px;
          border-top: 2px solid #f0f0f0;
          color: #666;
          font-size: 13px;
        }
        .footer-title {
          font-size: 16px;
          font-weight: bold;
          color: #1976D2;
          margin-bottom: 10px;
        }
        .png-flag {
          font-size: 20px;
          margin: 0 5px;
        }
        @media print {
          body {
            background-color: white;
            padding: 0;
          }
          .receipt {
            box-shadow: none;
            border: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="company-name">WanRide</div>
          <div class="receipt-number">Receipt #${receiptData.receiptNumber}</div>
          <div class="receipt-date">${receiptData.dateTime}</div>
        </div>
        
        <div class="section">
          <div class="section-title">Trip Details</div>
          <div class="info-line">
            <span class="info-label">📍 From:</span>
            <span class="info-value">${receiptData.trip.from}</span>
          </div>
          <div class="info-line">
            <span class="info-label">📍 To:</span>
            <span class="info-value">${receiptData.trip.to}</span>
          </div>
          ${receiptData.trip.distance !== 'N/A' ? `
          <div class="info-line">
            <span class="info-label">📏 Distance:</span>
            <span class="info-value">${receiptData.trip.distance}</span>
          </div>
          ` : ''}
          ${receiptData.trip.duration !== 'N/A' ? `
          <div class="info-line">
            <span class="info-label">⏱️ Duration:</span>
            <span class="info-value">${receiptData.trip.duration}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="section">
          <div class="section-title">Fare Breakdown</div>
          ${receiptData.fare.items.map(item => `
            <div class="fare-item">
              <span>${item.description}</span>
              <span>${item.amount}</span>
            </div>
          `).join('')}
          <div class="fare-total">
            <span>Total Fare</span>
            <span>PGK ${receiptData.fare.total}</span>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Payment Information</div>
          <div class="info-line">
            <span class="info-label">💳 Method:</span>
            <span class="info-value">${receiptData.payment.method}</span>
          </div>
          <div class="info-line">
            <span class="info-label">💰 Amount Paid:</span>
            <span class="info-value">PGK ${receiptData.payment.amountPaid}</span>
          </div>
          <div class="info-line">
            <span class="info-label">✅ Status:</span>
            <span class="info-value">
              <span class="payment-status">${receiptData.payment.status}</span>
            </span>
          </div>
        </div>
        
        <div class="section">
          <div class="section-title">Service Details</div>
          <div class="info-line">
            <span class="info-label">👨‍✈️ Driver:</span>
            <span class="info-value">${receiptData.driver.name}</span>
          </div>
          <div class="info-line">
            <span class="info-label">🚙 Vehicle:</span>
            <span class="info-value">${receiptData.vehicle.make} ${receiptData.vehicle.model} (${receiptData.vehicle.plate})</span>
          </div>
        </div>
        
        <div class="footer">
          <div class="footer-title">Thank you for riding with WanRide! <span class="png-flag">🇵🇬</span></div>
          <p>${receiptData.company.address}</p>
          <p>📞 ${receiptData.company.phone} | 📧 ${receiptData.company.email}</p>
          <p style="margin-top: 15px; font-style: italic;">
            Professional fleet transport services for Papua New Guinea
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send receipt via SMS
 * @param {string} phoneNumber - Passenger phone number
 * @param {Object} receiptData - Receipt data
 * @returns {Promise<boolean>} Success status
 */
async function sendReceiptSMS(phoneNumber, receiptData) {
  // SMS sending implementation
  // This requires SMS service configuration (Twilio, AWS SNS, etc.)
  
  const smsText = generateReceiptSMS(receiptData);
  
  try {
    // Example with Twilio (if configured)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const twilio = require('twilio')(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      await twilio.messages.create({
        body: smsText,
        from: process.env.SMS_FROM_NUMBER,
        to: phoneNumber
      });
      
      console.log(`✅ Receipt SMS sent to ${phoneNumber}`);
      return true;
    } else {
      console.log(`📱 SMS service not configured - would send to ${phoneNumber}:`);
      console.log(smsText);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to send receipt SMS:', error);
    return false;
  }
}

/**
 * Send receipt via email
 * @param {string} email - Passenger email
 * @param {Object} receiptData - Receipt data
 * @returns {Promise<boolean>} Success status
 */
async function sendReceiptEmail(email, receiptData) {
  // Email sending implementation
  // This requires email service configuration (SendGrid, AWS SES, etc.)
  
  const htmlContent = generateReceiptHTML(receiptData);
  
  try {
    // Example with SendGrid (if configured)
    if (process.env.SENDGRID_API_KEY) {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      
      await sgMail.send({
        to: email,
        from: process.env.EMAIL_FROM || 'receipts@wanride.com.pg',
        subject: `🚗 WanRide Receipt #${receiptData.receiptNumber}`,
        html: htmlContent,
        text: generateReceiptSMS(receiptData) // Fallback text version
      });
      
      console.log(`✅ Receipt email sent to ${email}`);
      return true;
    } else {
      console.log(`📧 Email service not configured - would send to ${email}`);
      console.log(`Subject: WanRide Receipt #${receiptData.receiptNumber}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to send receipt email:', error);
    return false;
  }
}

/**
 * Generate receipt for printing (simplified HTML)
 * @param {Object} receiptData - Receipt data
 * @returns {string} Print-friendly HTML
 */
function generateReceiptPrint(receiptData) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>WanRide Receipt #${receiptData.receiptNumber}</title>
      <style>
        @media print {
          body { margin: 0; font-family: monospace; font-size: 12px; }
          .no-print { display: none; }
        }
        body { font-family: monospace; max-width: 300px; margin: 0 auto; padding: 10px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-bottom: 1px dashed #000; margin: 5px 0; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; }
      </style>
    </head>
    <body>
      <div class="center bold">
        WANRIDE<br>
        Receipt #${receiptData.receiptNumber}<br>
        ${receiptData.dateTime}
      </div>
      <div class="line"></div>
      
      <div class="row">
        <span>From:</span>
        <span>${receiptData.trip.from}</span>
      </div>
      <div class="row">
        <span>To:</span>
        <span>${receiptData.trip.to}</span>
      </div>
      <div class="line"></div>
      
      ${receiptData.fare.items.map(item => `
        <div class="row">
          <span>${item.description}</span>
          <span>${item.amount}</span>
        </div>
      `).join('')}
      <div class="line"></div>
      
      <div class="row bold">
        <span>TOTAL:</span>
        <span>PGK ${receiptData.fare.total}</span>
      </div>
      <div class="row">
        <span>Paid (${receiptData.payment.method}):</span>
        <span>PGK ${receiptData.payment.amountPaid}</span>
      </div>
      <div class="line"></div>
      
      <div class="row">
        <span>Driver:</span>
        <span>${receiptData.driver.name}</span>
      </div>
      <div class="row">
        <span>Vehicle:</span>
        <span>${receiptData.vehicle.plate}</span>
      </div>
      <div class="line"></div>
      
      <div class="center">
        Thank you for riding with WanRide!<br>
        ${receiptData.company.phone}
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateReceipt,
  generateReceiptSMS,
  generateReceiptHTML,
  generateReceiptPrint,
  sendReceiptSMS,
  sendReceiptEmail
};
