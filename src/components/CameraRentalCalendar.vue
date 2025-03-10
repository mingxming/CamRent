<template>
  <div class="camera-rental-system">
    <!-- 添加登录状态和按钮 -->
    <div class="auth-controls">
      <template v-if="isAdmin">
        <el-button type="primary" @click="showCameraManagement">
          <el-icon><Setting /></el-icon>相机管理
        </el-button>
        <el-button @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>退出管理
        </el-button>
      </template>
      <el-button v-else type="primary" @click="loginDialogVisible = true">
        <el-icon><User /></el-icon>管理员登录
      </el-button>
    </div>
    
    <div class="calendar-container">
      <FullCalendar
        ref="calendarRef"
        :options="calendarOptions"
        class="rental-calendar"
      />
    </div>
    
    <!-- 相机管理对话框 -->
    <el-dialog
      v-model="cameraManagementVisible"
      title="相机管理"
      width="800px"
    >
      <camera-management
        :cameras="cameras"
        @update:cameras="handleCameraUpdate"
      />
      <template #footer>
        <el-button @click="cameraManagementVisible = false">关闭</el-button>
      </template>
    </el-dialog>
    
    <!-- 租赁表单对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="预约相机租赁"
      width="500px"
    >
      <rental-form
        v-model:form="rentalForm"
        :initial-data="rentalForm"
      />
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitRental">确认预约</el-button>
      </template>
    </el-dialog>

    <!-- 使用 v-loading 指令 -->
    <div v-loading.fullscreen.lock="isLoading"
      element-loading-text="加载中..."
      element-loading-background="rgba(0, 0, 0, 0.8)">
    </div>
    
    <!-- 错误提示 -->
    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      @close="errorMessage = ''"
      style="margin-bottom: 20px;"
    />

    <!-- 事件编辑对话框 -->
    <el-dialog
      v-model="eventEditDialogVisible"
      title="编辑预约"
      width="500px"
    >
      <rental-form
        v-model:form="eventEditForm"
        :initial-data="eventEditForm"
      />
      <template #footer>
        <el-button @click="eventEditDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="updateEvent">保存修改</el-button>
        <el-button type="danger" @click="cancelRental">取消预约</el-button>
      </template>
    </el-dialog>

    <!-- 添加登录对话框 -->
    <login-dialog
      v-model:visible="loginDialogVisible"
      @login-success="handleLoginSuccess"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Setting, Check, User, SwitchButton } from '@element-plus/icons-vue'
import FullCalendar from '@fullcalendar/vue3'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import interactionPlugin from '@fullcalendar/interaction'
import zhCn from '@fullcalendar/core/locales/zh-cn'
import { dataService } from '../services/dataService'
import { API_BASE_URL } from '../services/dataService'
import { ElLoading } from 'element-plus'
import RentalForm from './RentalForm.vue'
import CameraManagement from './CameraManagement.vue'
import { authService } from '../services/authService'
import LoginDialog from './LoginDialog.vue'
import { formatDateToYYYYMMDD, getEndDateFromEvent } from '../utils/dateUtils'

// 相机列表数据
const cameras = ref([])

// 将相机数据转换为资源格式
const resources = ref([])

// 租赁记录数据
const events = ref([])

// 表单数据
const dialogVisible = ref(false)
const rentalForm = ref({
  cameraId: '',
  startTime: '',
  endTime: '',
  notes: '',
  color: '#409eff'
})

// 相机管理相关的状态
const cameraManagementVisible = ref(false)
const newCamera = ref({
  name: '',
  link: ''
})

// 日历实例引用
const calendarRef = ref(null)

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

// 权限相关状态
const loginDialogVisible = ref(false)
const isAdmin = computed(() => authService.isAdmin())

// 添加新的状态变量
const isLoading = ref(false)
const errorMessage = ref('')

// 事件编辑表单数据
const eventEditDialogVisible = ref(false)
const eventEditForm = ref({
  id: null,
  startDate: '',
  endDate: '',
  notes: '',
  color: '#409eff',
  event: null // 存储当前编辑的事件对象
})

// 处理登录成功
function handleLoginSuccess() {
  fetchCameras()
  fetchRentals()
}

// 处理登出
function handleLogout() {
  authService.logout()
  ElMessage.success('已退出管理模式')
}

