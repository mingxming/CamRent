const express = require('express');
const router = express.Router();
const Camera = require('../models/Camera');

// 获取所有相机
router.get('/', async (req, res) => {
  try {
    const cameras = await Camera.find();
    res.json(cameras);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 添加新相机
router.post('/', async (req, res) => {
  const camera = new Camera({
    name: req.body.name
  });

  try {
    const newCamera = await camera.save();
    res.status(201).json(newCamera);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// 删除相机
router.delete('/:id', async (req, res) => {
  try {
    await Camera.findByIdAndDelete(req.params.id);
    res.json({ message: 'Camera deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 