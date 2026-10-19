<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  options: { type: Array, default: () => [] },
  placeholder: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)

const label = computed(
  () => props.options.find((o) => o.value === props.modelValue)?.label || props.placeholder || props.modelValue
)
const hasValue = computed(() => props.options.some((o) => o.value === props.modelValue))

function pick(v) {
  open.value = false
  if (v !== props.modelValue) emit('update:modelValue', v)
}

function onDocClick(e) {
  if (open.value && root.value && !root.value.contains(e.target)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="root" class="dd">
    <button type="button" class="dd-btn" :class="{ open }" @click="open = !open">
      <span class="dd-label" :class="{ placeholder: !hasValue }">{{ label }}</span>
      <span class="dd-caret"></span>
    </button>
    <div v-if="open" class="dd-list">
      <button
        v-for="o in options"
        :key="o.value"
        type="button"
        class="dd-item"
        :class="{ active: o.value === modelValue }"
        @click="pick(o.value)"
      >
        {{ o.label }}
      </button>
    </div>
  </div>
</template>