// 日历配置
const calendarOptions = ref({
  plugins: [resourceTimelinePlugin, interactionPlugin],
  initialView: 'resourceTimelineMonth',
  initialDate: new Date(),  // 设置初始日期为今天
  resources: resources,
  locale: zhCn,
  headerToolbar: {
    left: 'prev,next today',  // 允许所有用户使用导航按钮
    center: 'title',
    right: 'resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth'  // 允许所有用户切换视图
  },
  selectable: computed(() => isAdmin.value),
  editable: true,
  eventStartEditable: true,
  eventResizableFromStart: false,
  eventDurationEditable: true,
  // 禁用日期选择
  selectConstraint: computed(() => isAdmin.value ? {
    startTime: '00:00',
    endTime: '24:00',
  } : false),
  // 禁用事件拖拽
  eventDragStart: function(info) {
    // 保存原始事件信息
    const originalData = info.event.extendedProps.rentalData;
    
    // 计算并保存原始租期天数
    if (originalData) {
      const origStart = new Date(originalData.startDate);
      const origEnd = new Date(originalData.endDate);
      const rentalDays = Math.round((origEnd - origStart) / (1000 * 60 * 60 * 24)) + 1;
      console.log("原始租期天数(事件开始前):", rentalDays);
      
      // 添加到event对象以便在移动后使用
      info.event._preservedRentalDays = rentalDays;
    }
  },
  // 禁用事件大小调整
  eventResizeStart: function(info) {
    if (!isAdmin.value) {
      info.preventDefault()
      ElMessage.warning('请先登录管理员账号')
    }
  },
  eventOverlap: false,
  select: handleDateSelect,
  eventDrop: function(info) {
    console.log("FullCalendar eventDrop被触发")
    return handleEventDrop(info)
  },
  eventResize: function(info) {
    console.log("FullCalendar eventResize被触发")
    return handleEventResize(info)
  },
  eventClick: function(clickInfo) {
    if (!isAdmin.value) {
      // 访客只能查看预约详情
      const event = clickInfo.event
      ElMessage({
        type: 'info',
        message: `预约详情：
          开始时间：${event.startStr}
          结束时间：${event.endStr}
          ${event.extendedProps.notes ? `备注：${event.extendedProps.notes}` : ''}`
      })
      return
    }
    
    handleEventClick(clickInfo);
  },
  slotMinWidth: 30,             // 设置最小列宽
  snapDuration: { days: 1 },    // 设置拖拽吸附间隔
  height: 'auto',
  schedulerLicenseKey: 'CC-Attribution-NonCommercial-NoDerivatives',
  resourceAreaWidth: '200px',
  slotDuration: { days: 1 },
  resourceAreaHeaderContent: '相机型号',
  resourceLabelDidMount: function(arg) {
    const cellMain = arg.el.querySelector('.fc-datagrid-cell-main')
    if (!cellMain) return
    
    // 清空原有内容
    cellMain.innerHTML = ''
    
    // 创建纯文本元素
    const element = document.createElement('span')
    element.className = 'camera-resource-text'
    const camera = cameras.value.find(c => c.id === arg.resource.id)
    element.textContent = camera ? camera.name : ''
    
    cellMain.appendChild(element)
  },
  navLinks: true,
  nowIndicator: true,
  dayMaxEvents: true,
  defaultAllDay: true,
  defaultTimedEventDuration: '24:00:00',
  forceEventDuration: true,
  slotLabelFormat: [
    { day: 'numeric' },
    { weekday: 'narrow' }
  ],
  views: {
    resourceTimelineWeek: {
      duration: { weeks: 1 },
      buttonText: '周',
      slotMinWidth: 120,
      type: 'resourceTimeline',
      slotLabelFormat: [
        { day: 'numeric' },
        { weekday: 'narrow' }
      ]
    },
    resourceTimelineMonth: {
      duration: { months: 1 },
      buttonText: '月',
      slotMinWidth: 50,
      type: 'resourceTimeline',
      slotLabelFormat: [
        { day: 'numeric' },
        { weekday: 'narrow' }
      ]
    }
  },
  // 游客只能看到今天及之后的日期，管理员无限制
  validRange: computed(() => !isAdmin.value ? {
    start: new Date().toISOString().split('T')[0] // 限制为今天及之后
  } : null),
  eventDidMount: async function(info) {
    // ... 任何涉及到 dataService.getRentals() 的代码都需要用 await
  },
  // 禁止自动更新
  eventDataTransform: function(eventData) {
    // 确保不自动更新事件
    eventData._disableDefaultUpdate = true;
    return eventData;
  },
})

