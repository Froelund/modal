import { computed, readonly, ref, markRaw, nextTick } from 'vue'
import { default as Axios } from 'axios'
import { except, only } from './helpers'
import { router, usePage } from '@inertiajs/vue3'
import { mergeDataIntoQueryString } from '@inertiajs/core'

const stack = ref([])
const localModals = ref({})

class Modal {
    constructor(component, response, modalProps, onClose, afterLeave) {
        this.id = Modal.generateId()
        this.open = false
        this.listeners = {}

        this.component = component
        this.componentProps = ref(response.props)
        this.response = response
        this.modalProps = modalProps
        this.onCloseCallback = onClose
        this.afterLeaveCallback = afterLeave

        this.index = computed(() => stack.value.findIndex((m) => m.id === this.id))
        this.getParentModal = () => this.getAdjacentModal(-1)
        this.getChildModal = () => this.getAdjacentModal(1)
        this.onTopOfStack = computed(() => this.isOnTopOfStack())
    }

    static generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return `inertiaui_modal_${crypto.randomUUID()}`
        }
        // Fallback for environments where crypto.randomUUID is not available
        return `inertiaui_modal_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`
    }

    getAdjacentModal = (offset) => {
        const index = this.index.value
        return stack.value[index + offset] ?? null
    }

    isOnTopOfStack = () => {
        return stack.value.length < 2 || stack.value[stack.value.length - 1].id === this.id
    }

    show = () => {
        const index = this.index.value

        if (index > -1) {
            if (stack.value[index].open) {
                // Only open if the modal is closed
                return
            }

            stack.value[index].open = true
        }
    }

    close = () => {
        const index = this.index.value

        if (index > -1) {
            if (!stack.value[index].open) {
                // Only close if the modal is open
                return
            }

            Object.keys(this.listeners).forEach((event) => {
                this.off(event)
            })

            stack.value[index].open = false
            this.onCloseCallback?.()
        }
    }

    afterLeave = () => {
        const index = this.index.value

        if (index > -1) {
            if (stack.value[index].open) {
                // Only execute the callback if the modal is closed
                return
            }

            stack.value = stack.value.filter((m) => m.id !== this.id)
            this.afterLeaveCallback?.()
        }
    }

    on = (event, callback) => {
        this.listeners[event] = this.listeners[event] ?? []
        this.listeners[event].push(callback)
    }

    off = (event, callback) => {
        if (callback) {
            this.listeners[event] = this.listeners[event]?.filter((cb) => cb !== callback) ?? []
        } else {
            delete this.listeners[event]
        }
    }

    emit = (event, ...args) => {
        this.listeners[event]?.forEach((callback) => callback(...args))
    }

    registerEventListenersFromAttrs = ($attrs) => {
        const unsubscribers = []

        Object.keys($attrs)
            .filter((key) => key.startsWith('on'))
            .forEach((key) => {
                // e.g. onRefreshKey -> refresh-key
                const snakeCaseKey = key
                    .replace(/^on/, '')
                    .replace(/^./, (firstLetter) => firstLetter.toLowerCase())
                    .replace(/([A-Z])/g, '-$1')
                    .toLowerCase()

                this.on(snakeCaseKey, $attrs[key])
                unsubscribers.push(() => this.off(snakeCaseKey, $attrs[key]))
            })

        return () => unsubscribers.forEach((unsub) => unsub())
    }

    reload = (options = {}) => {
        let keys = Object.keys(this.response.props)

        if (options.only) {
            keys = only(keys, options.only)
        }

        if (options.except) {
            keys = except(keys, options.except)
        }

        Axios.get(this.response.url, {
            headers: {
                Accept: 'text/html, application/xhtml+xml',
                'X-Inertia': true,
                'X-Inertia-Partial-Component': this.response.component,
                'X-Inertia-Version': this.response.version,
                'X-Inertia-Partial-Data': keys.join(','),
            },
        }).then((response) => {
            Object.assign(this.componentProps.value, response.data.props)
        })
    }
}

function registerLocalModal(name, callback) {
    localModals.value[name] = { name, callback }
}

function pushLocalModal(name, modalProps, onClose, afterLeave) {
    if (!localModals.value[name]) {
        throw new Error(`The local modal "${name}" has not been registered.`)
    }

    const modal = push(null, {}, modalProps, onClose, afterLeave)
    modal.name = name
    localModals.value[name].callback(modal)
    return modal
}

function pushFromResponseData(responseData, modalProps = {}, onClose = null, onAfterLeave = null) {
    return router
        .resolveComponent(responseData.component)
        .then((component) => push(markRaw(component), responseData, modalProps, onClose, onAfterLeave))
}

function visit(href, method, payload = {}, headers = {}, modalProps = {}, onClose = null, onAfterLeave = null, queryStringArrayFormat = 'brackets') {
    return new Promise((resolve, reject) => {
        if (href.startsWith('#')) {
            resolve(pushLocalModal(href.substring(1), modalProps, onClose, onAfterLeave))
            return
        }

        const [url, data] = mergeDataIntoQueryString(method, href || '', payload, queryStringArrayFormat)

        Axios({
            url,
            method,
            data,
            headers: {
                ...headers,
                Accept: 'text/html, application/xhtml+xml',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Inertia': true,
                'X-Inertia-Version': usePage().version,
                'X-InertiaUI-Modal': true,
            },
        })
            .then((response) => resolve(pushFromResponseData(response.data, modalProps, onClose, onAfterLeave)))
            .catch((error) => {
                reject(error)
            })
    })
}

function push(component, response, modalProps, onClose, afterLeave) {
    const newModal = new Modal(component, response, modalProps, onClose, afterLeave)
    stack.value.push(newModal)
    nextTick(() => {
        newModal.show()
    })
    return newModal
}

export const rootPresent = ref(false)

export const modalPropNames = ['closeButton', 'closeExplicitly', 'maxWidth', 'paddingClasses', 'panelClasses', 'position', 'slideover']

export function useModalStack() {
    return {
        stack: readonly(stack),
        push,
        pushFromResponseData,
        reset: () => (stack.value = []),
        visit,
        registerLocalModal,
        removeLocalModal: (name) => delete localModals.value[name],
        rootPresent,
        verifyRoot: () => {
            if (!rootPresent.value) {
                throw new Error(
                    'The <ModalRoot> component is missing from your app layout. Please check the documentation for more information: https://inertiaui.com/inertia-modal/docs/installation',
                )
            }
        },
    }
}
