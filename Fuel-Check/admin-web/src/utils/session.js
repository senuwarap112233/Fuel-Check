const SESSION_KEY = 'fuelCheckAdminPreview';

export function getAdminSession() {
  const raw = localStorage.getItem(SESSION_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveAdminSession(sessionData) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

export function clearAdminSession() {
  localStorage.removeItem(SESSION_KEY);
}
