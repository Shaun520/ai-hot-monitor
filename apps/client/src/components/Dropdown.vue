<!--
  Dropdown：仿 framer-motion 弹出的下拉选择器
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronDown } from 'lucide-vue-next'
import { cn } from '../lib/utils'

interface Option {
  value: string
  label: string
  color?: string
}

const props = defineProps<{ label: string; value: string; options: Option[] }>()
const emit = defineEmits<{ change: [value: string] }>()

const open = ref(false)
const selected = computed(() => props.options.find((o) => o.value === props.value))
const isActive = computed(() => props.value !== '')

function pick(value: string) {
  emit('change', value)
  open.value = false
}
</script>

<template>
  <div class="relative">
    <button
      type="button"
      @click="open = !open"
      :class="cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
        isActive
          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
          : 'bg-white/5 text-slate-400 border border-white/10 hover:border-white/20 hover:text-slate-300',
      )"
    >
      <span>{{ isActive ? selected?.label : label }}</span>
      <ChevronDown :class="cn('w-3 h-3 transition-transform', open && 'rotate-180')" />
    </button>

    <Transition name="pop">
      <div v-if="open" class="absolute left-0 top-full mt-1 z-50 min-w-[160px]">
        <div class="fixed inset-0 z-[-1]" @click="open = false" />
        <div class="relative bg-[#0d0d20]/98 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden">
          <button
            v-for="option in options"
            :key="option.value"
            type="button"
            @click="pick(option.value)"
            :class="cn(
              'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left',
              value === option.value
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-slate-400 hover:bg-white/5 hover:text-white',
            )"
          >
            <Check v-if="value === option.value" class="w-3 h-3 shrink-0" />
            <span :class="option.color">{{ option.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>