const geolib = require('geolib');
const { roundToK5, calculatePercentageK5 } = require('../utils/k5Rounding');

/**
 * Fare Calculation Service for WanRide PNG
 * 
 * Implements the confirmed pricing model:
 * 1. Inside NCD (Port Moresby): Flat K30 rate
 * 2. Outside NCD: Distance-based with 25% return fee
 * 3. Airport trips: +K10 addon
 * 
 * All fares are K5-rounded for PNG compliance
 */

// Load configuration from environment variables
const config = {
  ncdFlatRate: parseFloat(process.env.FARE_NCD_FLAT_RATE) || 30,
  baseFare: parseFloat(process.env.FARE_BASE) || 30,
  distanceRate: parseFloat(process.env.FARE_DISTANCE_RATE) || 2.00,
  timeRate: parseFloat(process.env.FARE_TIME_RATE) || 0.50,
  freeDistanceKm: parseFloat(process.env.FARE_FREE_DISTANCE_KM) || 10,
  returnFeeEnabled: process.env.FARE_RETURN_FEE_ENABLED === 'true',
  returnFeePercentage: parseFloat(process.env.FARE_RETURN_FEE_PERCENTAGE) || 25,
  airportAddon: parseFloat(process.env.FARE_AIRPORT_ADDON) || 10,
  ncdBoundary: {
    north: parseFloat(process.env.NCD_BOUNDARY_NORTH) || -9.3,
    south: parseFloat(process.env.NCD_BOUNDARY_SOUTH) || -9.6,
    east: parseFloat(process.env.NCD_BOUNDARY_EAST) || 147.3,
    west: parseFloat(process.env.NCD_BOUNDARY_WEST) || 147.0
  },
  airport: {
    lat: parseFloat(process.env.AIRPORT_LAT) || -9.4434,
    lng: parseFloat(process.env.AIRPORT_LNG) || 147.2200,
    radiusKm: parseFloat(process.env.AIRPORT_RADIUS_KM) || 0.5
  }
};

/**
 * Check if point is within NCD boundary (Port Moresby)
 * @param {Object} point - {lat, lng}
 * @returns {boolean}
 */
function isPointInNCD(point) {
  return (
    point.lat >= config.ncdBoundary.south &&
    point.lat <= config.ncdBoundary.north &&
    point.lng >= config.ncdBoundary.west &&
    point.lng <= config.ncdBoundary.east
  );
}

/**
 * Check if trip involves airport (Jackson's International)
 * @param {Object} pickup - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @returns {boolean}
 */
function isAirportTrip(pickup, destination) {
  const airportLocation = {
    latitude: config.airport.lat,
    longitude: config.airport.lng
  };
  
  const pickupDistance = geolib.getDistance(
    { latitude: pickup.lat, longitude: pickup.lng },
    airportLocation
  ) / 1000; // Convert to km
  
  const destDistance = geolib.getDistance(
    { latitude: destination.lat, longitude: destination.lng },
    airportLocation
  ) / 1000;
  
  return pickupDistance <= config.airport.radiusKm || 
         destDistance <= config.airport.radiusKm;
}

/**
 * Calculate distance between two points in kilometers
 * @param {Object} pickup - {lat, lng}
 * @param {Object} destination - {lat, lng}
 * @returns {number} Distance in kilometers
 */
function calculateDistance(pickup, destination) {
  const distance = geolib.getDistance(
    { latitude: pickup.lat, longitude: pickup.lng },
    { latitude: destination.lat, longitude: destination.lng }
  ) / 1000; // Convert to km
  
  return parseFloat(distance.toFixed(2));
}

/**
 * Calculate fare for a ride
 * @param {Object} pickup - {lat, lng, address}
 * @param {Object} destination - {lat, lng, address}
 * @param {number} estimatedDuration - Duration in minutes (optional)
 * @returns {Object} Fare calculation details
 */
