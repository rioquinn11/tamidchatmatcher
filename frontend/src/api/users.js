import axios from 'axios';

const API_BASE = '/api';

export async function loginUser(email, password) {
  try {
    const response = await axios.post(`${API_BASE}/users/login`, { email, password });
    return response.data;
  } catch (err) {
    const message =
      err.response?.data?.detail || 'Something went wrong. Please try again.';
    throw new Error(message);
  }
}

export async function getCurrentUser(token) {
  const response = await axios.get(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
}