// 修改处理日期选择函数
function handleDateSelect(selectInfo) {
  if (!isAdmin.value) {
    ElMessage.warning('请先登录管理员账号')
    return
  }
  dialogVisible.value = true
  const selectedDate = selectInfo.startStr.split('T')[0]
  rentalForm.value.startTime = selectedDate
  rentalForm.value.endTime = selectedDate  // 将结束日期设置为与开始日期相同
  rentalForm.value.cameraId = selectInfo.resource.id
}

// 修改事件点击处理函数
function handleEventClick(clickInfo) {
  if (!isAdmin.value) {
    // 访客只能查看预约详情
    const event = clickInfo.event
    ElMessage({
      type: 'info',
      message: `预约详情：
        开始时间：${event.startStr}
        结束时间：${event.endStr}
        ${event.extendedProps.notes ? `备注：${event.extendedProps.notes}` : ''}`
    })
    return
  }
  
  const event = clickInfo.event
  
  // 直接使用事件上的数据，不再查询
  const rental = event.extendedProps.rentalData;
  
  eventEditForm.value = {
    id: parseInt(event.id),  // 确保 ID 是数字类型
    startDate: event.startStr.split('T')[0],
    endDate: new Date(event.end.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: event.extendedProps.notes || '',
    color: event.backgroundColor || '#409eff',
    event: event
  }
  eventEditDialogVisible.value = true
}

// 计算新的结束日期，完全避免Date对象
function addDaysToDateString(dateString, daysToAdd) {
  // 将日期字符串解析为年、月、日
  const [year, month, day] = dateString.split('-').map(Number);
  
  // 创建日期对象（仅用于计算）
  const date = new Date(year, month - 1, day);
  
  // 添加天数
  date.setDate(date.getDate() + daysToAdd);
  
  // 格式化回YYYY-MM-DD格式
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  const newDay = String(date.getDate()).padStart(2, '0');
  
  return `${newYear}-${newMonth}-${newDay}`;
}

// 完全重写事件拖拽处理函数
async function handleEventDrop(info) {
  if (!isAdmin.value) {
    info.revert();
    ElMessage.warning('请先登录管理员账号');
    return;
  }
  
  const { event, revert } = info;
  
  try {
    console.group("拖拽事件详细日志");
    console.log("事件ID:", event.id);
    console.log("事件开始:", event.start);
    console.log("事件结束:", event.end);
    
    // 获取原始事件数据
    const originalData = event.extendedProps.rentalData;
    console.log("原始租赁数据:", originalData);
    
    // 计算原始租期天数
    const origStart = new Date(originalData.startDate);
    const origEnd = new Date(originalData.endDate);
    const rentalDays = Math.round((origEnd - origStart) / (1000 * 60 * 60 * 24)) + 1;
    console.log("原始租期天数:", rentalDays);
    
    // 获取新的开始日期
    const newStartDate = event.start.toISOString().split('T')[0];
    console.log("新开始日期:", newStartDate);
    
    // 在发送请求前添加更明显的日志
    console.log(`准备调用移动端点: ${API_BASE_URL}/rentals/${event.id}/move`);

    // 使用专门的移动端点来处理
    const response = await fetch(`${API_BASE_URL}/rentals/${event.id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        newStartDate,
        rentalDays,
        cameraId: event.getResources()[0].id
      })
    });

    // 在请求后添加响应状态的日志
    console.log(`移动端点响应状态: ${response.status}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '更新失败');
    }
    
    // 获取服务器返回的更新后数据
    const updatedRental = await response.json();
    console.log("服务器返回的数据:", updatedRental);
    
    // 更新事件的扩展属性
    event.setExtendedProp('rentalData', {
      ...originalData,
      startDate: updatedRental.start_date,
      endDate: updatedRental.end_date,
      cameraId: updatedRental.camera_id
    });
    
    // 重新设置事件的显示日期
    const displayEndDate = new Date(updatedRental.end_date);
    displayEndDate.setDate(displayEndDate.getDate() + 1); // 加一天以适配FullCalendar
    
    console.log("设置事件显示日期 - 开始:", updatedRental.start_date, "结束:", displayEndDate.toISOString().split('T')[0]);
    
    // 静默更新事件日期，不触发新的拖拽事件
    event.setDates(
      updatedRental.start_date,
      displayEndDate.toISOString().split('T')[0],
      { allDay: true }
    );
    
    console.groupEnd();
    ElMessage.success('预约时间已更新');
  } catch (error) {
    console.error("拖拽更新错误:", error);
    console.groupEnd();
    revert(); // 重要：如果出错，恢复事件到原始位置
    ElMessage.error(error.message || '更新预约失败');
  }
}

