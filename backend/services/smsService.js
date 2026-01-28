const twilio = require('twilio');

class SMSService {
  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID;
    this.authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER;
    
    // Initialize Twilio client if credentials are provided
    if (this.accountSid && this.authToken) {
      this.client = twilio(this.accountSid, this.authToken);
    } else {
      console.warn('Twilio credentials not provided. SMS service will use mock mode.');
      this.client = null;
    }
  }

  /**
   * Format PNG phone number to international format
   * PNG numbers: +675 XXXX XXXX
   */
  formatPNGPhoneNumber(phone) {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Handle different PNG number formats
    if (cleaned.startsWith('675')) {
      // Already has country code
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0')) {
      // Remove leading 0 and add PNG country code
      return `+675${cleaned.substring(1)}`;
    } else if (cleaned.length === 8) {
      // Local PNG number without country code
      return `+675${cleaned}`;
    } else if (cleaned.length === 7) {
      // Old PNG format, add leading digit
      return `+6757${cleaned}`;
    }
    
    // If none of the above, assume it needs PNG country code
    return `+675${cleaned}`;
  }

  /**
   * Validate PNG phone number format
   */
  isValidPNGPhoneNumber(phone) {
    const formatted = this.formatPNGPhoneNumber(phone);
    
    // PNG numbers should be +675 followed by 7-8 digits
    const pngPattern = /^\+675[0-9]{7,8}$/;
    return pngPattern.test(formatted);
  }

  /**
   * Generate 6-digit OTP code
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP via SMS to PNG number
   */
  async sendOTP(phone, otp, purpose = 'verification') {
    try {
      const formattedPhone = this.formatPNGPhoneNumber(phone);
      
      if (!this.isValidPNGPhoneNumber(phone)) {
        throw new Error('Invalid Papua New Guinea phone number format');
      }

      const message = this.buildOTPMessage(otp, purpose);

      if (!this.client) {
        // Mock mode for development
        console.log(`[SMS MOCK] Sending OTP to ${formattedPhone}: ${otp}`);
        return {
          success: true,
          messageId: `mock_${Date.now()}`,
          phone: formattedPhone,
          message: message,
          mock: true
        };
      }

      // Send actual SMS via Twilio
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      return {
        success: true,
        messageId: result.sid,
        phone: formattedPhone,
        status: result.status,
        mock: false
      };

    } catch (error) {
      console.error('SMS sending failed:', error);
      
      return {
        success: false,
        error: error.message,
        phone: phone,
        mock: !this.client
      };
    }
  }

  /**
   * Build OTP message based on purpose
   */
  buildOTPMessage(otp, purpose) {
    const messages = {
      verification: `Your WanRide verification code is: ${otp}. Valid for 10 minutes. Do not share this code. Support: frank@wantekpng.com`,
      login: `Your WanRide login code is: ${otp}. Valid for 10 minutes. Do not share this code. Support: frank@wantekpng.com`,
      password_reset: `Your WanRide password reset code is: ${otp}. Valid for 10 minutes. Do not share this code. Support: frank@wantekpng.com`,
      driver_activation: `Your WanRide driver activation code is: ${otp}. Valid for 10 minutes. Welcome to the fleet! Support: frank@wantekpng.com`
    };

    return messages[purpose] || messages.verification;
  }

  /**
   * Send welcome message to new drivers
   */
  async sendDriverWelcome(phone, driverName) {
    try {
      const formattedPhone = this.formatPNGPhoneNumber(phone);
      const message = `Welcome to WanRide Fleet, ${driverName}! You are now part of Port Moresby's premier transport service. Drive safely! Support: frank@wantekpng.com`;

      if (!this.client) {
        console.log(`[SMS MOCK] Welcome message to ${formattedPhone}: ${message}`);
        return { success: true, mock: true };
      }

      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: formattedPhone
      });

      return {
        success: true,
        messageId: result.sid,
        mock: false
      };

    } catch (error) {
      console.error('Welcome SMS failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send ride notification to passenger
   */
  async sendRideNotification(phone, message) {
    try {
      const formattedPhone = this.formatPNGPhoneNumber(phone);

      if (!this.client) {
        console.log(`[SMS MOCK] Ride notification to ${formattedPhone}: ${message}`);
        return { success: true, mock: true };
      }

      const result = await this.client.messages.create({
        body: `WanRide: ${message}`,
        from: this.fromNumber,
        to: formattedPhone
      });

      return {
        success: true,
        messageId: result.sid,
        mock: false
      };

    } catch (error) {
      console.error('Ride notification SMS failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Send SOS alert to emergency contacts
   */
  async sendSOSAlert(emergencyContacts, rideDetails) {
    const results = [];

    for (const contact of emergencyContacts) {
      try {
        const message = `EMERGENCY ALERT: WanRide passenger needs help. Location: ${rideDetails.location}. Ride ID: ${rideDetails.rideId}. Contact dispatcher immediately. Support: frank@wantekpng.com`;
        
        const result = await this.sendRideNotification(contact.phone, message);
        results.push({
          contact: contact,
          result: result
        });
      } catch (error) {
        results.push({
          contact: contact,
          result: { success: false, error: error.message }
        });
      }
    }

    return results;
  }

  /**
   * Validate OTP format
   */
  isValidOTP(otp) {
    return /^[0-9]{6}$/.test(otp);
  }

  /**
   * Get SMS service status
   */
  getServiceStatus() {
    return {
      configured: !!this.client,
      mockMode: !this.client,
      fromNumber: this.fromNumber,
      accountSid: this.accountSid ? `${this.accountSid.substring(0, 8)}...` : null
    };
  }

  /**
   * Test SMS service with a test number
   */
  async testService(testPhone) {
    try {
      const testOTP = this.generateOTP();
      const result = await this.sendOTP(testPhone, testOTP, 'verification');
      
      return {
        success: result.success,
        testPhone: testPhone,
        testOTP: testOTP,
        result: result,
        serviceStatus: this.getServiceStatus()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        serviceStatus: this.getServiceStatus()
      };
    }
  }
}

module.exports = new SMSService();
