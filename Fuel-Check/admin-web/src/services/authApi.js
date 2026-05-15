const FIXED_ADMIN_USERNAME = (import.meta.env.VITE_ADMIN_USERNAME || '').trim();
const FIXED_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || '';

export async function loginAdmin(payload) {
  await new Promise((resolve) => {
    setTimeout(resolve, 700);
  });

  if (!FIXED_ADMIN_USERNAME || !FIXED_ADMIN_PASSWORD) {
    throw new Error('Admin credentials are not configured');
  }

  const username = payload?.username?.trim();
  const password = payload?.password;

  if (username !== FIXED_ADMIN_USERNAME || password !== FIXED_ADMIN_PASSWORD) {
    throw new Error('Invalid username or password');
  }

  return {
    ok: true,
    token: 'fixed-admin-token',
    username,
  };
}
