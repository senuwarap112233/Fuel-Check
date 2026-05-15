# Fuel-Check New User Guide

This document explains the full software structure, major functions, and logic flow of the Fuel-Check project for a new developer or operator.

## 1. What This Software Is

Fuel-Check has two applications in one workspace:

1. Mobile app (Expo React Native): for residents and fuel station owners.
2. Admin web app (Vite React): for monitoring reports and approving fuel stations.

Both apps use Supabase for authentication and data.

## 2. Top-Level Project Structure

- `App.js`: mobile app root navigation and auth bootstrap.
- `index.js`: Expo root registration.
- `lib/supabase.js`: Supabase client and auth storage setup.
- `src/components/*`: login/signup UI blocks.
- `src/screens/*`: mobile feature screens and tab navigators.
- `admin-web/*`: separate React web admin app.
- `sql.txt`, `sql_new.txt`: database schema scripts/reference.
- `Fuel-Check/*`: duplicated copy of the same project (older/parallel copy).

## 3. Runtime Architecture

## 3.1 Mobile App

- Framework: Expo + React Native.
- Navigation:
1. Root stack in `App.js`.
2. Role-specific tabs (`UserTabs` for residents, `ShedTabs` for stations).
- Auth source: Supabase auth session.
- Role detection:
1. Check `profiles` table for resident role.
2. Check `sheds` table for station role.

## 3.2 Admin Web App

- Framework: React + Vite + React Router.
- Auth model: fixed admin credentials, session in localStorage.
- Route protection: `ProtectedRoute` checks stored session validity.

## 3.3 Backend (Supabase)

- Auth provider: email/password.
- Database: Postgres tables for users, sheds, stocks, reports, filters.
- Storage bucket: `verification-docs` for station registration documents.

## 4. Mobile App: File-by-File Logic

## 4.1 Entry and Core

### `index.js`
- Registers `App` with Expo `registerRootComponent`.

### `App.js`
Main exported function: `App()`

State:
- `initializing`
- `session`
- `userRole`

Key logic:
1. `fetchUserRole(userId)`:
- Checks `profiles` first, then `sheds`.
- Uses a timeout fallback (3.5s) to avoid hanging UI.
- Defaults to `resident` if role check fails.
2. `initializeAuth()` in `useEffect`:
- Waits a short startup delay.
- Calls `supabase.auth.getUser()` and `getSession()`.
- Restores session and role on cold start.
3. `onAuthStateChange` listener:
- Updates session/role on login/logout.
4. Deep linking config:
- `fuelcheck://login`
- `fuelcheck://signup`
- `fuelcheck://reset-password`
- `fuelcheck://shed-dashboard`
- `fuelcheck://user-dashboard`
5. Conditional navigation:
- No session: login/signup/reset screens.
- Session + shed role: `ShedTabs`.
- Session + resident role: `UserTabs`.

### `lib/supabase.js`
- Creates Supabase client with:
1. Project base URL.
2. anon key.
3. SecureStore persistence adapters (`getItem`, `setItem`, `removeItem`).
4. `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`.

## 4.2 Components (`src/components`)

### `UserLogin.js`
Default export: `UserLogin({ navigation })`

Functions:
1. `handleSignIn()`:
- Validates email/password.
- Calls `supabase.auth.signInWithPassword`.
- Verifies `profiles` entry for signed-in user.
- On success: `navigation.replace('UserDashboard')`.
- On mismatch: signs out and alerts.
2. `handleForgotPassword()`:
- Sends reset email via `resetPasswordForEmail`.
- Uses redirect URL `https://fuelcheckresetpassword.vercel.app/`.

### `ShedLogin.js`
Default export: `ShedLogin({ navigation })`

Functions:
1. `handleSignIn()`:
- Sign in with Supabase auth.
- Verifies user exists in `sheds` table.
- On success: `navigation.replace('ShedDashboard')`.
- On mismatch: signs out and alerts.
2. `handleForgotPassword()`:
- Same reset flow as resident login.

### `UserSignup.js`
Default export: `UserSignup({ navigation })`

Core signup flow:
1. Validate required fields + password confirmation.
2. `supabase.auth.signUp(...)`.
3. Insert profile row into `profiles`.
4. Sign out so user verifies email first.

### `ShedSignup.js`
Default export: `ShedSignup({ navigation })`

