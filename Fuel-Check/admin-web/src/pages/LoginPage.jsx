import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { loginAdmin } from '../services/authApi';
import { saveAdminSession } from '../utils/session';

const initialForm = {
  username: '',
  password: '',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ text: '', kind: '' });

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = () => {
    const nextErrors = { username: '', password: '' };

    if (!form.username.trim()) {
      nextErrors.username = 'User name is required.';
    }

    if (!form.password) {
      nextErrors.password = 'Password is required.';
    }

    setErrors(nextErrors);
    return !nextErrors.username && !nextErrors.password;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setStatus({ text: '', kind: '' });

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const result = await loginAdmin(form);
      saveAdminSession(result);

      const redirectPath = location.state?.from?.pathname || '/admin/overview';
      navigate(redirectPath, { replace: true });
    } catch {
      setStatus({
        text: 'Invalid username or password.',
        kind: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="top-bar">
        <h1>Admin Dashboard</h1>
      </header>

      <main className="login-stage">
        <section className="login-card" aria-label="Admin login">
          <form className="login-form" onSubmit={onSubmit} noValidate>
            <label htmlFor="username">User name</label>
            <input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={onChange}
              autoComplete="username"
            />
            <p className="field-error">{errors.username}</p>

            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              autoComplete="current-password"
            />
            <p className="field-error">{errors.password}</p>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Log in'}
            </button>

            <p className={`status-text ${status.kind}`}>{status.text}</p>
          </form>
        </section>
      </main>
    </div>
  );
}
