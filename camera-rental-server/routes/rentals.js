const express = require('express');
const router = express.Router();
const Rental = require('../models/Rental');

// 获取所有预约
router.get('/', async (req, res) => {
  try {
    const rentals = await Rental.find().populate('cameraId');
    res.json(rentals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 创建新预约
router.post('/', async (req, res) => {
  const rental = new Rental({
    cameraId: req.body.cameraId,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    notes: req.body.notes
  });

  try {
    const newRental = await rental.save();
    res.status(201).json(newRental);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 更新预约
router.put('/:id', async (req, res) => {
  try {
    const rental = await Rental.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(rental);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 取消预约
router.delete('/:id', async (req, res) => {
  try {
    await Rental.findByIdAndUpdate(req.params.id, { status: 'cancelled' });
    res.json({ message: 'Rental cancelled' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 