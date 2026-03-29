import axios from 'axios';
import { AuthResponse, Fund, FundWithEstimation, FundSearchResult } from './types';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { username, password }),
  
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
};

export const fundApi = {
  search: (keyword: string) =>
    api.get<{ results: FundSearchResult[] }>('/funds/search', { params: { keyword } }),
  
  add: (code: string, note?: string) =>
    api.post<{ message: string; fund: Fund }>('/funds/add', { code, note }),
  
  remove: (code: string) =>
    api.delete<{ message: string }>(`/funds/${code}`),
  
  getPortfolio: () =>
    api.get<{ funds: Fund[] }>('/funds/portfolio'),
  
  getPortfolioEstimation: () =>
    api.get<{ estimations: FundWithEstimation[] }>('/funds/portfolio/estimation'),
  
  getEstimation: (code: string) =>
    api.get<{ estimation: FundWithEstimation['estimation'] }>(`/funds/estimation/${code}`),
};

export default api;
