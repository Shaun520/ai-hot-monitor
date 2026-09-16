<!--
  MovingBorder：动态渐变边框容器（conic-gradient + CSS spin）
-->
<script setup lang="ts">
import { cn } from '../../lib/utils'

withDefaults(
  defineProps<{
    className?: string
    containerClassName?: string
    borderClassName?: string
    duration?: number
  }>(),
  { duration: 2000 }
)
</script>

<template>
  <div
    :class="cn('relative h-auto w-auto overflow-hidden bg-transparent p-[1px] cursor-pointer', containerClassName)"
  >
    <div
      :class="cn('absolute inset-0', borderClassName)"
      :style="{
        background: 'conic-gradient(from var(--angle, 0deg), transparent 60%, #3b82f6, #06b6d4, #3b82f6, transparent 40%)',
        animation: `spin ${duration}ms linear infinite`,
      }"
    />
    <div :class="cn('relative flex items-center justify-center gap-2 backdrop-blur-xl', className)">
      <slot />
    </div>
  </div>
</template>