// 类似地修改handleEventResize函数，使用专门的resize端点
async function handleEventResize(info) {
  if (!isAdmin.value) {
    info.revert();
    ElMessage.warning('请先登录管理员账号');
    return;
  }
  
  const { event, revert } = info;
  
  try {
    console.group("调整大小事件");
    
    // 获取新的日期范围
    const startDate = event.start.toISOString().split('T')[0];
    
    // FullCalendar的结束日期是排他性的(不包含)，所以需要减一天
    const fcEndDate = new Date(event.end);
    fcEndDate.setDate(fcEndDate.getDate() - 1);
    const endDate = fcEndDate.toISOString().split('T')[0];
    
    console.log("调整后的日期范围:", startDate, "到", endDate);
    
    // 使用专门的调整大小端点
    const response = await fetch(`${API_BASE_URL}/rentals/${event.id}/resize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startDate,
        endDate,
        cameraId: event.getResources()[0].id
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '更新预约失败');
    }
    
    const updatedRental = await response.json();
    console.log("服务器返回的数据:", updatedRental);
    
    // 更新事件的内部数据
    event.setExtendedProp('rentalData', {
      ...event.extendedProps.rentalData,
      startDate: updatedRental.start_date,
      endDate: updatedRental.end_date
    });
    
    console.groupEnd();
    ElMessage.success('预约时间已更新');
  } catch (error) {
    console.error("调整大小错误:", error);
    console.groupEnd();
    revert();
    ElMessage.error(error.message || '更新预约失败');
  }
}

// 提交预约
async function submitRental() {
  if (!rentalForm.value.startTime || !rentalForm.value.endTime) {
    ElMessage.warning('请选择租赁时间')
    return
  }

  try {
    // 确保日期格式一致
    const startDate = rentalForm.value.startTime;
    const endDate = rentalForm.value.endTime;
    
    // 验证开始日期不晚于结束日期
    if (new Date(startDate) > new Date(endDate)) {
      ElMessage.warning('结束日期必须晚于或等于开始日期');
      return;
    }
    
    console.log("提交预约 - 开始:", startDate, "结束:", endDate);
    
    const rentalData = {
      cameraId: rentalForm.value.cameraId,
      startDate,
      endDate,
      notes: rentalForm.value.notes,
      color: rentalForm.value.color || '#409eff'
    }
    
    const newRental = await dataService.addRental(rentalData)
    
    // 计算FullCalendar显示用的结束日期（排他性，所以加一天）
    const displayEndDate = new Date(newRental.endDate);
    displayEndDate.setDate(displayEndDate.getDate() + 1);
    
    console.log("新预约显示 - 结束:", displayEndDate.toISOString().split('T')[0]);

    const newEvent = {
      id: newRental.id,
      title: rentalForm.value.notes || '已预约',
      start: newRental.startDate,
      end: displayEndDate.toISOString().split('T')[0],
      resourceId: rentalForm.value.cameraId,
      allDay: true,
      editable: true,
      notes: rentalForm.value.notes,
      backgroundColor: newRental.color,
      borderColor: newRental.color,
      textColor: '#ffffff',
      rentalData: {
        ...newRental,
        actualEndDate: newRental.endDate
      }
    }
    
    const calendarApi = calendarRef.value.getApi()
    calendarApi.addEvent(newEvent)
    
    ElMessage.success('预约成功！')
    dialogVisible.value = false
    
    // 重置表单
    rentalForm.value = {
      cameraId: '',
      startTime: '',
      endTime: '',
      notes: '',
      color: '#409eff'
    }
  } catch (error) {
    ElMessage.error(error.message || '预约失败，请重试')
  }
}

// 显示相机管理对话框
function showCameraManagement() {
  cameraManagementVisible.value = true
  fetchCameras()
}

// 处理相机更新
async function handleCameraUpdate(action) {
  try {
    if (action.type === 'add') {
      const newCamera = await dataService.addCamera(action.camera)
      cameras.value.push(newCamera)
      resources.value.push({
        id: newCamera.id,
        title: newCamera.name
      })
      
      // 更新日历资源
      const calendarApi = calendarRef.value.getApi()
      calendarApi.setOption('resources', resources.value)
    } else if (action.type === 'update') {
      const { camera } = action
      await dataService.updateCamera(camera.id, {
        name: camera.name,
        link: camera.link
      })
      
      // 更新本地数据
      const index = cameras.value.findIndex(c => c.id === camera.id)
      if (index > -1) {
        cameras.value[index].name = camera.name
        cameras.value[index].link = camera.link
      }
      
      // 更新资源
      const resourceIndex = resources.value.findIndex(r => r.id === camera.id)
      if (resourceIndex > -1) {
        resources.value[resourceIndex].title = camera.name
      }
      
      // 更新日历资源
      const calendarApi = calendarRef.value.getApi()
      calendarApi.setOption('resources', resources.value)
      calendarApi.render() // 强制渲染
    } else if (action.type === 'delete') {
      const { camera } = action
      await dataService.deleteCamera(camera.id)
      
      // 更新本地数据
      cameras.value = cameras.value.filter(c => c.id !== camera.id)
      resources.value = resources.value.filter(r => r.id !== camera.id)
      
      // 更新日历资源
      const calendarApi = calendarRef.value.getApi()
      calendarApi.setOption('resources', resources.value)
      calendarApi.render() // 强制渲染
      
      // 重新获取预约数据
      await fetchRentals()
    }
  } catch (error) {
    ElMessage.error(error.message || '操作失败')
    throw error
  }
}

// 获取所有相机
async function fetchCameras() {
  isLoading.value = true
  try {
    cameras.value = await dataService.getCameras()
    // 简化资源创建
    resources.value = cameras.value.map(camera => ({
      id: camera.id,
      title: camera.name
    }))
    
    const calendarApi = calendarRef.value?.getApi()
    if (calendarApi) {
      calendarApi.setOption('resources', [])
      calendarApi.setOption('resources', resources.value)
    }
  } catch (error) {
    ElMessage.error(error.message || '获取相机列表失败')
    errorMessage.value = error.message
  } finally {
    isLoading.value = false
  }
}

// 获取所有预约
async function fetchRentals() {
  isLoading.value = true
  try {
    const rentals = await dataService.getRentals()
    console.log("从服务器获取的租赁:", rentals);
    
    const calendarApi = calendarRef.value?.getApi()
    if (calendarApi) {
      calendarApi.removeAllEvents()
      rentals.forEach(rental => {
        if (rental.status === 'active') {
          // 计算日期差
          const rawStartDate = new Date(rental.startDate);
          const rawEndDate = new Date(rental.endDate);
          const daysDiff = Math.round((rawEndDate - rawStartDate) / (1000 * 60 * 60 * 24)) + 1;
          
          console.log(`租赁ID ${rental.id}: ${rental.startDate} 到 ${rental.endDate}，共 ${daysDiff} 天`);
          
          // FullCalendar需要排他性(exclusive)结束日期，所以加一天
          const displayEndDate = new Date(rental.endDate);
          displayEndDate.setDate(displayEndDate.getDate() + 1);
          
          console.log(`  显示日期: ${rental.startDate} 到 ${displayEndDate.toISOString().split('T')[0]}`);
          
          const rentalData = {
            id: rental.id,
            cameraId: rental.cameraId,
            startDate: rental.startDate,
            endDate: rental.endDate,
            notes: rental.notes,
            color: rental.color,
            status: rental.status,
            // 保存原始天数供移动时使用
            originalDays: daysDiff
          };
          
          calendarApi.addEvent({
            id: rental.id,
            title: rental.notes || '已预约',
            start: rental.startDate,
            end: displayEndDate.toISOString().split('T')[0],
            resourceId: rental.cameraId,
            backgroundColor: rental.color,
            borderColor: rental.color,
            allDay: true,
            editable: true,
            notes: rental.notes,
            // 存储实际的开始和结束日期以及天数
            rentalData: rentalData
          })
        }
      })
    }
  } catch (error) {
    ElMessage.error(error.message || '获取预约列表失败')
    errorMessage.value = error.message
  } finally {
    isLoading.value = false
  }
}

// 更新事件
async function updateEvent() {
  try {
    const startDate = eventEditForm.value.startDate;
    const endDate = eventEditForm.value.endDate;
    
    console.log("表单更新 - 开始:", startDate, "结束:", endDate);
    
    // 更新预约
    await dataService.updateRental(eventEditForm.value.id, {
      startDate,
      endDate,
      notes: eventEditForm.value.notes,
      color: eventEditForm.value.color
    })
    
    // 更新UI
    const event = eventEditForm.value.event
    event.setProp('title', eventEditForm.value.notes || '已预约')
    event.setProp('backgroundColor', eventEditForm.value.color)
    event.setProp('borderColor', eventEditForm.value.color)
    event.setExtendedProp('notes', eventEditForm.value.notes)
    
    // 更新事件的内部数据
    event.setExtendedProp('rentalData', {
      ...event.extendedProps.rentalData,
      startDate,
      endDate,
      actualEndDate: endDate,
      notes: eventEditForm.value.notes,
      color: eventEditForm.value.color
    });
    
    // 为显示设置排他性结束日期（加一天）
    const newStartDate = new Date(startDate);
    const newEndDate = new Date(endDate);
    newEndDate.setDate(newEndDate.getDate() + 1); // 对结束日期加1天
    
    event.setDates(
      newStartDate,
      newEndDate,
      { allDay: true }
    )
    
    eventEditDialogVisible.value = false
    ElMessage.success('更新成功')
  } catch (error) {
    ElMessage.error(error.message || '更新失败')
  }
}

// 取消预约
async function cancelRental() {
  try {
    await ElMessageBox.confirm(
      '确定要取消这个预约吗？',
      '取消确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await dataService.cancelRental(eventEditForm.value.id)
    
    // 移除事件
    const event = eventEditForm.value.event
    event.remove()
    
    eventEditDialogVisible.value = false
    ElMessage.success('预约已取消')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '取消预约失败')
    }
  }
}

// 修改视图切换处理函数
function handleViewChange(view) {
  if (!isAdmin.value) {
    ElMessage.warning('只有管理员可以切换视图')
    return false
  }
  return true
}

// 添加测试函数 - 在初始化时直接创建一个测试事件
async function addTestEvent() {
  try {
    // 首先确保有至少一个相机
    if (cameras.value.length === 0) {
      await fetchCameras();
    }
    
    // 创建一个测试预约数据，有确定的5天租期（12月20日到12月24日）
    const testRental = {
      cameraId: cameras.value[0].id, // 使用第一个相机
      startDate: '2024-12-20',
      endDate: '2024-12-24',
      notes: '测试5天租期',
      color: '#f56c6c'
    };
    
    console.log("创建测试预约:", testRental);
    
    // 直接提交到数据库
    const newRental = await dataService.addRental(testRental);
    
    console.log("新测试预约:", newRental);
    
    // 计算租期天数
    const rentalDays = 
      (new Date(testRental.endDate) - new Date(testRental.startDate)) / 
      (1000 * 60 * 60 * 24) + 1;
    
    console.log("测试预约天数:", rentalDays);
    
    // 刷新日历
    await fetchRentals();
    
    return newRental;
  } catch (error) {
    console.error("创建测试预约失败:", error);
    ElMessage.error("创建测试预约失败");
    return null;
  }
}

// 在 mounted 钩子中调用此测试函数
onMounted(async () => {
  const calendarApi = calendarRef.value.getApi()
  await fetchCameras()
  await fetchRentals()
  // 如果需要，取消注释下一行来添加测试事件
  // await addTestEvent();
  // 强制更新视图
  calendarApi.updateSize()
})

// 修改事件渲染
function renderEvent(info) {
  const eventEl = info.el
  // 非管理员状态下移除可交互的样式
  if (!isAdmin.value) {
    eventEl.style.cursor = 'default'
    eventEl.classList.remove('fc-event-draggable')
    eventEl.classList.remove('fc-event-resizable')
  }
}

// 添加临时应急处理函数 - 完全忽略错误，强制更新数据库
async function emergencyUpdateRental(event) {
  try {
    // 直接访问SQLite API端点强制更新
    const response = await fetch(`http://localhost:3000/api/emergency-update/${event.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_date: event.start.toISOString().split('T')[0],
        end_date: event.start.toISOString().split('T')[0], // 强制设置为同一天
        camera_id: event.getResources()[0].id,
      }),
    });
    
    if (!response.ok) {
      throw new Error('紧急更新失败');
    }
    
    ElMessage.success('已成功更新预约');
    return true;
  } catch (error) {
    console.error('紧急更新失败:', error);
    ElMessage.error('紧急更新失败，请尝试刷新页面');
    return false;
  }
}

