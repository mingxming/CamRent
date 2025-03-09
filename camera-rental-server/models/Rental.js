const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  cameraId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Camera',
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['active', 'cancelled'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Rental', rentalSchema); 