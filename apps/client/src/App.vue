<!--
  App：AI 热点监控主界面（热点雷达 / 监控词 / 搜索 三个 Tab）
  Vue3 Composition API 实现
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import {
  Activity, AlertTriangle, Bell, Check, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsUpDown, ChevronUp, Clock, ExternalLink, Eye, FileText, Flame, Globe,
  MessageCircle, Plus, Quote, RefreshCw, Repeat2, Search, Shield, ShieldAlert,
  Target, ThermometerSun, Trash2, TrendingUp, Twitter, User, X, Zap,
} from 'lucide-vue-next'
import {
  keywordsApi, hotspotsApi, notificationsApi, triggerHotspotCheck,
  type Hotspot, type Keyword, type Notification, type Stats,
} from './services/api'
import { onNewHotspot, onNotification, subscribeToKeywords } from './services/socket'
import { cn } from './lib/utils'
import type { FilterState } from './lib/filterState'
import { defaultFilterState } from './lib/filterState'
import Spotlight from './components/ui/Spotlight.vue'
import BackgroundBeams from './components/ui/BackgroundBeams.vue'
import Meteors from './components/ui/Meteors.vue'
import FilterSortBar from './components/FilterSortBar.vue'
import { sortHotspots } from './utils/sortHotspots'
import { relativeTime, formatDateTime } from './utils/relativeTime'

/** 计算热度综合指标（归一化 0-100） */
function calcHeatScore(h: Hotspot): number {
  const likes = h.likeCount ?? 0
  const retweets = h.retweetCount ?? 0
  const replies = h.replyCount ?? 0
  const comments = h.commentCount ?? 0
  const quotes = h.quoteCount ?? 0
  const views = h.viewCount ?? 0
  const raw = likes * 2 + retweets * 3 + replies * 1.5 + comments * 1.5 + quotes * 2 + views / 100
  if (raw <= 0) return 0
  return Math.min(100, Math.round(Math.log10(raw + 1) * 25))
}

function getHeatLevel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: '爆', color: 'text-red-400' }
  if (score >= 60) return { label: '热', color: 'text-orange-400' }
  if (score >= 40) return { label: '温', color: 'text-amber-400' }
  if (score >= 20) return { label: '凉', color: 'text-blue-400' }
  return { label: '冷', color: 'text-slate-500' }
}

/* ===== 图标映射（替代 React 端的 getImportanceIcon / getSourceIcon） ===== */
const IMPORTANCE_ICONS: Record<string, Component> = {
  urgent: AlertTriangle,
  high: Flame,
  medium: Zap,
  low: TrendingUp,
}
function importanceIcon(importance: string): Component {
  return IMPORTANCE_ICONS[importance] || TrendingUp
}

const SOURCE_ICONS: Record<string, Component> = {
  twitter: Twitter,
  bilibili: Eye,
  weibo: Activity,
  sogou: Search,
  hackernews: Zap,
}
function sourceIcon(source: string): Component {
  return SOURCE_ICONS[source] || Globe
}

const SOURCE_LABELS: Record<string, string> = {
  twitter: 'Twitter',
  bing: 'Bing',
  google: 'Google',
  sogou: '搜狗',
  bilibili: 'Bilibili',
  weibo: '微博热搜',
  hackernews: 'HackerNews',
  duckduckgo: 'DuckDuckGo',
}
function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source
}

/* ===== 状态 ===== */
const keywords = ref<Keyword[]>([])
const hotspots = ref<Hotspot[]>([])
const stats = ref<Stats | null>(null)
const notifications = ref<Notification[]>([])
const unreadCount = ref(0)

const newKeyword = ref('')
const searchQuery = ref('')
const isLoading = ref(false)
const isChecking = ref(false)
const showNotifications = ref(false)
const activeTab = ref<'dashboard' | 'keywords' | 'search'>('dashboard')
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)

const dashboardFilters = ref<FilterState>({ ...defaultFilterState })
const searchFilters = ref<FilterState>({ ...defaultFilterState })
const currentPage = ref(1)
const totalPages = ref(1)
const searchResults = ref<Hotspot[]>([])

const expandedReasons = ref<Set<string>>(new Set())
const expandedContents = ref<Set<string>>(new Set())
const allReasonsExpanded = ref(false)

