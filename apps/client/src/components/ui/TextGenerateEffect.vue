<!--
  TextGenerateEffect：滚动进入视口时逐词浮现的文字效果
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { cn } from '../../lib/utils'

const props = withDefaults(
  defineProps<{ words: string; className?: string; filter?: boolean; duration?: number }>(),
  { filter: true, duration: 0.5 }
)

const root = ref<HTMLDivElement | null>(null)
const visible = ref(false)

const words = computed(() => props.words.split(' '))

let observer: IntersectionObserver | null = null

onMounted(() => {
  if (!root.value) return
  observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      visible.value = true
      observer?.disconnect()
    }
  })
  observer.observe(root.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div :class="cn('font-bold', className)">
    <div ref="root">
      <span
        v-for="(word, idx) in words"
        :key="`${word}-${idx}`"
        class="inline-block transition-all"
        :class="visible ? 'opacity-100' : 'opacity-0'"
        :class="{ 'blur-0': visible || !filter, 'blur-[10px]': !visible && filter }"
        :style="{
          transitionDelay: visible ? `${idx * 80}ms` : '0ms',
          transitionDuration: `${duration}s`,
        }"
      >
        {{ word }}&nbsp;
      </span>
    </div>
  </div>
</template>