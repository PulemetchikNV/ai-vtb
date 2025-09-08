import axios from "axios";
import { TOKEN_KEY } from "../__data__/constants";
import { addMessage } from "../__data__/notifications";

console.log('AXIOS INIT', import.meta.env.VITE_API_URL);


export const axiosInstance = axios.create({
    baseURL: (import.meta as any).env?.VITE_API_URL || (window as any).__VITE_API_URL__ || '/'
})

axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) (config.headers as any).Authorization = `Bearer ${token}`
    return config
})

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        console.log({ error });

        if (error.response?.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            window.location.href = '/login'
        }
        if (error.response?.data?.message) {
            addMessage({
                detail: error.response?.data?.message,
                severity: 'error'
            })
        }
        return Promise.reject(error);
    }
)

