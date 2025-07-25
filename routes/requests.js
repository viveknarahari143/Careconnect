const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const Volunteer = require('../models/Volunteer');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const nodemailer = require('nodemailer');
// POST /api/requests - Add a new request
router.post('/', async (req, res) => {
  try {
    const { name, age, phone, address, helpType, notes } = req.body;
    
    // Validate required fields
    if (!name || !age || !phone || !address || !helpType) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, age, phone, address, helpType' 
      });
    }

    const newRequest = new Request({
      name,
      age,
      phone,
      address,
      helpType,
      notes: notes || ''
    });

    const savedRequest = await newRequest.save();

    // Nodemailer: Notify all volunteers
    try {
      const volunteers = await Volunteer.find({}, 'email name');
      console.log('Sending emails to volunteers:', volunteers.map(v => v.email));
      // Debug: log Gmail credentials
      console.log('GMAIL_USER:', process.env.GMAIL_USER);
      console.log('GMAIL_PASS:', process.env.GMAIL_PASS ? '***' : 'MISSING');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_PASS
        }
      });
      const emailPromises = volunteers.map(vol => {
        return transporter.sendMail({
          from: `CareConnect <${process.env.GMAIL_USER}>`,
          to: vol.email,
          subject: 'New Help Request Submitted',
          text: `A new help request has been submitted by ${name} for ${helpType}. Phone: ${phone}. Please check the dashboard to accept.`,
          html: `<p>A new help request has been submitted by <b>${name}</b> for <b>${helpType}</b>.<br>Phone: <b>${phone}</b><br>Please check the dashboard to accept.</p>`
        }).then(info => {
          console.log(`Email sent to ${vol.email}:`, info.response);
        }).catch(err => {
          console.error(`Failed to send email to ${vol.email}:`, err);
        });
      });
      await Promise.all(emailPromises);
    } catch (emailErr) {
      console.error('Failed to send volunteer alert emails:', emailErr);
    }

    res.status(201).json({
      message: 'Help request submitted successfully',
      request: savedRequest
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Failed to submit help request' });
  }
});

// GET /api/requests - List all requests
router.get('/', async (req, res) => {
  try {
    const requests = await Request.find().sort({ createdAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch help requests' });
  }
});

// PUT /api/requests/:id - Update status of a request
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['Pending', 'In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be: Pending, In Progress, or Completed' 
      });
    }

    let update = { status };
    // If volunteer is logged in and status is set to In Progress, assign volunteer
    if (
      req.session &&
      req.session.role === 'volunteer' &&
      req.session.volunteerId &&
      status === 'In Progress'
    ) {
      const volunteer = await Volunteer.findById(req.session.volunteerId);
      if (volunteer) {
        update.assignedVolunteer = {
          _id: volunteer._id,
          name: volunteer.name,
          email: volunteer.email,
          phone: volunteer.phone
        };
      }
    }

    const updatedRequest = await Request.findByIdAndUpdate(
      id,
      update,
      { new: true, runValidators: true }
    );

    if (!updatedRequest) {
      return res.status(404).json({ error: 'Help request not found' });
    }

    res.json({
      message: 'Request status updated successfully',
      request: updatedRequest
    });
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ error: 'Failed to update request status' });
  }
});

// DELETE /api/requests/:id - Remove a request (optional)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedRequest = await Request.findByIdAndDelete(id);
    
    if (!deletedRequest) {
      return res.status(404).json({ error: 'Help request not found' });
    }

    res.json({
      message: 'Request deleted successfully',
      request: deletedRequest
    });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ error: 'Failed to delete request' });
  }
});

module.exports = router;

