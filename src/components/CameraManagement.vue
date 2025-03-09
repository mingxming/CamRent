<template>
  <div class="camera-management-container">
    <!-- 相机列表 -->
    <el-table :data="cameras" style="width: 100%">
      <!-- 相机型号列 -->
      <el-table-column label="相机型号" min-width="150">
        <template #default="{ row }">
          <template v-if="row.editing">
            <el-input
              v-model="row.editName"
              placeholder="相机型号"
              @keyup.enter="saveCameraEdit(row)"
            />
          </template>
          <span v-else>{{ row.name }}</span>
        </template>
      </el-table-column>
      
      <!-- 链接列 -->
      <el-table-column label="相关链接" min-width="200">
        <template #default="{ row }">
          <template v-if="row.editing">
            <el-input
              v-model="row.editLink"
              placeholder="相关链接"
              clearable
            >
              <template #prefix>
                <el-icon><Link /></el-icon>
              </template>
            </el-input>
          </template>
          <a
            v-else-if="row.link"
            :href="row.link.startsWith('http') ? row.link : `https://${row.link}`"
            target="_blank"
            rel="noopener noreferrer"
            class="camera-link"
          >
            {{ row.link }}
          </a>
          <span v-else class="no-link">暂无链接</span>
        </template>
      </el-table-column>
      
      <!-- 操作列 -->
      <el-table-column label="操作" width="200" align="center">
        <template #default="{ row }">
          <div class="operation-buttons">
            <template v-if="row.editing">
              <el-button type="primary" link @click="saveCameraEdit(row)">
                <el-icon><Check /></el-icon>保存
              </el-button>
              <el-button link @click="cancelCameraEdit(row)">
                <el-icon><Close /></el-icon>取消
              </el-button>
            </template>
            <template v-else>
              <el-button type="primary" link @click="editCamera(row)">
                <el-icon><Edit /></el-icon>编辑
              </el-button>
              <el-button type="danger" link @click="deleteCamera(row)">
                <el-icon><Delete /></el-icon>删除
              </el-button>
            </template>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加新相机 -->
    <div class="add-camera-form">
      <el-input
        v-model="newCamera.name"
        placeholder="输入新相机型号"
        @keyup.enter="addCamera"
      />
      <el-input
        v-model="newCamera.link"
        placeholder="输入相关链接（可选）"
        clearable
      >
        <template #prefix>
          <el-icon><Link /></el-icon>
        </template>
      </el-input>
      <el-button type="primary" @click="addCamera">
        <el-icon><Plus /></el-icon>添加相机
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, defineEmits } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Delete, Check, Close, Link, Plus } from '@element-plus/icons-vue'

const emit = defineEmits(['update:cameras', 'refresh'])

const props = defineProps({
  cameras: {
    type: Array,
    required: true
  }
})

const newCamera = ref({
  name: '',
  link: '',
})

// 编辑相机
function editCamera(camera) {
  camera.editing = true
  camera.editName = camera.name
  camera.editLink = camera.link
}

// 保存相机编辑
async function saveCameraEdit(camera) {
  try {
    if (!camera.editName.trim()) {
      throw new Error('相机型号不能为空')
    }
    
    await emit('update:cameras', {
      type: 'update',
      camera: {
        ...camera,
        name: camera.editName.trim(),
        link: camera.editLink.trim()
      }
    })
    
    camera.editing = false
    ElMessage.success('更新成功')
  } catch (error) {
    ElMessage.error(error.message || '更新失败')
  }
}

// 取消编辑
function cancelCameraEdit(camera) {
  camera.editing = false
}

// 删除相机
async function deleteCamera(camera) {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个相机吗？该相机的所有预约记录也将被删除。',
      '删除确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await emit('update:cameras', {
      type: 'delete',
      camera
    })
    
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 添加相机
async function addCamera() {
  try {
    if (!newCamera.value.name.trim()) {
      throw new Error('请输入相机型号')
    }
    
    await emit('update:cameras', {
      type: 'add',
      camera: {
        name: newCamera.value.name.trim(),
        link: newCamera.value.link.trim(),
      }
    })
    
    newCamera.value.name = ''
    newCamera.value.link = ''
    ElMessage.success('添加成功')
  } catch (error) {
    ElMessage.error(error.message || '添加失败')
  }
}
</script>

<style scoped>
.camera-management-container {
  padding: 20px;
}

.add-camera-form {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  display: flex;
  gap: 10px;
  align-items: center;
}

.operation-buttons {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.camera-link {
  color: #409eff;
  text-decoration: none;
}

.camera-link:hover {
  text-decoration: underline;
}

.no-link {
  color: #909399;
  font-style: italic;
}

:deep(.el-input) {
  max-width: 300px;
}

:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style> 