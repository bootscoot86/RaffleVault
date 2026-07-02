const BASE = '/api';

// All authenticated requests use credentials: 'include' so the browser
// automatically sends the httpOnly cookie — no token param needed.

// Settings
export async function getPublicSettings() {
  const res = await fetch(`${BASE}/settings/public`);
  return res.json();
}

// Setup
export async function getSetupStatus() {
  const res = await fetch(`${BASE}/setup/status`);
  return res.json();
}

export async function submitSetup(data) {
  const res = await fetch(`${BASE}/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Auth
export async function adminLogin(username, password) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

export async function adminLogout() {
  await fetch(`${BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
}

// Raffles — public
export async function getRaffles() {
  const res = await fetch(`${BASE}/raffles`);
  return res.json();
}

export async function getRaffle(id) {
  const res = await fetch(`${BASE}/raffles/${id}`);
  return res.json();
}

// Entries — public
export async function submitEntry(data) {
  const res = await fetch(`${BASE}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

// Admin raffles
export async function getAdminRaffles() {
  const res = await fetch(`${BASE}/raffles/admin/all`, { credentials: 'include' });
  return res.json();
}

export async function createRaffle(formData) {
  const res = await fetch(`${BASE}/raffles`, {
    method: 'POST', credentials: 'include', body: formData
  });
  return res.json();
}

export async function updateRaffle(id, formData) {
  const res = await fetch(`${BASE}/raffles/${id}`, {
    method: 'PUT', credentials: 'include', body: formData
  });
  return res.json();
}

export async function deleteRaffle(id) {
  const res = await fetch(`${BASE}/raffles/${id}`, {
    method: 'DELETE', credentials: 'include'
  });
  return res.json();
}

export async function closeRaffle(id) {
  const res = await fetch(`${BASE}/raffles/${id}/close`, {
    method: 'POST', credentials: 'include'
  });
  return res.json();
}

export async function duplicateRaffle(id) {
  const res = await fetch(`${BASE}/raffles/${id}/duplicate`, {
    method: 'POST', credentials: 'include'
  });
  return res.json();
}

export async function getRaffleEntries(id) {
  const res = await fetch(`${BASE}/raffles/${id}/entries`, { credentials: 'include' });
  return res.json();
}

export async function drawWinner(id) {
  const res = await fetch(`${BASE}/raffles/${id}/draw`, {
    method: 'POST', credentials: 'include'
  });
  return res.json();
}

export async function getRaffleWinner(id) {
  const res = await fetch(`${BASE}/raffles/${id}/winner`, { credentials: 'include' });
  return res.json();
}

export async function getCategories() {
  const res = await fetch(`${BASE}/raffles/categories/all`, { credentials: 'include' });
  return res.json();
}

export async function createCategory(name) {
  const res = await fetch(`${BASE}/raffles/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name })
  });
  return res.json();
}

// Admin users
export async function getAdminUsers() {
  const res = await fetch(`${BASE}/auth/users`, { credentials: 'include' });
  return res.json();
}

export async function createAdminUser(data) {
  const res = await fetch(`${BASE}/auth/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function updateAdminUser(id, data) {
  const res = await fetch(`${BASE}/auth/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function updateWinnerStatus(raffleId, data) {
  const res = await fetch(`${BASE}/raffles/${raffleId}/winner-status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function completeRaffle(id) {
  const res = await fetch(`${BASE}/raffles/${id}/complete`, {
    method: 'POST', credentials: 'include'
  });
  return res.json();
}

export async function getCompletedRaffles() {
  const res = await fetch(`${BASE}/raffles/admin/completed`, { credentials: 'include' });
  return res.json();
}

export async function getRevenueReport(params) {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/raffles/admin/report?${q}`, { credentials: 'include' });
  return res.json();
}

export async function getFinishedRaffles() {
  const res = await fetch(`${BASE}/raffles/admin/finished`, { credentials: 'include' });
  return res.json();
}

export async function getDeletedRaffles() {
  const res = await fetch(`${BASE}/raffles/admin/deleted`, { credentials: 'include' });
  return res.json();
}

export async function restoreRaffle(id) {
  const res = await fetch(`${BASE}/raffles/${id}/restore`, {
    method: 'POST', credentials: 'include'
  });
  return res.json();
}

export async function deleteImage(raffleId, imageId) {
  const res = await fetch(`${BASE}/raffles/${raffleId}/images/${imageId}`, {
    method: 'DELETE', credentials: 'include'
  });
  return res.json();
}
