// 创建一个新文件 src/utils/dateUtils.js 来处理日期转换

// 格式化日期为 YYYY-MM-DD 字符串
export function formatDateToYYYYMMDD(date) {
  if (!date) return null;
  if (typeof date === 'string') {
    // 如果已经是字符串，确保是YYYY-MM-DD格式
    return date.split('T')[0];
  }
  return date.toISOString().split('T')[0];
}

// 从FullCalendar事件结束日期获取实际租赁结束日期
export function getEndDateFromEvent(event) {
  if (!event.end) return formatDateToYYYYMMDD(event.start);
  
  const end = new Date(event.end);
  // FullCalendar的结束日期是不包含的(exclusive)，所以减去一天
  end.setDate(end.getDate() - 1);
  return formatDateToYYYYMMDD(end);
} 