# 📦 Como Va Mi Carga — Freight Tracking App

Mobile and web freight-tracking application built for **INGELOX S.A.S.**, allowing clients to track their shipments in real time and the internal team to manage them end-to-end: creation, assignment, notifications, and support.

Built with **React Native (Expo)** for iOS/Android/Web, **Supabase** as the backend (Postgres + Edge Functions + RLS), and a custom conversational assistant powered by the **OpenAI API**.

---

## ✨ Features 

- **Passwordless authentication** — sign-in via a one-time code sent to email (OTP), through Supabase Auth.
- **Two role-based views** — internal (operations) dashboard and external (client) dashboard, enforced with Row Level Security (RLS).
- **Shipment management** — create, edit, and assign shipments (air, maritime, land) with origin, destination, ETA/ETD, and documentary cutoff date.
- **Push notifications** — via Firebase Cloud Messaging + Expo Notifications, triggered on shipment status changes.
- **AI-powered conversational assistant** — a custom chatbot (Edge Function + OpenAI `gpt-4.1-mini`) that classifies intents, queries the database in natural language, and automatically creates support tickets or hands off to a human agent.
- **Support ticket system** — internal support inbox with ticket creation, listing, and updates.
- **Multi-language** — full UI in Spanish and English (i18next).
- **Cross-platform** — a single codebase for iOS, Android, and Web (deployed on Netlify).

## 🧱 Architecture

```
app/                    → Routes (Expo Router)
  (auth)/                 protected screens: dashboard, shipments, tickets, chat, profiles
  auth/                   authentication callback
  login.tsx               OTP-based login
components/              Reusable UI components
lib/                      Supabase client, push notifications, shipment types
i18n/, locales/           i18n configuration (es/en)
supabase/functions/       8 Edge Functions (Deno):
  chatbot/                 AI assistant with intent classification
  create-shipment/         shipment creation
  createTicket/            ticket creation
  invite-user/             invite new internal users
  list-profiles/           list user profiles
  list-tickets/            list support tickets
  notify-shipment-event/   trigger push notifications
  update-tickets/          update support tickets
```

## 🛠️ Tech Stack

| Area | Technology |
|---|---|
| Frontend | React Native, Expo, Expo Router, TypeScript |
| Backend | Supabase (PostgreSQL, Edge Functions, RLS) |
| AI | OpenAI API (`gpt-4.1-mini`) |
| Notifications | Firebase Cloud Messaging, Expo Notifications |
| i18n | i18next / react-i18next |
| Deployment | Netlify (web), EAS (mobile) |

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) account and project
- A [Firebase](https://firebase.google.com) project (for push notifications)
- An [OpenAI](https://platform.openai.com) API key

### Installation

```bash
git clone https://github.com/juan-camiloo/Freight-tracking.git
cd Freight-tracking
npm install
```

### Environment variables

Create a `lib/supabase.ts` file (excluded from the repository for security reasons) with the following content, replacing the values with your own Supabase project's credentials:

```ts
import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = 'YOUR_SUPABASE_URL'
export const supabaseAnonKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Also create a `.env` file at the project root with your Firebase credentials:

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_VAPID_KEY=
```

The Edge Functions (`supabase/functions/`) require their own environment variables set in the Supabase dashboard: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Run the app

```bash
npx expo start
```

From there you can open it on Android, iOS (simulator or Expo Go), or Web.

## 📄 License

Built as a professional internship project for INGELOX S.A.S. Internal use / personal portfolio.
