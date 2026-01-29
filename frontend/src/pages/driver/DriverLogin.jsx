import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { isMobile } from 'react-device-detect';

const DriverLogin = () => {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'shift-info'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [shiftInfo, setShiftInfo] = useState(null);
  const [vehicleAssignment, setVehicleAssignment] = useState(null);

  // Redirect if already logged in as driver
  useEffect(() => {
    if (user && user.roles.includes('DRIVER')) {
      navigate('/driver/dashboard');
    }
  }, [user, navigate]);

  // Format phone number for PNG
  const formatPNGPhone = (value) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Handle PNG format (+675)
    if (digits.startsWith('675')) {
      const number = digits.slice(3);
      if (number.length <= 3) return `+675 ${number}`;
      if (number.length <= 7) return `+675 ${number.slice(0, 3)} ${number.slice(3)}`;
      return `+675 ${number.slice(0, 3)} ${number.slice(3, 7)}`;
    } else if (digits.length > 0) {
      // Assume local PNG number, add +675 prefix
      if (digits.length <= 3) return `+675 ${digits}`;
      if (digits.length <= 7) return `+675 ${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `+675 ${digits.slice(0, 3)} ${digits.slice(3, 7)}`;
    }
    
    return value;
  };

  // Handle phone number input
  const handlePhoneChange = (e) => {
    const formatted = formatPNGPhone(e.target.value);
    setPhoneNumber(formatted);
  };

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  // Handle OTP backspace
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  // Send OTP
  const handleSendOtp = async () => {
    if (!phoneNumber) {
      toast.error('Please enter your phone number');
      return;
    }

    // Validate PNG phone number
    try {
      const parsed = parsePhoneNumber(phoneNumber, 'PG');
      if (!parsed || !parsed.isValid()) {
        toast.error('Please enter a valid PNG phone number');
        return;
      }
    } catch (error) {
      toast.error('Please enter a valid PNG phone number');
      return;
    }

    setIsLoading(true);
    
    try {
      // Mock API call - replace with real implementation
      const response = await fetch('/api/auth/driver/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone: phoneNumber,
          userType: 'DRIVER'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Check if driver is assigned to a vehicle today
        if (!data.vehicleAssignment) {
          toast.error('You are not assigned to a vehicle today. Contact your supervisor.');
          return;
        }
        
        setVehicleAssignment(data.vehicleAssignment);
        setShiftInfo(data.shiftInfo);
        setStep('otp');
        toast.success('OTP sent to your phone');
        
        // Auto-focus first OTP input
        setTimeout(() => {
          const firstInput = document.getElementById('otp-0');
          if (firstInput) firstInput.focus();
        }, 100);
      } else {
        const error = await response.json();
        toast.error(error.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      toast.error('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Verify OTP and login
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/driver/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phoneNumber,
          otp: otpCode,
          rememberMe,
          userType: 'DRIVER'
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Verify user has DRIVER role
        if (!data.user.roles.includes('DRIVER')) {
          toast.error('Access denied: Driver account required');
          return;
        }
        
        // Store auth data
        await login(data.user, data.token);
        
        toast.success(`Welcome back, ${data.user.name}!`);
        
        // Show shift info before redirecting
        setStep('shift-info');
        
        // Auto-redirect after 3 seconds
        setTimeout(() => {
          navigate('/driver/dashboard');
        }, 3000);
        
      } else {
        const error = await response.json();
        toast.error(error.message || 'Invalid OTP code');
        
        // Clear OTP inputs on error
        setOtp(['', '', '', '', '', '']);
        const firstInput = document.getElementById('otp-0');
        if (firstInput) firstInput.focus();
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error('Network error. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    setOtp(['', '', '', '', '', '']);
    await handleSendOtp();
  };

  // Go back to phone input
  const handleBackToPhone = () => {
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
  };

  // Render phone input step
  const renderPhoneStep = () => (
    <div className="login-step phone-step">
      <div className="step-header">
        <h1>🚗 WanRide Driver</h1>
        <p>Enter your phone number to get started</p>
      </div>
      
      <div className="form-group">
        <label htmlFor="phone">Phone Number</label>
        <input
          id="phone"
          type="tel"
          value={phoneNumber}
          onChange={handlePhoneChange}
          placeholder="+675 XXX XXXX"
          className="phone-input"
          autoComplete="tel"
          autoFocus={!isMobile} // Don't auto-focus on mobile (keyboard issues)
        />
        <small className="input-hint">
          PNG phone numbers only (+675)
        </small>
      </div>
      
      <div className="form-group checkbox-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span className="checkbox-text">Keep me signed in</span>
        </label>
      </div>
      
      <button
        onClick={handleSendOtp}
        disabled={isLoading || !phoneNumber}
        className="btn-primary btn-large"
      >
        {isLoading ? '⏳ Sending...' : '📱 Send Code'}
      </button>
      
      <div className="login-footer">
        <p>Need help? Call dispatch: <a href="tel:+6757123456">+675 712 3456</a></p>
      </div>
    </div>
  );

  // Render OTP verification step
  const renderOtpStep = () => (
    <div className="login-step otp-step">
      <div className="step-header">
        <h1>📱 Enter Verification Code</h1>
        <p>We sent a 6-digit code to</p>
        <p className="phone-display">{phoneNumber}</p>
      </div>
      
      <div className="otp-container">
        {otp.map((digit, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="number"
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleOtpKeyDown(index, e)}
            className="otp-input"
            maxLength={1}
            inputMode="numeric"
            pattern="[0-9]"
          />
        ))}
      </div>
      
      <button
        onClick={handleVerifyOtp}
        disabled={isLoading || otp.join('').length !== 6}
        className="btn-primary btn-large"
      >
        {isLoading ? '⏳ Verifying...' : '✅ Verify & Login'}
      </button>
      
      <div className="otp-actions">
        <button
          onClick={handleResendOtp}
          disabled={isLoading}
          className="btn-link"
        >
          📲 Resend Code
        </button>
        <button
          onClick={handleBackToPhone}
          disabled={isLoading}
          className="btn-link"
        >
          ← Change Number
        </button>
      </div>
    </div>
  );

  // Render shift info step
  const renderShiftInfoStep = () => (
    <div className="login-step shift-info-step">
      <div className="step-header">
        <h1>✅ Login Successful!</h1>
        <p>Here's your shift information for today</p>
      </div>
      
      {vehicleAssignment && (
        <div className="vehicle-card">
          <h3>🚗 Your Vehicle Today</h3>
          <div className="vehicle-details">
            <p><strong>Vehicle:</strong> {vehicleAssignment.make} {vehicleAssignment.model}</p>
            <p><strong>Plate:</strong> {vehicleAssignment.plate}</p>
            <p><strong>Color:</strong> {vehicleAssignment.color}</p>
          </div>
        </div>
      )}
      
      {shiftInfo && (
        <div className="shift-card">
          <h3>⏰ Today's Shift</h3>
          <div className="shift-details">
            <p><strong>Start Time:</strong> {shiftInfo.startTime}</p>
            <p><strong>End Time:</strong> {shiftInfo.endTime}</p>
            <p><strong>Break Duration:</strong> {shiftInfo.breakDuration} minutes</p>
          </div>
        </div>
      )}
      
      <div className="redirect-notice">
        <p>🔄 Redirecting to dashboard in 3 seconds...</p>
        <button
          onClick={() => navigate('/driver/dashboard')}
          className="btn-primary btn-large"
        >
          🚀 Go to Dashboard Now
        </button>
      </div>
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="driver-login loading">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="driver-login">
      <div className="login-container">
        {step === 'phone' && renderPhoneStep()}
        {step === 'otp' && renderOtpStep()}
        {step === 'shift-info' && renderShiftInfoStep()}
      </div>
      
      {/* Network status indicator */}
      <div className="network-status">
        <div className={`status-dot ${navigator.onLine ? 'online' : 'offline'}`} />
        <span>{navigator.onLine ? 'Online' : 'Offline'}</span>
      </div>
    </div>
  );
};

export default DriverLogin;
