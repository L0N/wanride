import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🚗 WanRides MVP</h1>
        <p>
          Your comprehensive ride-hailing application is being built!
        </p>
        <div className="features">
          <h2>🌟 Coming Soon:</h2>
          <ul>
            <li>👤 Multi-Role Support (Client, Driver, Company, Admin)</li>
            <li>🔐 Secure Authentication with Phone/OTP</li>
            <li>📱 Real-Time Ride Tracking</li>
            <li>💰 Referral System (0.25% profit sharing)</li>
            <li>📄 Document Verification</li>
            <li>🗺️ Interactive Maps</li>
          </ul>
        </div>
        <div className="status">
          <h3>📋 Development Status:</h3>
          <p>✅ Phase 1: Project Setup & Infrastructure (Completed)</p>
          <p>🔄 Phase 2: Database Models & Schemas (Next)</p>
        </div>
      </header>
    </div>
  );
}

export default App;
