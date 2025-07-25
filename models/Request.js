console.log('Received a help request submission');
const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 1,
    max: 120
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  helpType: {
    type: String,
    required: true,
    enum: ['Medical Assistance', 'Grocery Shopping', 'Transportation', 'Home Maintenance', 'Companionship', 'Emergency', 'Other']
  },
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Completed'],
    default: 'Pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  assignedVolunteer: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Volunteer' },
    name: String,
    email: String,
    phone: String
  }
});

module.exports = mongoose.model('Request', requestSchema);