/* ===== 数据加载 ===== */
async function loadData() {
  isLoading.value = true
  try {
    const filterParams: Record<string, string | number> = { limit: 20, page: currentPage.value }
    const f = dashboardFilters.value
    if (f.source) filterParams.source = f.source
    if (f.importance) filterParams.importance = f.importance
    if (f.keywordId) filterParams.keywordId = f.keywordId
    if (f.timeRange) filterParams.timeRange = f.timeRange
    if (f.isReal) filterParams.isReal = f.isReal
    if (f.sortBy) filterParams.sortBy = f.sortBy
    if (f.sortOrder) filterParams.sortOrder = f.sortOrder

    const [keywordsData, hotspotsData, statsData, notifData] = await Promise.all([
      keywordsApi.getAll(),
      hotspotsApi.getAll(filterParams as any),
      hotspotsApi.getStats(),
      notificationsApi.getAll({ limit: 20 }),
    ])
    keywords.value = keywordsData
    hotspots.value = hotspotsData.data
    totalPages.value = hotspotsData.pagination.totalPages
    stats.value = statsData
    notifications.value = notifData.data
    unreadCount.value = notifData.unreadCount

    const active = keywordsData.filter((k) => k.isActive).map((k) => k.text)
    if (active.length > 0) subscribeToKeywords(active)
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    isLoading.value = false
  }
}

// 筛选变化时重置页码
function resetPageOnFilterChange() {
  currentPage.value = 1
}
watch(dashboardFilters, resetPageOnFilterChange)
watch([dashboardFilters, currentPage], loadData, { immediate: true })

/* ===== WebSocket 事件 ===== */
let unsubHotspot: (() => void) | null = null
let unsubNotif: (() => void) | null = null

onMounted(() => {
  unsubHotspot = onNewHotspot((hotspot) => {
    hotspots.value = [hotspot as Hotspot, ...hotspots.value.slice(0, 19)]
    showToast('发现新热点: ' + hotspot.title.slice(0, 30), 'success')
    loadData()
  })
  unsubNotif = onNotification(() => {
    unreadCount.value += 1
  })
})

onBeforeUnmount(() => {
  unsubHotspot?.()
  unsubNotif?.()
})

/* ===== 交互处理 ===== */
function showToast(message: string, type: 'success' | 'error') {
  toast.value = { message, type }
  setTimeout(() => (toast.value = null), 3000)
}

async function handleAddKeyword() {
  if (!newKeyword.value.trim()) return
  try {
    const keyword = await keywordsApi.create({ text: newKeyword.value.trim() })
    keywords.value = [keyword, ...keywords.value]
    newKeyword.value = ''
    showToast('关键词添加成功', 'success')
    subscribeToKeywords([keyword.text])
  } catch (error: any) {
    showToast(error.message || '添加失败', 'error')
  }
}

async function handleDeleteKeyword(id: string) {
  try {
    await keywordsApi.delete(id)
    keywords.value = keywords.value.filter((k) => k.id !== id)
    showToast('关键词已删除', 'success')
  } catch {
    showToast('删除失败', 'error')
  }
}

async function handleToggleKeyword(id: string) {
  try {
    const updated = await keywordsApi.toggle(id)
    keywords.value = keywords.value.map((k) => (k.id === id ? updated : k))
  } catch {
    showToast('操作失败', 'error')
  }
}

async function handleSearch() {
  if (!searchQuery.value.trim()) return
  isLoading.value = true
  try {
    const result = await hotspotsApi.search(searchQuery.value)
    searchResults.value = result.results
    showToast(`找到 ${result.results.length} 条结果`, 'success')
  } catch {
    showToast('搜索失败', 'error')
  } finally {
    isLoading.value = false
  }
}

async function handleManualCheck() {
  isChecking.value = true
  try {
    await triggerHotspotCheck()
    showToast('热点检查已触发', 'success')
    setTimeout(loadData, 5000)
  } catch {
    showToast('触发失败', 'error')
  } finally {
    isChecking.value = false
  }
}

async function handleMarkAllRead() {
  try {
    await notificationsApi.markAllAsRead()
    unreadCount.value = 0
    notifications.value = notifications.value.map((n) => ({ ...n, isRead: true }))
  } catch (error) {
    console.error('Failed to mark as read:', error)
  }
}

