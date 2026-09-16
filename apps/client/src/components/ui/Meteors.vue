<!--
  Meteors：流星粒子特效（随机位置 / 延迟 / 时长，挂载时生成一次）
-->
<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '../../lib/utils'

const props = withDefaults(defineProps<{ className?: string; number?: number }>(), { number: 12 })

interface MeteorStyle {
  top: string
  left: string
  animationDelay: string
  animationDuration: string
}

// 挂载时根据随机数生成一次，避免重复随机导致闪烁
const meteors = computed<MeteorStyle[]>(() =>
  Array.from({ length: props.number }, () => ({
    top: '0px',
    left: Math.floor(Math.random() * (400 - -400) + -400) + 'px',
    animationDelay: Math.random() * (0.8 - 0.2) + 0.2 + 's',
    animationDuration: Math.floor(Math.random() * (10 - 2) + 2) + 's',
  }))
)
</script>

<template>
  <span
    v-for="(m, idx) in meteors"
    :key="`meteor-${idx}`"
    :style="{ top: m.top, left: m.left, animationDelay: m.animationDelay, animationDuration: m.animationDuration }"
    :class="cn(
      'animate-meteor-effect absolute h-0.5 w-0.5 rounded-full bg-slate-400 shadow-[0_0_0_1px_#ffffff10] rotate-[215deg]',
      'before:content-[\'\'] before:absolute before:top-1/2 before:transform before:-translate-y-[50%] before:w-[50px] before:h-[1px] before:bg-gradient-to-r before:from-[#64748b] before:to-transparent',
      className,
    )"
  />
</template>