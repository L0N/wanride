// Central export file for all database models
// This provides a clean way to import all models from a single location

const User = require('./User');
const Ride = require('./Ride');
const Referral = require('./Referral');
const Document = require('./Document');
const Session = require('./Session');

module.exports = {
  User,
  Ride,
  Referral,
  Document,
  Session
};

// Alternative individual exports for convenience
module.exports.models = {
  User,
  Ride,
  Referral,
  Document,
  Session
};

// Model validation helper
module.exports.validateModels = () => {
  const models = [User, Ride, Referral, Document, Session];
  const results = {};
  
  models.forEach(Model => {
    try {
      // Check if model is properly defined
      if (!Model || !Model.modelName) {
        throw new Error(`Invalid model: ${Model}`);
      }
      
      // Check if model has required methods
      const requiredMethods = ['find', 'findOne', 'create', 'updateOne', 'deleteOne'];
      const missingMethods = requiredMethods.filter(method => typeof Model[method] !== 'function');
      
      if (missingMethods.length > 0) {
        throw new Error(`Missing methods: ${missingMethods.join(', ')}`);
      }
      
      results[Model.modelName] = {
        status: 'valid',
        schema: Model.schema ? Object.keys(Model.schema.paths).length : 0,
        indexes: Model.schema ? Model.schema.indexes().length : 0
      };
    } catch (error) {
      results[Model.modelName || 'unknown'] = {
        status: 'invalid',
        error: error.message
      };
    }
  });
  
  return results;
};

// Schema relationship helper
module.exports.getRelationships = () => {
  return {
    User: {
      hasMany: ['Ride', 'Document', 'Session', 'Referral'],
      references: ['Referral.referrer', 'Ride.client', 'Ride.driver', 'Document.owner', 'Session.user']
    },
    Ride: {
      belongsTo: ['User'],
      references: ['User.client', 'User.driver', 'Referral.referrer']
    },
    Referral: {
      belongsTo: ['User'],
      hasMany: ['User'],
      references: ['User.referrer', 'User.appliedBy.user']
    },
    Document: {
      belongsTo: ['User'],
      references: ['User.owner', 'User.verifiedBy']
    },
    Session: {
      belongsTo: ['User'],
      references: ['User.user', 'User.revokedBy']
    }
  };
};

