import { axiosInstance } from '../plugins/axios'

export type User = {
    id: string
    email: string
    role: 'user' | 'hr'
}

export type LoginRequest = {
    email: string
    password: string
}

export type RegisterRequest = {
    email: string
    password: string
    role?: 'user' | 'hr'
}

export type LoginResponse = {
    token: string
}

// Auth API calls
export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
    const response = await axiosInstance.post('/auth/login', data)
    return response.data
}

export async function registerApi(data: RegisterRequest): Promise<LoginResponse> {
    const response = await axiosInstance.post('/auth/register', data)
    return response.data
}

export async function getMeApi(): Promise<User> {
    const response = await axiosInstance.get('/auth/me')
    return response.data
}

export async function toggleRoleApi(): Promise<User> {
    const response = await axiosInstance.post('/auth/toggle-role')
    return response.data
}