// 在服务器上添加紧急更新端点
app.post('/api/emergency-update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, camera_id } = req.body;
    
    // 直接执行SQL更新，跳过所有验证
    await db.run(
      'UPDATE rentals SET start_date = ?, end_date = ?, camera_id = ? WHERE id = ?',
      [start_date, end_date, camera_id, id]
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('紧急更新错误:', error);
    res.status(500).json({ error: '紧急更新失败' });
  }
});
</script>

<style>
/* 添加全局样式 */
.camera-rental-system {
  padding: 20px;
  margin: 0 auto;
  height: calc(100vh - 40px); /* 减去padding的高度 */
  display: flex;
  flex-direction: column;
}

.calendar-container {
  margin-top: 20px;
  flex: 1;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.rental-calendar {
  flex: 1;
  min-height: 0; /* 防止flex子元素溢出 */
}

:deep(.fc) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

:deep(.fc-toolbar-title) {
  font-size: 1.2em !important;
}

:deep(.fc-button) {
  background-color: #409eff !important;
  border-color: #409eff !important;
}

:deep(.fc-resource-timeline-divider) {
  width: 3px !important; /* 增加分隔线宽度 */
  background-color: #dcdfe6;
}

:deep(.fc-resource-area) {
  background-color: #f5f7fa;
}

:deep(.fc-resource-area .fc-datagrid-cell-main) {
  padding: 8px;
}

:deep(.fc-timeline-slot) {
  height: 60px !important;
  border: 1px solid #ebeef5;
  background-color: #ffffff;
}

:deep(.fc-timeline-slot:nth-child(even)) {
  background-color: #fafafa;
}

/* 添加拖拽相关样式 */
:deep(.fc-event) {
  cursor: pointer;
}

:deep(.fc-event:hover) {
  opacity: 0.8;
}

:deep(.fc-event.fc-event-dragging) {
  opacity: 0.5;
}

/* 添加相机管理样式 */
.camera-management {
  margin-bottom: 20px;
  display: flex;
  justify-content: flex-end;
}

.camera-management .el-button {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* 预约事件样式 */
:deep(.fc-event) {
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 0.9em;
  position: relative;
}

/* 添加调整大小的手柄样式 */
:deep(.fc-event .fc-event-resizer) {
  width: 6px;
  height: 100%;
  position: absolute;
  top: 0;
  cursor: col-resize;
}

:deep(.fc-event .fc-event-resizer-start) {
  left: 0;
}

:deep(.fc-event .fc-event-resizer-end) {
  right: 0;
}

:deep(.fc-event:hover .fc-event-resizer) {
  background-color: rgba(255, 255, 255, 0.3);
}

:deep(.fc-event:hover) {
  opacity: 0.8;
  transform: scale(1.02);
  transition: all 0.2s ease;
}

:deep(.fc-event.fc-event-dragging) {
  opacity: 0.5;
  transform: scale(1.05);
}

/* 日历头部样式优化 */
:deep(.fc-toolbar) {
  margin-bottom: 1.5em !important;
}

:deep(.fc-toolbar-title) {
  font-size: 1.2em !important;
  font-weight: 600;
}

:deep(.fc-button) {
  padding: 8px 16px !important;
  font-size: 0.9em !important;
  transition: all 0.3s ease;
}

:deep(.fc-button:hover) {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* 资源区域样式优化 */
:deep(.fc-resource-area) {
  background-color: #f0f2f5;
  border-right: 2px solid #ebeef5;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.05);
}

:deep(.fc-resource-area .fc-datagrid-cell-main) {
  padding: 8px 12px;
  font-weight: 500;
  border-bottom: 1px solid #ebeef5;
  background-color: #f0f2f5;
}

/* 颜色选项样式 */
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

/* 日期标签样式优化 */
:deep(.fc-timeline-slot-label) {
  font-size: 0.9em !important;
  font-weight: normal !important;
  background-color: #f0f2f5;
  border-bottom: 1px solid #dcdfe6;
}

:deep(.fc-timeline-slot-label-frame) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
  gap: 8px;
  padding: 8px 0;
}

:deep(.fc-timeline-slot-label-frame .fc-timeline-slot-label-cushion:first-child) {
  font-size: 1.2em;
  font-weight: 500;
}

:deep(.fc-timeline-slot-label-frame .fc-timeline-slot-label-cushion:last-child) {
  font-size: 0.9em;
  color: #666;
}

/* 相机管理样式 */
.camera-list {
  margin-bottom: 20px;
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
  gap: 8px;
}

/* 简化资源单元格样式 */
:deep(.fc-datagrid-cell-main) {
  padding: 4px 12px;
  display: flex;
  align-items: center;
}

:deep(.camera-resource-text) {
  color: #333;
  font-size: 14px;
}

/* 移除所有可能导致重复的样式 */
:deep(.fc-datagrid-cell-main) {
  padding: 4px 12px;
  display: flex;
  align-items: center;
}

:deep(.fc-datagrid-cell-main) {
  padding: 4px 12px;
  display: flex;
  align-items: center;
}

/* 修改时间线网格样式 */
:deep(.fc-timeline-slots) {
  border-collapse: collapse;
  border-spacing: 0;
  border: 1px solid #e0e0e0;
}

/* 修改垂直分隔线样式 */
:deep(.fc-timeline-slot-lane) {
  border: 1px solid #e0e0e0 !important;
  border-right: none !important;
  border-bottom: none !important;
  margin: -1px 0 0 -1px;  /* 修复边框重叠 */
  background-color: #ffffff;
}

/* 最后一列添加右边框 */
:deep(.fc-timeline-slot-lane:last-child) {
  border-right: 1px solid #e0e0e0 !important;
}

/* 最后一行添加底部边框 */
:deep(.fc-timeline-slots tr:last-child .fc-timeline-slot-lane) {
  border-bottom: 1px solid #e0e0e0 !important;
}

/* 修改事件样式 */
:deep(.fc-event) {
  border-radius: 2px;
  padding: 4px 8px;
  font-size: 0.9em;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  border: none;
  margin: 2px;
  height: calc(100% - 4px);
  box-sizing: border-box;
  z-index: 2;  /* 确保事件显示在网格之上 */
  position: relative;
}

/* 修改表头样式 */
:deep(.fc-timeline-header) {
  background-color: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
  z-index: 1;  /* 确保表头在上层 */
}

/* 修改工具栏样式 */
:deep(.fc-toolbar) {
  background-color: #ffffff;
  padding: 12px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px !important;
}

/* 修改今天的列样式 */
:deep(.fc-timeline-slot.fc-timeline-slot-today) {
  background-color: rgba(64, 158, 255, 0.05);
}

/* 修改事件拖拽手柄样式 */
:deep(.fc-event-resizer) {
  background-color: rgba(0, 0, 0, 0.1);
  width: 4px;
}

:deep(.fc-event-resizer:hover) {
  background-color: rgba(0, 0, 0, 0.2);
}

/* Excel 风格的网格样式 */
:deep(.fc-timeline-slot) {
  height: 40px !important;
  border: none;  /* 移除原有边框 */
  background-color: #ffffff;
  padding: 0;
  position: relative;  /* 为伪元素定位 */
}

/* 表头样式 */
:deep(.fc-timeline-header) {
  background-color: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  position: relative;
  z-index: 1;  /* 确保表头在上层 */
}

/* 日期标签样式 */
:deep(.fc-timeline-slot-label) {
  font-size: 12px !important;
  border-right: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  font-weight: bold;
}

/* 资源区域样式（左侧列） */
:deep(.fc-resource-area) {
  background-color: #f8f9fa;
  border-right: 1px solid #e0e0e0;
  position: relative;
  z-index: 1;  /* 确保资源区域在上层 */
}

:deep(.fc-resource-area .fc-datagrid-cell-main) {
  padding: 4px 8px;
  border-bottom: 1px solid #e0e0e0;
  font-weight: normal;
  height: 40px;
  display: flex;
  align-items: center;
}

/* 网格线样式 */
:deep(.fc-timeline-slot-lane) {
  border-right: 1px solid #e0e0e0;
}

/* 事件样式 */
:deep(.fc-event) {
  border-radius: 0;  /* 移除圆角 */
  box-shadow: none;  /* 移除阴影 */
  margin: 2px 0;  /* 添加小间距 */
  height: calc(100% - 4px);  /* 减去margin的高度 */
}

/* 工具栏样式 */
:deep(.fc-toolbar) {
  background-color: #f8f9fa;
  padding: 8px;
  border: 1px solid #ddd;
  margin-bottom: 0 !important;
}

/* 移除一些动画效果 */
:deep(.fc-event:hover) {
  transform: none;
  opacity: 0.9;
}

/* 调整分隔线 */
:deep(.fc-resource-timeline-divider) {
  width: 2px !important;
  background-color: #ddd;
}

/* 调整今天列的样式 */
:deep(.fc-timeline-slot.fc-timeline-slot-today) {
  background-color: #fff8e6;
}

/* 调整表格容器样式 */
.calendar-container {
  padding: 0;
  border: 1px solid #ddd;
  border-radius: 0;
  box-shadow: none;
}

/* 调整整体布局 */
.camera-rental-system {
  background-color: #ffffff;
  padding: 20px;
}

/* 移除资源区域的序号样式 */
:deep(.fc-datagrid-cell-main) {
  &::before {
    display: none !important;  /* 确保不显示序号 */
  }
}

/* 调整资源标签的样式 */
:deep(.fc-datagrid-cell-main) {
  justify-content: flex-start;  /* 左对齐 */
  padding: 4px 12px !important;  /* 增加左右内边距 */
}

/* 确保链接样式正确 */
:deep(.camera-resource-text) {
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}

/* 添加登录对话框样式 */
.auth-controls {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-bottom: 20px;
}
</style> 