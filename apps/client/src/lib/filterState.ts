/**
 * 筛选条件状态：类型定义与默认值（供 FilterSortBar 与 App 共享）
 */
export interface FilterState {
  source: string
  importance: string
  keywordId: string
  timeRange: string
  isReal: string
  sortBy: string
  sortOrder: string
}

export const defaultFilterState: FilterState = {
  source: '',
  importance: '',
  keywordId: '',
  timeRange: '',
  isReal: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
}