<script setup>
import { onBeforeMount, onUnmounted, ref } from 'vue'
import { router } from '@inertiajs/vue3'
import { useModalStack } from './modalStack'
import ModalRenderer from './ModalRenderer.vue'

const modalStack = useModalStack()

onBeforeMount(() => {
    modalStack.rootPresent.value = true
})

const activeModalFromBaseUrl = ref(null)
const isNavigating = ref(false)

onUnmounted(router.on('start', () => (isNavigating.value = true)))
onUnmounted(router.on('finish', () => (isNavigating.value = false)))
onUnmounted(
    router.on('navigate', (event) => {
        const modalOnBase = event.detail.page.props._inertiaui_modal

        if (!modalOnBase) {
            activeModalFromBaseUrl.value?.close()
            activeModalFromBaseUrl.value = null
            return
        }

        modalStack
            .pushFromResponseData(modalOnBase, {}, () => {
                if (!isNavigating.value && window.location.href !== modalOnBase.baseUrl) {
                    router.visit(modalOnBase.baseUrl)
                }
            })
            .then((modal) => (activeModalFromBaseUrl.value = modal))
    }),
)
</script>

<template>
    <slot />

    <ModalRenderer
        v-if="modalStack.stack.value.length"
        :index="0"
    />
</template>
