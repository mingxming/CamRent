// 定义角色类型
export const Roles = {
  ADMIN: 'admin',
  VISITOR: 'visitor'
}

// 模拟登录状态存储
const AUTH_KEY = 'camera_rental_auth'

export const authService = {
  // 获取当前用户角色
  getCurrentRole() {
    return localStorage.getItem(AUTH_KEY) || Roles.VISITOR
  },

  // 检查是否是管理员
  isAdmin() {
    return this.getCurrentRole() === Roles.ADMIN
  },

  // 登录
  login(password) {
    // 这里使用一个简单的密码验证，实际应用中应该使用更安全的方式
    if (password === 'admin123') {  // 示例密码
      localStorage.setItem(AUTH_KEY, Roles.ADMIN)
      return true
    }
    return false
  },

  // 登出
  logout() {
    localStorage.setItem(AUTH_KEY, Roles.VISITOR)
  }
} 