Core signup flow:
1. Validate station fields, password, terms, location, and document.
2. Create auth user via `signUp`.
3. Upload station verification PDF to `verification-docs` bucket.
4. Insert `sheds` row with station details, coordinates, doc URL, `is_verified: false`.
5. Sign out and show success message.

Extra logic:
- Location capture by GPS and map picker.
- Document pick/read/upload pipeline.

## 4.3 Screens (`src/screens`)

### `LoginPage.js`
Default export: `LoginPage({ navigation })`
- UI wrapper that toggles resident or shed login components.

### `SignupPage.js`
Default export: `SignupPage({ navigation })`
- UI wrapper that toggles resident or shed signup components.

### `ResetPasswordScreen.js`
Default export: `ResetPasswordScreen({ navigation })`

Main logic:
1. Validate new password length and confirmation.
2. `supabase.auth.updateUser({ password })`.
3. Navigate back to login on success.

### `UserTabs.js`
Default export: `UserTabs()`
- Bottom tabs:
1. `UserHome`
2. `UserFilters`
3. `UserSubmitReport`
4. `UserAccount`

### `ShedTabs.js`
Default export: `ShedTabs()`
- Bottom tabs:
1. `ShedHome`
2. `ShedSubmitReport`
3. `ShedProfile`

### `UserHome.js`
Default export: `UserHome({ navigation })`

Main logic:
1. Fetch current user location.
2. Fetch verified sheds.
3. Read fuel stock and recent community reports.
4. Calculate queue and distance metrics.
5. Render map markers + list view with filters.

### `UserFilters.js`
Default export: `UserFilters({ navigation })`

Main logic:
1. Load existing `user_filters` for current user.
2. Allow fuel type and queue threshold selection.
3. `handleApply`: upsert filters.
4. `resetFilters`: restore defaults.

### `UserSubmitReport.js`
Default export: `UserSubmitReport()`

Main logic:
1. Show shed markers on map.
2. User selects shed + fuel type + stock level + queue length + vehicle type + comment.
3. Insert row into `community_reports`.

### `UserAccount.js`
Default export: `UserAccount({ navigation })`

Main logic:
1. Fetch current user profile from `profiles`.
2. Fetch user's submitted `community_reports`.
3. Update profile details (`first_name`, `last_name`).

### `ShedHome.js`
Default export: `ShedHome()`

Main logic:
1. Get station user id from auth.
2. Read that station's `fuel_stocks`.
3. Present stock/price/arrival summaries by fuel type.

### `ShedSubmitReport.js`
Default export: `ShedSubmitReport()`

Main logic:
1. Choose fuel type.
2. Load existing row for selected type.
3. Edit stock liters, price, next arrival.
4. Upsert into `fuel_stocks` using `(shed_id, fuel_type)` conflict target.

### `ShedProfile.js`
Default export: `ShedProfile({ navigation })`

Main logic:
1. Read shed profile details from `sheds`.
2. Display station info + map preview.
3. Logout with `supabase.auth.signOut()` and return to login.



## 5. Mobile Auth and Navigation Flow

1. App boots.
2. `App.js` restores existing auth session (if any).
3. App determines role from database tables.
4. Navigation goes to:
- Unauthenticated stack (login/signup/reset), or
- `UserTabs`, or
- `ShedTabs`.
5. Login screens perform a second role check to prevent wrong-account entry.

Password reset flow:
1. User requests reset from login.
2. Supabase emails reset link to provided email.
3. User opens link and sets new password on reset screen.

## 6. Admin Web App: File-by-File Logic

## 6.1 Entry and Routing

### `admin-web/src/main.jsx`
- Renders app with router setup.

### `admin-web/src/App.jsx`
Default export: `App()`

Routes:
1. `/login` -> `LoginPage`
2. `/admin/*` -> protected by `ProtectedRoute` and wrapped by `AdminLayout`
3. Nested admin routes:
- `overview`
- `fuel-stations`
- `reports`

## 6.2 Auth and Session

### `admin-web/src/services/authApi.js`
Export: `loginAdmin(payload)`

Logic:
1. Reads credentials from env: `VITE_ADMIN_USERNAME`, `VITE_ADMIN_PASSWORD`.
2. Validates input.
3. Returns fixed token session object on success.
4. Throws errors on mismatch or missing config.

