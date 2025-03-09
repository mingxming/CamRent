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

export const dataService = {
  // 获取所有相机
  getCameras() {
    try {
      return JSON.parse(localStorage.getItem('cameras') || '[]')
    } catch (error) {
      console.error('Error reading cameras:', error)
      return []
    }
  },

  // 添加相机
  addCamera(cameraData) {
    if (!cameraData.name || typeof cameraData.name !== 'string') {
      throw new Error('相机名称无效')
    }
    
    const cameras = this.getCameras()
    // 简化名称处理
    const normalizedName = cameraData.name.trim()
    
    // 不区分大小写的重复检查
    if (cameras.some(c => c.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw new Error('相机型号已存在')
    }

    const newId = Math.max(...cameras.map(c => c.id), 0) + 1
    const newCamera = {
      id: newId,
      name: normalizedName,
      link: cameraData.link || '',
    }
    cameras.push(newCamera)
    localStorage.setItem('cameras', JSON.stringify(cameras))
    return newCamera
  },

  // 删除相机
  deleteCamera(id) {
    const cameras = this.getCameras()
    const index = cameras.findIndex(c => c.id === id)
    if (index > -1) {
      cameras.splice(index, 1)
      localStorage.setItem('cameras', JSON.stringify(cameras))
      
      // 同时删除该相机的所有预约记录
      const rentals = this.getRentals()
      const updatedRentals = rentals.filter(rental => rental.cameraId !== id)
      localStorage.setItem('rentals', JSON.stringify(updatedRentals))
      
      return true
    }
    return false
  },

  // 获取所有预约
  getRentals() {
    try {
      return JSON.parse(localStorage.getItem('rentals') || '[]')
    } catch (error) {
      console.error('Error reading rentals:', error)
      return []
    }
  },

  // 添加预约
  addRental(rental) {
    // 验证输入
    if (!rental.cameraId || !rental.startDate || !rental.endDate) {
      throw new Error('预约信息不完整')
    }
    
    // 验证日期
    const start = new Date(rental.startDate)
    const end = new Date(rental.endDate)
    if (start > end) {
      throw new Error('结束日期必须晚于开始日期')
    }

    const rentals = this.getRentals()
    
    // 检查日期冲突
    if (hasDateConflict(rentals, rental)) {
      throw new Error('该时间段已被预约')
    }

    const newRental = {
      id: Date.now(),
      ...rental,
      color: rental.color || '#409eff',
      status: 'active'
    }
    rentals.push(newRental)
    localStorage.setItem('rentals', JSON.stringify(rentals))
    return newRental
  },

  // 更新预约
  updateRental(id, updates) {
    if (!id || !updates) {
      throw new Error('更新信息不完整')
    }

    const rentals = this.getRentals()
    const index = rentals.findIndex(r => r.id === id)
    if (index > -1) {
      // 检查日期冲突
      if (updates.startDate || updates.endDate || updates.cameraId) {
        const updatedRental = {
          ...rentals[index],
          ...updates
        }
        
        // 验证日期
        if (updatedRental.startDate && updatedRental.endDate) {
          const start = new Date(updatedRental.startDate)
          const end = new Date(updatedRental.endDate)
          if (start > end) {
            throw new Error('结束日期必须晚于或等于开始日期')
          }
        }
        
        if (hasDateConflict(rentals, updatedRental, id)) {
          throw new Error('该时间段已被预约')
        }
      }

      rentals[index] = {
        ...rentals[index],
        ...updates,
        color: updates.color || rentals[index].color || '#409eff'
      }
      localStorage.setItem('rentals', JSON.stringify(rentals))
      return rentals[index]
    }
    return null
  },

  // 取消预约
  cancelRental(id) {
    if (!id) {
      throw new Error('预约ID无效')
    }

    const rentals = this.getRentals()
    const index = rentals.findIndex(r => r.id === id)
    if (index > -1) {
      if (rentals[index].status === 'cancelled') {
        throw new Error('该预约已经取消')
      }
      rentals[index].status = 'cancelled'
      localStorage.setItem('rentals', JSON.stringify(rentals))
      return true
    }
    throw new Error('预约不存在')
  },

  // 添加更新相机方法
  updateCamera(id, updates) {
    const cameras = this.getCameras()
    const index = cameras.findIndex(c => c.id === id)
    if (index === -1) {
      throw new Error('相机不存在')
    }
    
    const normalizedName = updates.name ? updates.name.trim() : cameras[index].name
    
    if (updates.name && cameras.some(c => c.name.toLowerCase() === normalizedName.toLowerCase() && c.id !== id)) {
      throw new Error('相机型号已存在')
    }

    cameras[index] = {
      ...cameras[index],
      ...updates,
      name: normalizedName,
    }
    
    localStorage.setItem('cameras', JSON.stringify(cameras))
    return cameras[index]
  },
} 