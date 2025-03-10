import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const PORT = process.env.PORT || 3000;

// 获取 __dirname 的替代方案
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'dist')));

// 创建数据库连接
let db;
async function setupDatabase() {
  // 打开数据库连接
  db = await open({
    filename: process.env.NODE_ENV === 'production'
      ? '/data/camera_rental.db'
      : join(__dirname, 'camera_rental.db'),
    driver: sqlite3.Database
  });

  // 创建相机表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS cameras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      link TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建租赁表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      camera_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      notes TEXT,
      color TEXT DEFAULT '#409eff',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (camera_id) REFERENCES cameras (id)
    )
  `);

  console.log('Database setup complete');
}

// API端点 - 相机
app.get('/api/cameras', async (req, res) => {
  try {
    const cameras = await db.all('SELECT * FROM cameras ORDER BY name');
    res.json(cameras);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cameras', async (req, res) => {
  try {
    const { name, link } = req.body;
    if (!name) return res.status(400).json({ error: '相机名称无效' });

    const result = await db.run(
      'INSERT INTO cameras (name, link) VALUES (?, ?)',
      [name.trim(), link || '']
    );
    
    const newCamera = await db.get('SELECT * FROM cameras WHERE id = ?', result.lastID);
    res.status(201).json(newCamera);
  } catch (error) {
    // 处理唯一约束冲突
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '相机型号已存在' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cameras/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, link } = req.body;
    
    if (name) {
      await db.run(
        'UPDATE cameras SET name = ?, link = ? WHERE id = ?',
        [name.trim(), link || '', id]
      );
    } else {
      await db.run(
        'UPDATE cameras SET link = ? WHERE id = ?',
        [link || '', id]
      );
    }
    
    const updatedCamera = await db.get('SELECT * FROM cameras WHERE id = ?', id);
    if (!updatedCamera) return res.status(404).json({ error: '相机不存在' });
    
    res.json(updatedCamera);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: '相机型号已存在' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cameras/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 删除相关的租赁记录
    await db.run('DELETE FROM rentals WHERE camera_id = ?', id);
    
    // 删除相机
    const result = await db.run('DELETE FROM cameras WHERE id = ?', id);
    if (result.changes === 0) return res.status(404).json({ error: '相机不存在' });
    
    res.json({ message: '相机已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 检查日期冲突的辅助函数
async function hasDateConflict(rentalData, excludeId = null) {
  const { camera_id, start_date, end_date } = rentalData;
  
  console.log('检查冲突 - 相机ID:', camera_id);  
  console.log('检查冲突 - 开始日期:', start_date); 
  console.log('检查冲突 - 结束日期:', end_date); 
  console.log('排除ID:', excludeId);
  
  // 确保我们完全使用字符串比较，不创建日期对象
  const startStr = typeof start_date === 'string' ? start_date : start_date.toISOString().split('T')[0];
  const endStr = typeof end_date === 'string' ? end_date : end_date.toISOString().split('T')[0];
  
  const conflictQuery = `
    SELECT * FROM rentals 
    WHERE camera_id = ? 
    AND status = 'active'
    AND id != ?
    AND NOT (end_date < ? OR start_date > ?)
  `;
  
  const conflicts = await db.all(
    conflictQuery,
    [camera_id, excludeId || 0, startStr, endStr]
  );
  
  if (conflicts.length > 0) {
    console.log('发现冲突:', conflicts);
  } else {
    console.log('无冲突');
  }
  
  return conflicts.length > 0;
}

// API端点 - 租赁
app.get('/api/rentals', async (req, res) => {
  try {
    const rentals = await db.all(`
      SELECT r.*, c.name as camera_name 
      FROM rentals r
      JOIN cameras c ON r.camera_id = c.id
      ORDER BY r.start_date
    `);
    res.json(rentals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rentals', async (req, res) => {
  try {
    const { cameraId, startDate, endDate, notes, color } = req.body;
    
    if (!cameraId || !startDate || !endDate) {
      return res.status(400).json({ error: '预约信息不完整' });
    }
    
    // 验证日期
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({ error: '结束日期必须晚于开始日期' });
    }
    
    // 检查冲突
    const rentalData = {
      camera_id: cameraId,
      start_date: startDate,
      end_date: endDate
    };
    
    if (await hasDateConflict(rentalData)) {
      return res.status(400).json({ error: '该时间段已被预约' });
    }
    
    // 插入记录
    const result = await db.run(
      `INSERT INTO rentals (camera_id, start_date, end_date, notes, color) 
       VALUES (?, ?, ?, ?, ?)`,
      [cameraId, startDate, endDate, notes || '', color || '#409eff']
    );
    
    const newRental = await db.get('SELECT * FROM rentals WHERE id = ?', result.lastID);
    res.status(201).json(newRental);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rentals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { cameraId, startDate, endDate, notes, color, status } = req.body;
    
    console.log('接收到的更新请求 - ID:', id);
    console.log('开始日期:', startDate);
    console.log('结束日期:', endDate);
    
    // 创建可变的副本，而不是直接修改常量
    let updatedStartDate = startDate;
    let updatedEndDate = endDate;
    
    // 检查是否是移动操作（有startDate但没有改变租期长度）
    if (updatedStartDate !== undefined && updatedEndDate !== undefined) {
      // 获取当前记录
      const currentRental = await db.get('SELECT * FROM rentals WHERE id = ?', id);
      if (currentRental) {
        // 计算原始租期天数
        const origStart = new Date(currentRental.start_date);
        const origEnd = new Date(currentRental.end_date);
        const originalDays = Math.round((origEnd - origStart) / (1000 * 60 * 60 * 24)) + 1;
        
        // 计算新的租期天数
        const newStart = new Date(updatedStartDate);
        const newEnd = new Date(updatedEndDate);
        const newDays = Math.round((newEnd - newStart) / (1000 * 60 * 60 * 24)) + 1;
        
        // 如果新的租期比原来短，可能是拖拽导致的问题
        if (newDays < originalDays) {
          console.log('检测到租期缩短，从', originalDays, '天到', newDays, '天');
          console.log('修正为保持原始租期天数');
          
          // 使用原始天数和新的开始日期计算正确的结束日期
          const correctEnd = new Date(updatedStartDate);
          correctEnd.setDate(correctEnd.getDate() + originalDays - 1);
          
          updatedEndDate = correctEnd.toISOString().split('T')[0];  // 使用可变变量
          console.log('修正后的结束日期:', updatedEndDate);
        }
      }
    }
    
    // 获取当前记录
    const currentRental = await db.get('SELECT * FROM rentals WHERE id = ?', id);
    if (!currentRental) return res.status(404).json({ error: '预约不存在' });
    
    // 准备更新数据
    const updates = {};
    if (cameraId !== undefined) updates.camera_id = cameraId;
    
    // 处理日期 - 标准化为 YYYY-MM-DD 格式
    if (updatedStartDate !== undefined) {
      // 直接使用前端传来的日期字符串，避免任何日期对象转换
      updates.start_date = updatedStartDate.split('T')[0];
      console.log('处理后的开始日期:', updates.start_date);
    }
    
    if (updatedEndDate !== undefined) {
      // 确保我们不做任何日期对象转换，直接使用字符串
      updates.end_date = updatedEndDate.split('T')[0];
      console.log('处理后的结束日期:', updates.end_date);
    }
    
    // 记录最终更新值
    console.log('处理后的更新 - 开始:', updates.start_date, '结束:', updates.end_date);
    
    if (notes !== undefined) updates.notes = notes;
    if (color !== undefined) updates.color = color;
    if (status !== undefined) updates.status = status;
    
    // 检查冲突
    if (updates.start_date || updates.end_date || updates.camera_id) {
      const rentalData = {
        camera_id: updates.camera_id || currentRental.camera_id,
        start_date: updates.start_date || currentRental.start_date,
        end_date: updates.end_date || currentRental.end_date
      };
      
      if (await hasDateConflict(rentalData, id)) {
        return res.status(400).json({ error: '该时间段已被预约' });
      }
    }
    
    // 构建SQL语句
    const keys = Object.keys(updates);
    if (keys.length === 0) return res.json(currentRental);
    
    const setClauses = keys.map(key => `${key} = ?`).join(', ');
    const values = keys.map(key => updates[key]);
    values.push(id);
    
    await db.run(`UPDATE rentals SET ${setClauses} WHERE id = ?`, values);
    
    const updatedRental = await db.get('SELECT * FROM rentals WHERE id = ?', id);
    res.json(updatedRental);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rentals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 这里我们实际上是更新状态而不是真正删除
    const result = await db.run(
      'UPDATE rentals SET status = ? WHERE id = ?',
      ['cancelled', id]
    );
    
    if (result.changes === 0) return res.status(404).json({ error: '预约不存在' });
    
    res.json({ message: '预约已取消' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加一个特殊的端点专门用于处理租期移动
app.post('/api/rentals/:id/move', async (req, res) => {
  try {
    const { id } = req.params;
    const { newStartDate, rentalDays, cameraId } = req.body;
    
    console.log('***** 移动端点被调用 *****');
    console.log('接收到的移动请求 - ID:', id);
    console.log('新开始日期:', newStartDate);
    console.log('租期天数:', rentalDays);
    console.log('相机ID:', cameraId);
    
    // 获取当前记录
    const currentRental = await db.get('SELECT * FROM rentals WHERE id = ?', id);
    if (!currentRental) return res.status(404).json({ error: '预约不存在' });
    
    // 计算新的结束日期 (保持租期天数不变)
    const start = new Date(newStartDate);
    const end = new Date(newStartDate);
    end.setDate(end.getDate() + rentalDays - 1); // -1 因为开始日期已经算一天
    
    const formattedStartDate = start.toISOString().split('T')[0];
    const formattedEndDate = end.toISOString().split('T')[0];
    
    console.log('计算后的日期 - 开始:', formattedStartDate, '结束:', formattedEndDate);
    
    // 检查冲突
    const rentalData = {
      camera_id: cameraId || currentRental.camera_id,
      start_date: formattedStartDate,
      end_date: formattedEndDate
    };
    
    if (await hasDateConflict(rentalData, id)) {
      return res.status(400).json({ error: '该时间段已被预约' });
    }
    
    // 更新记录
    await db.run(
      'UPDATE rentals SET start_date = ?, end_date = ?, camera_id = ? WHERE id = ?',
      [formattedStartDate, formattedEndDate, cameraId || currentRental.camera_id, id]
    );
    
    const updatedRental = await db.get('SELECT * FROM rentals WHERE id = ?', id);
    res.json(updatedRental);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 处理事件调整大小的特殊端点
app.post('/api/rentals/:id/resize', async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, cameraId } = req.body;
    
    console.log('接收到的调整大小请求 - ID:', id);
    console.log('开始日期:', startDate);
    console.log('结束日期:', endDate);
    
    // 获取当前记录
    const currentRental = await db.get('SELECT * FROM rentals WHERE id = ?', id);
    if (!currentRental) return res.status(404).json({ error: '预约不存在' });
    
    // 验证日期
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({ error: '结束日期必须晚于或等于开始日期' });
    }
    
    // 检查冲突
    const rentalData = {
      camera_id: cameraId || currentRental.camera_id,
      start_date: startDate,
      end_date: endDate
    };
    
    if (await hasDateConflict(rentalData, id)) {
      return res.status(400).json({ error: '该时间段已被预约' });
    }
    
    // 更新记录
    await db.run(
      'UPDATE rentals SET start_date = ?, end_date = ?, camera_id = ? WHERE id = ?',
      [startDate, endDate, cameraId || currentRental.camera_id, id]
    );
    
    const updatedRental = await db.get('SELECT * FROM rentals WHERE id = ?', id);
    res.json(updatedRental);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 前端路由支持
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// 启动服务器
(async function() {
  try {
    await setupDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
  }
})(); 