### `admin-web/src/utils/session.js`
Exports:
1. `getAdminSession()`
2. `saveAdminSession(sessionData)`
3. `clearAdminSession()`
4. `isValidAdminSession(session)`

Logic:
- Stores session under localStorage key `fuelCheckAdminPreview`.
- Validates session against fixed username and fixed token.

Important note:
- `isValidAdminSession` expects username `fuelcheckadmin`.
- Your `.env` username must match this expectation.

### `admin-web/src/components/navigation/ProtectedRoute.jsx`
Default export: `ProtectedRoute({ children })`
- Checks `isValidAdminSession`.
- Redirects to `/login` if invalid.

## 6.3 Admin UI Logic

### `admin-web/src/components/layout/AdminLayout.jsx`
- Common admin shell with sidebar and nested route outlet.

### `admin-web/src/pages/LoginPage.jsx`
Default export: `LoginPage()`

Logic:
1. Submit username/password.
2. `loginAdmin` validation.
3. Save session.
4. Navigate to overview.

### `admin-web/src/pages/OverviewPage.jsx`
Default export: `OverviewPage()`

Logic:
- Aggregates dashboard metrics from Supabase:
1. user counts
2. station counts
3. report counts (including today)
4. pending/critical status summaries

### `admin-web/src/pages/FuelStationsPage.jsx`
Default export: `FuelStationsPage()`

Logic:
1. Load stations list and status.
2. Split pending vs approved.
3. Approve action -> set `is_verified = true`.
4. Reject action -> delete station record.
5. Open verification document from storage URL.

### `admin-web/src/pages/ReportsPage.jsx`
Default export: `ReportsPage()`

Logic:
- Fetch all `community_reports`.
- Sort/reverse by newest.
- Display summary table for admin review.

### `admin-web/src/pages/UsersPage.jsx`
- Present in project, but not currently wired into `App.jsx` routes.

## 7. Supabase Data Model Used by Code

Main tables referenced by app logic:

1. `profiles`
- Resident account metadata.
- Used in resident login verification, account screen, admin counts.

2. `sheds`
- Fuel station master records.
- Includes geolocation, contact, and verification status.

3. `fuel_stocks`
- Shed fuel stock details by type.
- Used by user map/list and shed stock update screens.

4. `community_reports`
- Resident-submitted crowd reports.
- Used by user history, user map indicators, and admin reports.

5. `user_filters`
- User's preferred fuel type and queue thresholds.

Storage bucket:
- `verification-docs` for shed registration documents.

## 8. Setup and Run Instructions

## 8.1 Mobile App

From project root:

```bash
npm install
npm start
```

Optional platform commands:

```bash
npm run android
npm run ios
npm run web
```

## 8.2 Admin Web App

From `admin-web`:

```bash
npm install
npm run dev
```

Build/preview:

```bash
npm run build
npm run preview
```

## 8.3 Required Admin Environment Variables

In `admin-web/.env`:

```env
VITE_ADMIN_USERNAME=fuelcheckadmin
VITE_ADMIN_PASSWORD=<your-password>
```

## 9. New User Quick Start Checklist

1. Install dependencies in both root and `admin-web`.
2. Confirm Supabase URL/key in `lib/supabase.js`.
3. Ensure required database tables and storage bucket exist.
4. Set admin `.env` credentials (username should be `fuelcheckadmin`).
5. Start mobile app with Expo.
6. Start admin app with Vite.
7. Test flows in this order:
- Resident signup/login/reset.
- Shed signup/login and stock update.
- User report submission.
- Admin login and shed approval.

## 10. Troubleshooting Notes

1. If sessions are not restoring on startup:
- Check `lib/supabase.js` uses base Supabase URL (not `/rest/v1`).
- Check SecureStore auth persistence config.
2. If login succeeds but wrong dashboard loads:
- Verify row existence in `profiles` or `sheds` for that auth user id.
3. If admin login succeeds but protected pages redirect to login:
- Confirm `VITE_ADMIN_USERNAME` equals `fuelcheckadmin` to satisfy `isValidAdminSession`.
4. If shed document links fail:
- Confirm `verification-docs` bucket exists and permissions allow reads as configured.

---

If you want, this guide can be expanded further into:
- API-level call traces by function,
- sequence diagrams for each role,
- and a deployment checklist for production hardening.
