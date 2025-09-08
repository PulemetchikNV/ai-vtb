import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { loginApi, registerApi, getMeApi, toggleRoleApi, type User, type LoginRequest, type RegisterRequest } from '../services/auth'
import { TOKEN_KEY } from '../__data__/constants'
import { isAuthorized } from '../__data__/store'

const user = ref<User | null>(null)
const loading = ref(false)

// Watch isAuthorized changes to fetch user data
watch(isAuthorized, async (newValue) => {
    if (newValue && !user.value) {
        await fetchMe()
    } else if (!newValue) {
        user.value = null
    }
}, { immediate: true })

async function fetchMe() {
    if (!isAuthorized.value) return

    try {
        loading.value = true
        user.value = await getMeApi()
    } catch (error) {
        console.error('Failed to fetch user:', error)
        // If token is invalid, logout
        logout()
    } finally {
        loading.value = false
    }
}

async function login(data: LoginRequest) {
    try {
        loading.value = true
        const response = await loginApi(data)

        // Save token
        localStorage.setItem(TOKEN_KEY, response.token)
        isAuthorized.value = true

        // Fetch user data
        await fetchMe()

        return response
    } catch (error) {
        console.error('Login failed:', error)
        throw error
    } finally {
        loading.value = false
    }
}

async function register(data: RegisterRequest) {
    try {
        loading.value = true
        const response = await registerApi(data)

        // Save token
        localStorage.setItem(TOKEN_KEY, response.token)
        isAuthorized.value = true

        // Fetch user data
        await fetchMe()

        return response
    } catch (error) {
        console.error('Registration failed:', error)
        throw error
    } finally {
        loading.value = false
    }
}

async function toggleRole() {
    if (!isAuthorized.value) return

    try {
        loading.value = true
        user.value = await toggleRoleApi()
    } catch (error) {
        console.error('Toggle role failed:', error)
        throw error
    } finally {
        loading.value = false
    }
}

function logout() {
    localStorage.removeItem(TOKEN_KEY)
    isAuthorized.value = false
    user.value = null
}

export function useAuth() {
    return {
        // State
        user: computed(() => user.value),
        isAuthorized: computed(() => isAuthorized.value),
        loading: computed(() => loading.value),

        // Computed
        isHr: computed(() => user.value?.role === 'hr'),
        isUser: computed(() => user.value?.role === 'user'),

        // Actions
        login,
        register,
        logout,
        fetchMe,
        toggleRole
    }
}
