<!--
  FilterSortBar：热点排序与筛选栏（支持折叠筛选面板与已选标签）
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowUpDown, Clock, Filter, Flame, RotateCcw, Target, TrendingUp, X,
} from 'lucide-vue-next'
import { cn } from '../lib/utils'
import { defaultFilterState, type FilterState } from '../lib/filterState'
import type { Keyword } from '../services/api'
import Dropdown from './Dropdown.vue'

const filters = defineModel<FilterState>('filters', { required: true })
const props = defineProps<{ keywords: Keyword[] }>()

const SORT_OPTIONS = [
  { value: 'createdAt', label: '最新发现', icon: Clock },
  { value: 'publishedAt', label: '最新发布', icon: Clock },
  { value: 'importance', label: '重要程度', icon: Flame },
  { value: 'relevance', label: '相关性', icon: Target },
  { value: 'hot', label: '热度综合', icon: TrendingUp },
]

const SOURCE_OPTIONS = [
  { value: '', label: '全部来源' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'bing', label: 'Bing' },
  { value: 'google', label: 'Google' },
  { value: 'sogou', label: '搜狗' },
  { value: 'bilibili', label: 'Bilibili' },
  { value: 'weibo', label: '微博热搜' },
  { value: 'hackernews', label: 'HackerNews' },
  { value: 'duckduckgo', label: 'DuckDuckGo' },
]

const IMPORTANCE_OPTIONS = [
  { value: '', label: '全部等级' },
  { value: 'urgent', label: '🔴 紧急', color: 'text-red-400' },
  { value: 'high', label: '🟠 高', color: 'text-orange-400' },
  { value: 'medium', label: '🟡 中', color: 'text-amber-400' },
  { value: 'low', label: '🟢 低', color: 'text-emerald-400' },
]

const TIME_RANGE_OPTIONS = [
  { value: '', label: '全部时间' },
  { value: '1h', label: '最近 1 小时' },
  { value: 'today', label: '今天' },
  { value: '7d', label: '最近 7 天' },
  { value: '30d', label: '最近 30 天' },
]

const REAL_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'true', label: '✅ 真实' },
  { value: 'false', label: '⚠️ 疑似虚假' },
]

const showFilters = ref(false)

const activeFilterCount = computed(
  () =>
    [filters.value.source, filters.value.importance, filters.value.keywordId, filters.value.timeRange, filters.value.isReal].filter(
      (v) => v !== '',
    ).length,
)

const hasNonDefaultSort = computed(() => filters.value.sortBy !== 'createdAt')

const activeTags = computed(() => [
  { show: !!filters.value.source, text: SOURCE_OPTIONS.find((o) => o.value === filters.value.source)?.label || filters.value.source, remove: () => update('source', '') },
  { show: !!filters.value.importance, text: IMPORTANCE_OPTIONS.find((o) => o.value === filters.value.importance)?.label || filters.value.importance, remove: () => update('importance', '') },
  { show: !!filters.value.keywordId, text: props.keywords.find((k) => k.id === filters.value.keywordId)?.text || '关键词', remove: () => update('keywordId', '') },
  { show: !!filters.value.timeRange, text: TIME_RANGE_OPTIONS.find((o) => o.value === filters.value.timeRange)?.label || filters.value.timeRange, remove: () => update('timeRange', '') },
  { show: !!filters.value.isReal, text: REAL_OPTIONS.find((o) => o.value === filters.value.isReal)?.label || '真实性', remove: () => update('isReal', '') },
])

function update(key: keyof FilterState, value: string) {
  filters.value = { ...filters.value, [key]: value }
}

function resetFilters() {
  filters.value = { ...defaultFilterState }
}
</script>

<template>
  <div class="space-y-3">
    <!-- 主栏：排序 + 筛选开关 -->
    <div class="flex items-center gap-2 flex-wrap">
      <!-- 排序选择 -->
      <div class="flex items-center gap-1 bg-white/[0.03] rounded-xl border border-white/5 p-1">
        <ArrowUpDown class="w-3.5 h-3.5 text-slate-600 ml-2" />
        <button
          v-for="opt in SORT_OPTIONS"
          :key="opt.value"
          type="button"
          :class="cn(
            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
            filters.sortBy === opt.value
              ? 'bg-blue-500/15 text-blue-400 shadow-sm'
              : 'text-slate-500 hover:text-slate-300',
          )"
          @click="update('sortBy', opt.value)"
        >
          <component
            :is="opt.icon"
            class="w-3 h-3"
          />
          {{ opt.label }}
        </button>
      </div>

      <!-- 筛选开关 -->
      <button
        type="button"
        :class="cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all',
          showFilters || activeFilterCount > 0
            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
            : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20',
        )"
        @click="showFilters = !showFilters"
      >
        <Filter class="w-3.5 h-3.5" />
        筛选
        <span
          v-if="activeFilterCount > 0"
          class="w-4 h-4 rounded-full bg-blue-500 text-[10px] text-white flex items-center justify-center font-bold"
        >
          {{ activeFilterCount }}
        </span>
      </button>

      <!-- 重置 -->
      <button
        v-if="activeFilterCount > 0 || hasNonDefaultSort"
        type="button"
        class="flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-300 transition-colors"
        @click="resetFilters"
      >
        <RotateCcw class="w-3 h-3" />
        重置
      </button>

      <!-- 已选标签 -->
      <div
        v-if="activeFilterCount > 0 && !showFilters"
        class="flex items-center gap-1.5 flex-wrap"
      >
        <span
          v-for="tag in activeTags"
          v-show="tag.show"
          :key="tag.text"
          class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-medium border border-blue-500/20"
        >
          {{ tag.text }}
          <button
            type="button"
            class="hover:text-white transition-colors"
            @click="tag.remove"
          >
            <X class="w-2.5 h-2.5" />
          </button>
        </span>
      </div>
    </div>

    <!-- 展开的筛选面板。
         这里的根节点不设 overflow-hidden：展开动画的裁剪已由 CSS 中的
         .expand-*-active > * 承担，否则绝对定位的下拉面板会被裁掉 -->
    <Transition name="expand">
      <div v-if="showFilters">
        <div class="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <Dropdown
            label="来源"
            :value="filters.source"
            :options="SOURCE_OPTIONS"
            @change="(v: string) => update('source', v)"
          />
          <Dropdown
            label="重要程度"
            :value="filters.importance"
            :options="IMPORTANCE_OPTIONS"
            @change="(v: string) => update('importance', v)"
          />
          <Dropdown
            label="关键词"
            :value="filters.keywordId"
            :options="[{ value: '', label: '全部关键词' }, ...keywords.filter((k) => k.isActive).map((k) => ({ value: k.id, label: k.text }))]"
            @change="(v: string) => update('keywordId', v)"
          />
          <Dropdown
            label="时间"
            :value="filters.timeRange"
            :options="TIME_RANGE_OPTIONS"
            @change="(v: string) => update('timeRange', v)"
          />
          <Dropdown
            label="真实性"
            :value="filters.isReal"
            :options="REAL_OPTIONS"
            @change="(v: string) => update('isReal', v)"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>