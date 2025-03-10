import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    redirect: '/camera-rental'
  },
  {
    path: '/camera-rental',
    name: 'CameraRental',
    component: () => import('@/components/CameraRentalCalendar.vue')
  }
]

const router = createRouter({
  history: process.env.NODE_ENV === 'production' 
    ? createWebHashHistory()  // 生产环境使用hash模式，避免服务器路由问题
    : createWebHistory(),
  routes
})

export default router 