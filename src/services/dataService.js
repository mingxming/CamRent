// 初始相机数据
const initialCameras = [
  // 清空初始数据
  []
]

// 初始化本地存储
if (!localStorage.getItem('cameras')) {
  localStorage.setItem('cameras', JSON.stringify(initialCameras))
}
if (!localStorage.getItem('rentals')) {
  localStorage.setItem('rentals', JSON.stringify([]))
}

// 检查日期冲突
function hasDateConflict(rentals, newRental, excludeId = null) {
  return rentals.some(rental => {
    // 排除已取消和自身的预约
    if (rental.status === 'cancelled' || rental.id === excludeId) {
      return false
    }

    // 直接使用日期字符串比较
    const start1 = rental.startDate
    const end1 = rental.endDate
    const start2 = newRental.startDate
    const end2 = newRental.endDate

    // 检查是否是同一个相机且日期有重叠
    if (rental.cameraId === newRental.cameraId) {
      // 使用字符串比较，end2 和 start1 相等时允许拼接
      return start1 < end2 && end1 > start2
    }
    return false
  })
}

// 定义API基础URL
const API_BASE_URL = 'http://localhost:3000/api';
export { API_BASE_URL };

export const dataService = {
  // 获取所有相机
  async getCameras() {
    try {
      const response = await fetch(`${API_BASE_URL}/cameras`);
      if (!response.ok) {
        throw new Error('获取相机失败');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching cameras:', error);
      return [];
    }
  },

  // 添加相机
  async addCamera(cameraData) {
    if (!cameraData.name || typeof cameraData.name !== 'string') {
      throw new Error('相机名称无效');
    }
    
    const response = await fetch(`${API_BASE_URL}/cameras`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: cameraData.name,
        link: cameraData.link || ''
      })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '添加相机失败');
    }
    
    return await response.json();
  },

  // 更新相机
  async updateCamera(id, updates) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '更新相机失败');
    }
    
    return await response.json();
  },

  // 删除相机
  async deleteCamera(id) {
    const response = await fetch(`${API_BASE_URL}/cameras/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '删除相机失败');
    }
    
    return true;
  },

  // 获取所有预约
  async getRentals() {
    try {
      const response = await fetch(`${API_BASE_URL}/rentals`);
      if (!response.ok) {
        throw new Error('获取预约失败');
      }
      const data = await response.json();
      if (!Array.isArray(data)) {
        console.error('API返回的租赁数据不是数组:', data);
        return [];
      }
      
      return data.map(rental => ({
        id: rental.id,
        cameraId: rental.camera_id,
        startDate: rental.start_date,
        endDate: rental.end_date,
        notes: rental.notes,
        color: rental.color,
        status: rental.status,
        cameraName: rental.camera_name
      }));
    } catch (error) {
      console.error('Error fetching rentals:', error);
      return [];
    }
  },

  // 添加预约
  async addRental(rental) {
    // 验证输入
    if (!rental.cameraId || !rental.startDate || !rental.endDate) {
      throw new Error('预约信息不完整');
    }
    
    const response = await fetch(`${API_BASE_URL}/rentals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        cameraId: rental.cameraId,
        startDate: rental.startDate,
        endDate: rental.endDate,
        notes: rental.notes || '',
        color: rental.color || '#409eff'
      })
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '添加预约失败');
    }
    
    const newRental = await response.json();
    return {
      id: newRental.id,
      cameraId: newRental.camera_id,
      startDate: newRental.start_date,
      endDate: newRental.end_date,
      notes: newRental.notes,
      color: newRental.color,
      status: newRental.status
    };
  },

  // 更新预约
  async updateRental(id, updates) {
    if (!id) {
      throw new Error('更新信息不完整');
    }
    
    // 转换字段名称以匹配后端
    const apiUpdates = {};
    if (updates.cameraId !== undefined) apiUpdates.cameraId = updates.cameraId;
    if (updates.startDate !== undefined) apiUpdates.startDate = updates.startDate;
    if (updates.endDate !== undefined) apiUpdates.endDate = updates.endDate;
    if (updates.notes !== undefined) apiUpdates.notes = updates.notes;
    if (updates.color !== undefined) apiUpdates.color = updates.color;
    if (updates.status !== undefined) apiUpdates.status = updates.status;
    
    console.log('发送到API的更新:', apiUpdates);
    
    const response = await fetch(`${API_BASE_URL}/rentals/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(apiUpdates)
    });
    
    if (!response.ok) {
      const data = await response.json();
      console.error('API错误:', data);
      throw new Error(data.error || '更新预约失败');
    }
    
    const updatedRental = await response.json();
    return {
      id: updatedRental.id,
      cameraId: updatedRental.camera_id,
      startDate: updatedRental.start_date,
      endDate: updatedRental.end_date,
      notes: updatedRental.notes,
      color: updatedRental.color,
      status: updatedRental.status
    };
  },

  // 取消预约
  async cancelRental(id) {
    if (!id) {
      throw new Error('预约ID无效');
    }
    
    const response = await fetch(`${API_BASE_URL}/rentals/${id}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '取消预约失败');
    }
    
    return true;
  }
}; 