const mongoose = require('mongoose');

const cameraSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['available', 'maintenance'],
    default: 'available'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Camera', cameraSchema); 