function calculateFare(pickup, destination, estimatedDuration = 30) {
  // Validate inputs
  if (!pickup || !destination || !pickup.lat || !pickup.lng || !destination.lat || !destination.lng) {
    throw new Error('Invalid pickup or destination coordinates');
  }
  
  const pickupInNCD = isPointInNCD(pickup);
  const destInNCD = isPointInNCD(destination);
  const withinNCD = pickupInNCD && destInNCD;
  const isAirport = isAirportTrip(pickup, destination);
  const distanceKm = calculateDistance(pickup, destination);
  
  // Scenario 1: Inside NCD (Port Moresby) - Flat rate
  if (withinNCD) {
    let finalFare = config.ncdFlatRate;
    let airportFee = 0;
    let method = 'FLAT_NCD';
    
    // Add airport addon if applicable
    if (isAirport) {
      airportFee = config.airportAddon;
      finalFare = roundToK5(config.ncdFlatRate + airportFee);
      method = 'FLAT_NCD_AIRPORT';
    }
    
    return {
      method: method,
      baseFare: config.ncdFlatRate,
      airportAddon: airportFee,
      distanceKm: distanceKm,
      distanceCharge: 0,
      timeMinutes: estimatedDuration,
      timeCharge: 0,
      subtotal: config.ncdFlatRate + airportFee,
      baseFareRounded: config.ncdFlatRate + airportFee,
      returnFee: 0,
      finalFare: finalFare,
      withinNCD: true,
      isAirportTrip: isAirport,
      breakdown: isAirport 
        ? `K${config.ncdFlatRate} base + K${airportFee} airport fee = K${finalFare}`
        : `Flat rate for rides within Port Moresby (NCD)`,
      passengerDisplay: {
        title: isAirport ? `Estimated Fare: K${finalFare}` : `Estimated Fare: K${finalFare}`,
        subtitle: isAirport ? '✈️ Includes K10 airport access fee' : 'Flat rate for all trips within Port Moresby',
        note: isAirport ? '(Covers waiting time and airport procedures)' : null
      }
    };
  }
  
  // Scenario 2: Outside NCD - Distance-based calculation
  const billableDistance = Math.max(0, distanceKm - config.freeDistanceKm);
  const distanceCharge = billableDistance * config.distanceRate;
  const timeCharge = estimatedDuration * config.timeRate;
  const subtotal = config.baseFare + distanceCharge + timeCharge;
  const baseFareRounded = roundToK5(subtotal);
  
  // Calculate return trip fee (25% of base fare)
  let returnFee = 0;
  if (config.returnFeeEnabled) {
    returnFee = calculatePercentageK5(baseFareRounded, config.returnFeePercentage);
  }
  
  const finalFare = baseFareRounded + returnFee;
  
  return {
    method: 'DISTANCE_BASED',
    baseFare: config.baseFare,
    airportAddon: 0,
    distanceKm: distanceKm,
    distanceCharge: parseFloat(distanceCharge.toFixed(2)),
    timeMinutes: estimatedDuration,
    timeCharge: parseFloat(timeCharge.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    baseFareRounded: baseFareRounded,
    returnFee: returnFee,
    finalFare: finalFare,
    withinNCD: false,
    isAirportTrip: false,
    breakdown: `K${config.baseFare} base + K${distanceCharge.toFixed(2)} distance (${billableDistance.toFixed(1)}km @ K${config.distanceRate}/km) + K${timeCharge.toFixed(2)} time (${estimatedDuration}min @ K${config.timeRate}/min) + K${returnFee} return = K${finalFare}`,
    passengerDisplay: {
      title: `Estimated Fare: K${finalFare}`,
      subtitle: 'Includes:',
      includes: [
        `✓ Trip to ${destination.address || 'destination'} (${distanceKm}km)`,
        '✓ Return costs (driver returns to Port Moresby)'
      ],
      note: 'Remote areas have limited passengers, so return costs are included to ensure driver availability'
    }
  };
}

/**
 * Get current fare configuration (for owner settings page)
 * @returns {Object} Current fare settings
 */
function getFareConfig() {
  return {
    ncdFlatRate: config.ncdFlatRate,
    baseFare: config.baseFare,
    distanceRate: config.distanceRate,
    timeRate: config.timeRate,
    freeDistanceKm: config.freeDistanceKm,
    returnFeeEnabled: config.returnFeeEnabled,
    returnFeePercentage: config.returnFeePercentage,
    airportAddon: config.airportAddon,
    ncdBoundary: config.ncdBoundary,
    airport: config.airport
  };
}

/**
 * Update fare configuration (for owner settings)
 * Note: This updates the in-memory config, not the .env file
 * @param {Object} newConfig - New configuration values
 */
function updateFareConfig(newConfig) {
  Object.assign(config, newConfig);
}

/**
 * Validate fare calculation inputs
 * @param {Object} pickup - Pickup location
 * @param {Object} destination - Destination location
 * @param {number} estimatedDuration - Duration in minutes
 * @returns {Object} Validation result
 */
function validateFareInputs(pickup, destination, estimatedDuration) {
  const errors = [];
  
  if (!pickup || typeof pickup.lat !== 'number' || typeof pickup.lng !== 'number') {
    errors.push('Invalid pickup coordinates');
  }
  
  if (!destination || typeof destination.lat !== 'number' || typeof destination.lng !== 'number') {
    errors.push('Invalid destination coordinates');
  }
  
  if (estimatedDuration && (typeof estimatedDuration !== 'number' || estimatedDuration < 1)) {
    errors.push('Invalid estimated duration');
  }
  
  // Check if pickup and destination are the same
  if (pickup && destination && 
      Math.abs(pickup.lat - destination.lat) < 0.001 && 
      Math.abs(pickup.lng - destination.lng) < 0.001) {
    errors.push('Pickup and destination cannot be the same location');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Calculate commission for a completed ride
 * @param {number} fare - Final fare amount (should be K5-rounded)
 * @param {number} commissionRate - Commission rate (default: 20%)
 * @returns {Object} Commission calculation
 */
function calculateCommission(fare, commissionRate = 0.20) {
  if (!fare || fare <= 0) {
    return {
      fare: 0,
      commissionRate: commissionRate,
      commissionAmount: 0,
      netToCompany: 0
    };
  }
  
  const commissionAmount = calculatePercentageK5(fare, commissionRate * 100);
  const netToCompany = fare - commissionAmount;
  
  return {
    fare: fare,
    commissionRate: commissionRate,
    commissionAmount: commissionAmount,
    netToCompany: netToCompany
  };
}

module.exports = {
  calculateFare,
  isPointInNCD,
  isAirportTrip,
  calculateDistance,
  getFareConfig,
  updateFareConfig,
  validateFareInputs,
  calculateCommission
};
