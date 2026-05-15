const SESSION_KEY = 'fuelCheckAdminPreview';
const FIXED_ADMIN_USERNAME = 'fuelcheckadmin';
const FIXED_ADMIN_TOKEN = 'fixed-admin-token';

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

export function isValidAdminSession(session) {
  if (!session) {
    return false;
  }

  return (
    session.username === FIXED_ADMIN_USERNAME &&
    session.token === FIXED_ADMIN_TOKEN &&
    session.ok === true
  );
}
