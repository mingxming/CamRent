import { createRouter, createWebHistory } from 'vue-router'

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
  history: createWebHistory(),
  routes
})

export default router 