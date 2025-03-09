<template>
  <el-form :model="form" label-width="100px">
    <el-form-item label="租赁时间">
      <el-date-picker
        v-model="form.startTime"
        type="date"
        placeholder="选择日期"
        value-format="YYYY-MM-DD"
        @update:model-value="updateEndDate"
      />
      <span class="date-hint">默认租赁一天</span>
    </el-form-item>
    <el-form-item label="备注">
      <el-input
        v-model="form.notes"
        type="textarea"
        placeholder="请输入租赁备注"
      />
    </el-form-item>
    <el-form-item label="颜色">
      <div class="color-options">
        <div
          v-for="option in presetColors"
          :key="option.color"
          class="color-option"
          :class="{ active: form.color === option.color }"
          :style="{ backgroundColor: option.color }"
          @click="form.color = option.color"
        >
          <el-icon v-if="form.color === option.color"><Check /></el-icon>
        </div>
      </div>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, defineProps, defineEmits, watch } from 'vue'
import { Check } from '@element-plus/icons-vue'

const props = defineProps({
  initialData: {
    type: Object,
    default: () => ({
      startTime: '',
      endTime: '',
      notes: '',
      color: '#409eff'
    })
  }
})

const emit = defineEmits(['update:form'])

const form = ref({ ...props.initialData })

// 预设的颜色选项
const presetColors = [
  { color: '#409eff', label: '蓝色' },
  { color: '#67c23a', label: '绿色' },
  { color: '#e6a23c', label: '黄色' },
  { color: '#f56c6c', label: '红色' },
  { color: '#909399', label: '灰色' },
  { color: '#9c27b0', label: '紫色' },
  { color: '#ff9800', label: '橙色' },
  { color: '#795548', label: '棕色' }
]

// 监听表单变化并向父组件发送更新
watch(form, (newValue) => {
  emit('update:form', newValue)
}, { deep: true })

// 添加新函数，当开始日期变化时自动更新结束日期
function updateEndDate(date) {
  if (date) {
    form.value.endTime = date
  }
}
</script>

<style scoped>
.color-options {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.color-option {
  width: 30px;
  height: 30px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.active {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--el-color-primary);
}

.color-option .el-icon {
  color: white;
  font-size: 16px;
}

.date-hint {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}
</style> 