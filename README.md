# Khatod Hospital — Patient Management (frontend prototype)

"You are in safe hands." HTML + CSS + vanilla JavaScript. No backend.

## Run it locally
1. Unzip the folder and double-click `index.html` (or run `python3 -m http.server` and open http://localhost:8000).
2. Internet is needed for the fonts (Inter, Cormorant Garamond) and Lucide icons. PDF reports need no internet.

## Login and roles (demo)
The site opens on `login.html`.
- **Patient login:** enter the mobile number saved on a patient record, then the 6-digit code. The code expires after 5 minutes, allows 3 attempts and the resend button waits 30 seconds. In this demo the "SMS" is shown on screen. Patients see only the records linked to their number and their own place in today's list.
- **Staff login:** desk manager (`desk@khatod.demo` / `desk123`) can register patients, use today's list and view patients. Manager (`manager@khatod.demo` / `manager123`) can do everything, including reports, calendar, PDFs, editing and settings.
- **This is a demo only.** Passwords and codes are handled in the browser, so it is not secure. Real accounts, SMS sending and role checks must be done on a server (backend stage).

## How it works
- **Registering a patient** adds them to that day's appointment list and gives new patients a unique ID (KH-1013, KH-1014 ...). IDs are never reused.
- **Returning patients:** type a name (or ID or phone) in the registration form; matching patients appear in a dropdown. Choosing one fills in their details and adds them to today's list under their existing ID.
- **Appointments page** is today's list: first added is on top; the checkbox strikes a name out but keeps the record.
- **Patients page** is the permanent directory.
- **Calendar:** click a date to view or download that day's PDF (made in the browser from the saved list by `js/pdf.js`).

## Data
Saved in this browser (`localStorage`, key `khatod_hospital_v2`), not on a server. The system starts with sample patients and past days so the calendar and PDFs can be tried; Settings > Remove sample data deletes only those.

## Folder structure
```
index.html              Dashboard
pages/                  registration, appointments, patients, patient-profile, calendar, reports
css/                    style.css, forms.css, dashboard.css, responsive.css
js/                     main.js (data), navigation.js, patients.js, appointments.js,
                        calendar.js, pdf.js (PDF writer + report), dashboard.js
```

## Needs a backend in the next stage
- Shared database so all computers see the same patients and lists
- Server-issued unique patient IDs and server-side duplicate checks
- Reports generated and stored automatically at the end of each day (a website cannot run by itself at midnight)
- Staff login, roles, audit logs, backups and encryption
- Optional patient self pre-registration with phone verification and staff approval

## Backend (started)
The `backend/` folder holds a basic Express server (no database yet). See `backend/server.js`. Start it with `cd backend`, `npm install`, `npm run dev`, then open http://localhost:3000/api/health. The frontend does not call it yet.
