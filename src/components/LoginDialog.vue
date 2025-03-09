<template>
  <el-dialog
    :modelValue="visible"
    @update:modelValue="$emit('update:visible', $event)"
    title="管理员登录"
    width="400px"
    :close-on-click-modal="false"
  >
    <el-form :model="form" @submit.prevent="handleLogin">
      <el-form-item>
        <el-input
          v-model="form.password"
          type="password"
          placeholder="请输入管理员密码"
          show-password
          @keyup.enter="handleLogin"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" @click="handleLogin">登录</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { authService } from '../services/authService'

const props = defineProps({
  visible: Boolean
})

const emit = defineEmits(['update:visible', 'login-success'])

const form = ref({
  password: ''
})

async function handleLogin() {
  if (authService.login(form.value.password)) {
    ElMessage.success('登录成功')
    emit('login-success')
    emit('update:visible', false)
    form.value.password = ''
  } else {
    ElMessage.error('密码错误')
  }
}
</script> 