function toggleReason(id: string) {
  const next = new Set(expandedReasons.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedReasons.value = next
}

function toggleContent(id: string) {
  const next = new Set(expandedContents.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedContents.value = next
}

function toggleAllReasons(list: Hotspot[]) {
  expandedReasons.value = allReasonsExpanded.value
    ? new Set()
    : new Set(list.filter((h) => h.relevanceReason).map((h) => h.id))
  allReasonsExpanded.value = !allReasonsExpanded.value
}

/* ===== 计算属性 ===== */
const filteredSearchResults = computed(() => {
  let results = [...searchResults.value]
  const f = searchFilters.value

  if (f.source) results = results.filter((h) => h.source === f.source)
  if (f.importance) results = results.filter((h) => h.importance === f.importance)
  if (f.isReal === 'true') results = results.filter((h) => h.isReal)
  else if (f.isReal === 'false') results = results.filter((h) => !h.isReal)
  if (f.keywordId) results = results.filter((h) => h.keyword?.id === f.keywordId)
  if (f.timeRange) {
    const now = new Date()
    let dateFrom: Date | null = null
    switch (f.timeRange) {
      case '1h': dateFrom = new Date(now.getTime() - 60 * 60 * 1000); break
      case 'today': dateFrom = new Date(now); dateFrom.setHours(0, 0, 0, 0); break
      case '7d': dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); break
      case '30d': dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); break
    }
    if (dateFrom) results = results.filter((h) => new Date(h.createdAt) >= dateFrom!)
  }

  return sortHotspots(results, f.sortBy || 'createdAt', (f.sortOrder || 'desc') as 'asc' | 'desc')
})

// 分页序号
const pages = computed(() => {
  const max = Math.min(totalPages.value, 7)
  const tp = totalPages.value
  const p = currentPage.value
  return Array.from({ length: max }, (_, i) => {
    if (tp <= 7) return i + 1
    if (p <= 4) return i + 1
    if (p >= tp - 3) return tp - 6 + i
    return p - 3 + i
  })
})

const TABS = [
  { key: 'dashboard', label: '热点雷达', icon: Activity },
  { key: 'keywords', label: '监控词', icon: Target },
  { key: 'search', label: '搜索', icon: Search },
] as const
</script>

<template>
  <div class="min-h-screen bg-[#050510] relative overflow-hidden">
    <!-- 背景特效 -->
    <BackgroundBeams class="z-0" />
    <Spotlight
      class="-top-40 left-0 md:left-60 md:-top-20"
      fill="#3b82f6"
    />

    <!-- 柔光球形 -->
    <div class="fixed top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
    <div class="fixed bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

    <!-- Toast 提示 -->
    <Transition name="fade-slide">
      <div
        v-if="toast"
        class="fixed top-6 inset-x-0 z-50 flex items-start justify-center pointer-events-none"
      >
        <div
          class="flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-xl shadow-2xl"
          :class="toast.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'"
        >
          <Check
            v-if="toast.type === 'success'"
            class="w-4 h-4"
          />
          <X
            v-else
            class="w-4 h-4"
          />
          <span class="text-sm font-medium">{{ toast.message }}</span>
        </div>
      </div>
    </Transition>

    <!-- 顶部导航 -->
    <header class="sticky top-0 z-40 backdrop-blur-2xl bg-[#050510]/70 border-b border-white/5">
      <div class="max-w-6xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
          <!-- Logo -->
          <div class="flex items-center gap-4">
            <div class="relative">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Flame class="w-5 h-5 text-white" />
              </div>
              <div class="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#050510] animate-pulse" />
            </div>
            <div>
              <h1 class="text-lg font-semibold text-white tracking-tight">
                HotPulse
              </h1>
              <p class="text-xs text-slate-500">
                AI 热点雷达
              </p>
            </div>
          </div>

          <!-- 操作区 -->
          <div class="flex items-center gap-3">
            <button
              type="button"
              :disabled="isChecking"
              class="px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              :class="isChecking
                ? 'bg-blue-500/20 text-blue-400 cursor-wait'
                : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'"
              @click="handleManualCheck"
            >
              <RefreshCw :class="cn('w-4 h-4', isChecking && 'animate-spin')" />
              {{ isChecking ? '扫描中' : '立即扫描' }}
            </button>

            <!-- 通知 -->
            <div class="relative">
              <button
                type="button"
                class="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all"
                @click="showNotifications = !showNotifications"
              >
                <Bell class="w-5 h-5 text-slate-400" />
                <span
                  v-if="unreadCount > 0"
                  class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                >
                  {{ unreadCount > 9 ? '9+' : unreadCount }}
                </span>
              </button>

              <Transition name="pop">
                <div
                  v-if="showNotifications"
                  class="absolute right-0 top-14 w-80 bg-[#0a0a1a]/95 backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                >
                  <div class="flex items-center justify-between p-4 border-b border-white/5">
                    <h3 class="font-medium text-white">
                      通知
                    </h3>
                    <button
                      v-if="unreadCount > 0"
                      type="button"
                      class="text-xs text-blue-400 hover:text-blue-300"
                      @click="handleMarkAllRead"
                    >
                      全部已读
                    </button>
                  </div>
                  <div class="max-h-80 overflow-y-auto">
                    <p
                      v-if="notifications.length === 0"
                      class="text-slate-500 text-sm text-center py-8"
                    >
                      暂无通知
                    </p>
                    <div
                      v-else
                      class="divide-y divide-white/5"
                    >
                      <div
                        v-for="n in notifications.slice(0, 5)"
                        :key="n.id"
                        :class="cn('p-4 transition-colors', n.isRead ? 'opacity-50' : 'hover:bg-white/5')"
                      >
                        <p class="text-sm font-medium text-white">
                          {{ n.title }}
                        </p>
                        <p class="text-xs text-slate-500 mt-1 line-clamp-2">
                          {{ n.content }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- 主体 -->
    <main class="relative z-10 max-w-6xl mx-auto px-6 py-8">
      <!-- 页签 -->
      <div class="flex gap-2 mb-8">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          type="button"
          :class="cn(
            'px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all',
            activeTab === tab.key
              ? 'bg-white/10 text-white border border-white/10'
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5',
          )"
          @click="activeTab = tab.key"
        >
          <component
            :is="tab.icon"
            class="w-4 h-4"
          />
          {{ tab.label }}
        </button>
      </div>

      <!-- 热点雷达 -->
      <div
        v-if="activeTab === 'dashboard'"
        class="space-y-8"
      >
        <!-- 核心指标 -->
        <div
          v-if="stats"
          class="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div class="animate-fade-up animate-delay-0 relative group p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/10 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div class="relative">
              <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
                <Activity class="w-4 h-4" />
                总热点
              </div>
              <p class="text-3xl font-bold text-white">
                {{ stats.total }}
              </p>
            </div>
          </div>

          <div class="animate-fade-up animate-delay-1 relative group p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/10 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div class="relative">
              <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
                <Clock class="w-4 h-4" />
                今日新增
              </div>
              <p class="text-3xl font-bold text-cyan-400">
                {{ stats.today }}
              </p>
            </div>
          </div>

          <div class="animate-fade-up animate-delay-2 relative group p-5 rounded-2xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/10 overflow-hidden">
            <Meteors :number="6" />
            <div class="relative">
              <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
                <AlertTriangle class="w-4 h-4" />
                紧急热点
              </div>
              <p class="text-3xl font-bold text-red-400">
                {{ stats.urgent }}
              </p>
            </div>
          </div>

          <div class="animate-fade-up animate-delay-3 relative group p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/10 overflow-hidden">
            <div class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div class="relative">
              <div class="flex items-center gap-2 text-slate-500 text-sm mb-2">
                <Target class="w-4 h-4" />
                监控词
              </div>
              <p class="text-3xl font-bold text-emerald-400">
                {{ keywords.filter((k) => k.isActive).length }}
              </p>
            </div>
          </div>
        </div>

        <!-- 实时热点流 -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-white flex items-center gap-2">
              <Flame class="w-5 h-5 text-orange-500" />
              实时热点流
            </h2>
            <span class="text-xs text-slate-600">每 30 分钟自动更新</span>
          </div>

          <div class="mb-5">
            <FilterSortBar
              v-model:filters="dashboardFilters"
              :keywords="keywords"
            />
          </div>

          <div
            v-if="isLoading"
            class="flex items-center justify-center py-16"
          >
            <div class="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>

          <div
            v-else-if="hotspots.length === 0"
            class="text-center py-16 rounded-2xl border border-dashed border-white/10"
          >
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <Search class="w-8 h-8 text-slate-600" />
            </div>
            <p class="text-slate-500">
              尚未发现热点
            </p>
            <p class="text-sm text-slate-600 mt-1">
              添加监控关键词开始追踪
            </p>
          </div>

          <div
            v-else
            class="space-y-3"
          >
            <!-- 一键展开/折叠所有理由 -->
            <div
              v-if="hotspots.some((h) => h.relevanceReason)"
              class="flex justify-end"
            >
              <button
                type="button"
                class="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
                @click="toggleAllReasons(hotspots)"
              >
                <ChevronsUpDown class="w-3.5 h-3.5" />
                {{ allReasonsExpanded ? '折叠所有理由' : '展开所有理由' }}
              </button>
            </div>

            <div
              v-for="(hotspot, index) in hotspots"
              :key="hotspot.id"
              class="animate-fade-left group p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-white/10 transition-all"
              :style="{ animationDelay: `${index * 30}ms` }"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 min-w-0">
                  <!-- 徽章行 -->
                  <div class="flex flex-wrap items-center gap-2 mb-3">
                    <span
                      :class="cn(
                        'px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase tracking-wider flex items-center',
                        hotspot.importance === 'urgent' && 'bg-red-500/15 text-red-400 border border-red-500/20',
                        hotspot.importance === 'high' && 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
                        hotspot.importance === 'medium' && 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
                        hotspot.importance === 'low' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
                      )"
                    >
                      <component :is="importanceIcon(hotspot.importance)" />
                      <span class="ml-1">{{ hotspot.importance }}</span>
                    </span>
                    <span class="flex items-center gap-1 text-xs text-slate-600">
                      <component :is="sourceIcon(hotspot.source)" />
                      {{ sourceLabel(hotspot.source) }}
                    </span>
                    <span
                      v-if="hotspot.keyword"
                      class="text-[10px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    >
                      {{ hotspot.keyword.text }}
                    </span>
                    <span
                      v-if="!hotspot.isReal"
                      class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20"
                    >
                      <ShieldAlert class="w-3 h-3" />
                      可疑
                    </span>
                    <span
                      v-if="hotspot.isReal && hotspot.relevance >= 80"
                      class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    >
                      <Shield class="w-3 h-3" />
                      可信
                    </span>
                    <span
                      v-if="hotspot.keywordMentioned === true"
                      class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    >
                      <Target class="w-3 h-3" />
                      直接提及
                    </span>
                    <span
                      v-if="hotspot.keywordMentioned === false"
                      class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                    >
                      <Target class="w-3 h-3" />
                      间接相关
                    </span>
                    <span :class="cn('flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-medium', getHeatLevel(calcHeatScore(hotspot)).color)">
                      <ThermometerSun class="w-3 h-3" />
                      {{ getHeatLevel(calcHeatScore(hotspot)).label }} {{ calcHeatScore(hotspot) }}
                    </span>
                  </div>

                  <!-- 标题 -->
                  <h3 class="font-medium text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
                    {{ hotspot.title }}
                  </h3>

                  <!-- AI 摘要 -->
                  <div
                    v-if="hotspot.summary"
                    class="mb-3"
                  >
                    <span class="text-[10px] text-blue-400/60 font-medium mr-1.5">AI 摘要</span>
                    <span class="text-sm text-slate-500">{{ hotspot.summary }}</span>
                  </div>

                  <!-- 作者 -->
                  <div
                    v-if="hotspot.authorName"
                    class="flex items-center gap-2 mb-3"
                  >
                    <img
                      v-if="hotspot.authorAvatar"
                      :src="hotspot.authorAvatar"
                      alt=""
                      class="w-5 h-5 rounded-full object-cover"
                    >
                    <User
                      v-else
                      class="w-4 h-4 text-slate-600"
                    />
                    <span class="text-xs text-slate-400">
                      {{ hotspot.authorName }}
                      <span
                        v-if="hotspot.authorUsername"
                        class="text-slate-600 ml-1"
                      >@{{ hotspot.authorUsername }}</span>
                    </span>
                    <span
                      v-if="hotspot.authorVerified"
                      class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400"
                    >✓ 认证</span>
                    <span
                      v-if="hotspot.authorFollowers != null && hotspot.authorFollowers > 0"
                      class="text-[10px] text-slate-600"
                    >
                      {{ hotspot.authorFollowers.toLocaleString() }} 粉丝
                    </span>
                  </div>

                  <!-- 互动数据 -->
                  <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600 mb-2">
                    <span class="flex items-center gap-1">
                      <Target class="w-3.5 h-3.5" />
                      相关性 {{ hotspot.relevance }}%
                    </span>
                    <span
                      v-if="hotspot.likeCount != null && hotspot.likeCount > 0"
                      class="flex items-center gap-1"
                      title="点赞"
                    >
                      <Zap class="w-3.5 h-3.5" />
                      {{ hotspot.likeCount.toLocaleString() }}
                    </span>
                    <span
                      v-if="hotspot.retweetCount != null && hotspot.retweetCount > 0"
                      class="flex items-center gap-1"
                      title="转发"
                    >
                      <Repeat2 class="w-3.5 h-3.5" />
                      {{ hotspot.retweetCount.toLocaleString() }}
                    </span>
                    <span
                      v-if="hotspot.replyCount != null && hotspot.replyCount > 0"
                      class="flex items-center gap-1"
                      title="回复"
                    >
                      <MessageCircle class="w-3.5 h-3.5" />
                      {{ hotspot.replyCount.toLocaleString() }}
                    </span>
                    <span
                      v-if="hotspot.commentCount != null && hotspot.commentCount > 0"
                      class="flex items-center gap-1"
                      title="评论"
                    >
                      <MessageCircle class="w-3.5 h-3.5" />
                      {{ hotspot.commentCount.toLocaleString() }}
                    </span>
                    <span
                      v-if="hotspot.quoteCount != null && hotspot.quoteCount > 0"
                      class="flex items-center gap-1"
                      title="引用"
                    >
                      <Quote class="w-3.5 h-3.5" />
                      {{ hotspot.quoteCount.toLocaleString() }}
                    </span>
                    <span
                      v-if="hotspot.viewCount != null && hotspot.viewCount > 0"
                      class="flex items-center gap-1"
                      title="浏览量"
                    >
                      <Eye class="w-3.5 h-3.5" />
                      {{ hotspot.viewCount.toLocaleString() }}
                    </span>
                    <span
                      v-if="hotspot.danmakuCount != null && hotspot.danmakuCount > 0"
                      class="flex items-center gap-1"
                      title="弹幕"
                    >
                      💬 {{ hotspot.danmakuCount.toLocaleString() }}
                    </span>
                  </div>

                  <!-- 时间 -->
                  <div class="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                    <span
                      v-if="hotspot.publishedAt"
                      class="flex items-center gap-1"
                      :title="`发布于 ${formatDateTime(hotspot.publishedAt)}`"
                    >
                      <Clock class="w-3 h-3" />
                      发布 {{ relativeTime(hotspot.publishedAt) }}
                    </span>
                    <span
                      class="flex items-center gap-1"
                      :title="`抓取于 ${formatDateTime(hotspot.createdAt)}`"
                    >
                      <Activity class="w-3 h-3" />
                      抓取 {{ relativeTime(hotspot.createdAt) }}
                    </span>
                  </div>

                  <!-- AI 相关性理由 -->
                  <div
                    v-if="hotspot.relevanceReason"
                    class="mt-2"
                  >
                    <button
                      type="button"
                      class="flex items-center gap-1 text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors"
                      @click="toggleReason(hotspot.id)"
                    >
                      <ChevronUp
                        v-if="expandedReasons.has(hotspot.id)"
                        class="w-3 h-3"
                      />
                      <ChevronDown
                        v-else
                        class="w-3 h-3"
                      />
                      AI 分析理由
                    </button>
                    <Transition name="expand">
                      <div
                        v-if="expandedReasons.has(hotspot.id)"
                        class="overflow-hidden"
                      >
                        <p class="text-xs text-slate-500 mt-1 pl-4 border-l-2 border-blue-500/20">
                          {{ hotspot.relevanceReason }}
                        </p>
                      </div>
                    </Transition>
                  </div>

                  <!-- 原始内容 -->
                  <div
                    v-if="hotspot.content && hotspot.content !== hotspot.summary"
                    class="mt-2"
                  >
                    <button
                      type="button"
                      class="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                      @click="toggleContent(hotspot.id)"
                    >
                      <ChevronUp
                        v-if="expandedContents.has(hotspot.id)"
                        class="w-3 h-3"
                      />
                      <ChevronDown
                        v-else
                        class="w-3 h-3"
                      />
                      <FileText class="w-3 h-3" />
                      原始内容
                    </button>
                    <Transition name="expand">
                      <div
                        v-if="expandedContents.has(hotspot.id)"
                        class="overflow-hidden"
                      >
                        <p class="text-xs text-slate-500 mt-1 pl-4 border-l-2 border-white/10 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                          {{ hotspot.content }}
                        </p>
                      </div>
                    </Transition>
                  </div>
                </div>

                <!-- 外链 -->
                <a
                  :href="hotspot.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-2.5 rounded-xl bg-white/5 hover:bg-blue-500/20 text-slate-500 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100"
                  @click.stop
                >
                  <ExternalLink class="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <!-- 分页 -->
          <div
            v-if="totalPages > 1 && !isLoading"
            class="flex items-center justify-center gap-3 mt-6"
          >
            <button
              type="button"
              :disabled="currentPage <= 1"
              class="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              @click="currentPage = Math.max(1, currentPage - 1)"
            >
              <ChevronLeft class="w-4 h-4" />
            </button>
            <div class="flex items-center gap-1.5">
              <button
                v-for="page in pages"
                :key="page"
                type="button"
                :class="cn(
                  'w-8 h-8 rounded-lg text-xs font-medium transition-all',
                  currentPage === page
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-500 hover:text-white hover:bg-white/5',
                )"
                @click="currentPage = page"
              >
                {{ page }}
              </button>
            </div>
            <button
              type="button"
              :disabled="currentPage >= totalPages"
              class="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              @click="currentPage = Math.min(totalPages, currentPage + 1)"
            >
              <ChevronRight class="w-4 h-4" />
            </button>
            <span class="text-xs text-slate-600 ml-2">共 {{ stats?.total || 0 }} 条</span>
          </div>
        </div>
      </div>

      <!-- 监控词 -->
      <div
        v-else-if="activeTab === 'keywords'"
        class="space-y-6"
      >
        <form
          class="p-5 rounded-2xl bg-white/[0.02] border border-white/5"
          @submit.prevent="handleAddKeyword"
        >
          <div class="flex gap-3">
            <div class="flex-1 relative">
              <input
                v-model="newKeyword"
                type="text"
                placeholder="输入要监控的关键词，如：GPT-5、AI编程、Cursor..."
                class="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
            </div>
            <button
              type="submit"
              class="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium flex items-center gap-2 shadow-lg shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus class="w-4 h-4" />
              添加
            </button>
          </div>
        </form>

        <div class="grid gap-3 md:grid-cols-2">
          <TransitionGroup name="kw">
            <div
              v-for="keyword in keywords"
              :key="keyword.id"
              :class="cn(
                'group p-4 rounded-xl border transition-all',
                keyword.isActive
                  ? 'bg-white/[0.03] border-blue-500/20 hover:border-blue-500/30'
                  : 'bg-white/[0.01] border-white/5 opacity-60',
              )"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <button
                    type="button"
                    :class="cn('w-11 h-6 rounded-full transition-all relative', keyword.isActive ? 'bg-blue-500' : 'bg-slate-700')"
                    @click="handleToggleKeyword(keyword.id)"
                  >
                    <span :class="cn('absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all', keyword.isActive ? 'left-6' : 'left-1')" />
                  </button>
                  <div>
                    <span :class="cn('font-medium', keyword.isActive ? 'text-white' : 'text-slate-500')">{{ keyword.text }}</span>
                    <span
                      v-if="keyword._count && keyword._count.hotspots > 0"
                      class="ml-2 text-xs text-slate-600"
                    >
                      {{ keyword._count.hotspots }} 条热点
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  class="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  @click="handleDeleteKeyword(keyword.id)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </div>
          </TransitionGroup>
        </div>

        <div
          v-if="keywords.length === 0"
          class="text-center py-16 rounded-2xl border border-dashed border-white/10"
        >
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
            <Target class="w-8 h-8 text-slate-600" />
          </div>
          <p class="text-slate-500">
            还没有监控关键词
          </p>
          <p class="text-sm text-slate-600 mt-1">
            添加你想追踪的技术热点词
          </p>
        </div>
      </div>

      <!-- 搜索 -->
      <div
        v-else
        class="space-y-6"
      >
        <form
          class="p-5 rounded-2xl bg-white/[0.02] border border-white/5"
          @submit.prevent="handleSearch"
        >
          <div class="flex gap-3">
            <div class="flex-1 relative">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索热点内容..."
                class="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
              >
            </div>
            <button
              type="submit"
              :disabled="isLoading"
              class="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-medium flex items-center gap-2 shadow-lg shadow-blue-500/25 disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <div
                v-if="isLoading"
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              />
              <Search
                v-else
                class="w-4 h-4"
              />
              搜索
            </button>
          </div>
        </form>

        <FilterSortBar
          v-model:filters="searchFilters"
          :keywords="keywords"
        />

        <div class="space-y-3">
          <div
            v-if="filteredSearchResults.length === 0 && searchResults.length > 0"
            class="text-center py-12 rounded-2xl border border-dashed border-white/10"
          >
            <p class="text-slate-500">
              当前筛选条件下无结果
            </p>
            <p class="text-sm text-slate-600 mt-1">
              尝试调整筛选条件
            </p>
          </div>

          <div
            v-for="(hotspot, i) in filteredSearchResults"
            :key="hotspot.id"
            class="animate-fade-up group p-5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all"
            :style="{ animationDelay: `${i * 30}ms` }"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-3">
                  <span
                    :class="cn(
                      'px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase flex items-center',
                      hotspot.importance === 'urgent' && 'bg-red-500/15 text-red-400 border border-red-500/20',
                      hotspot.importance === 'high' && 'bg-orange-500/15 text-orange-400 border border-orange-500/20',
                      hotspot.importance === 'medium' && 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
                      hotspot.importance === 'low' && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20',
                    )"
                  >
                    <component :is="importanceIcon(hotspot.importance)" />
                    <span class="ml-1">{{ hotspot.importance }}</span>
                  </span>
                  <span class="flex items-center gap-1 text-xs text-slate-600">
                    <component :is="sourceIcon(hotspot.source)" />
                    {{ sourceLabel(hotspot.source) }}
                  </span>
                  <span
                    v-if="!hotspot.isReal"
                    class="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/20"
                  >
                    <ShieldAlert class="w-3 h-3" />
                    可疑
                  </span>
                  <span :class="cn('flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-medium', getHeatLevel(calcHeatScore(hotspot)).color)">
                    <ThermometerSun class="w-3 h-3" />
                    {{ getHeatLevel(calcHeatScore(hotspot)).label }} {{ calcHeatScore(hotspot) }}
                  </span>
                </div>
                <h3 class="font-medium text-white mb-2 group-hover:text-blue-400 transition-colors">
                  {{ hotspot.title }}
                </h3>
                <div
                  v-if="hotspot.summary"
                  class="mb-2"
                >
                  <span class="text-[10px] text-blue-400/60 font-medium mr-1.5">AI 摘要</span>
                  <span class="text-sm text-slate-500">{{ hotspot.summary }}</span>
                </div>
                <div
                  v-if="hotspot.authorName"
                  class="flex items-center gap-2 mb-2"
                >
                  <User class="w-4 h-4 text-slate-600" />
                  <span class="text-xs text-slate-400">{{ hotspot.authorName }}</span>
                  <span
                    v-if="hotspot.authorVerified"
                    class="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400"
                  >✓ 认证</span>
                </div>
                <div class="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span class="flex items-center gap-1">
                    <Target class="w-3.5 h-3.5" />
                    相关性 {{ hotspot.relevance }}%
                  </span>
                  <span
                    v-if="hotspot.likeCount != null && hotspot.likeCount > 0"
                    class="flex items-center gap-1"
                    title="点赞"
                  >
                    <Zap class="w-3.5 h-3.5" />
                    {{ hotspot.likeCount.toLocaleString() }}
                  </span>
                  <span
                    v-if="hotspot.viewCount != null && hotspot.viewCount > 0"
                    class="flex items-center gap-1"
                    title="浏览量"
                  >
                    <Eye class="w-3.5 h-3.5" />
                    {{ hotspot.viewCount.toLocaleString() }}
                  </span>
                </div>
                <div
                  v-if="hotspot.publishedAt"
                  class="flex items-center gap-1 text-[11px] text-slate-600 mt-1"
                  :title="formatDateTime(hotspot.publishedAt)"
                >
                  <Clock class="w-3 h-3" />
                  发布 {{ relativeTime(hotspot.publishedAt) }}
                </div>
              </div>
              <a
                :href="hotspot.url"
                target="_blank"
                rel="noopener noreferrer"
                class="shrink-0 px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-sm font-medium transition-all"
              >
                查看
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>