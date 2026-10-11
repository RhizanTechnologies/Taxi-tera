# 🚕 Taxi Tera (ታክሲ ተራ)

> **Real-time Minibus Taxi Navigation & Fare Explorer for Addis Ababa, Ethiopia**  
> *በአዲስ አበባ የታክሲ ተራዎች፣ መስመሮች፣ የታሪፍ መረጃ እና የእግር መንገድ መሪ*

[![React](https://img.shields.io/badge/React-19.0-61dafb?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.0-646cff?logo=vite&logoColor=white)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?logo=supabase&logoColor=white)](https://supabase.com)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white)](https://leafletjs.com)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

---

## 📖 Overview

In Addis Ababa, millions of daily commuters rely on minibus taxis (*ታክሲ*) and designated taxi ranks (*ተራ*). Standard navigation apps (such as Google Maps) often miss informal transit hubs, boarding queues, and realistic taxi routes.

**Taxi Tera (ታክሲ ተራ)** fills this critical gap by mapping real taxi teras, connecting corridors, actual government fares, and step-by-step pedestrian walking routes to help commuters move confidently across the capital.

---

## ✨ Key Features

- **🗺️ 100+ Authentic Addis Ababa Taxi Teras**: Verified coordinates across major hubs including Megenagna, Bole, Mexico, Piassa, Arat Kilo, Saris, Kality, CMC, Ayat, Tor Hailoch, Merkato, and more.
- **🔀 Intelligent Multi-Hop Journey Planner**: Calculates optimal direct routes and 1-transfer connections across town with transparent fare totals and transit times.
- **🔍 Universal Bilingual & Phonetic Search**: Search seamlessly in Amharic (e.g. `መገናኛ`, `ቦሌ`, `ሳሪስ`) or English phonetic spellings (e.g. `Megenagna`, `4 Kilo`, `Piazza`). Built-in Amharic homophone normalization handles character variations (`ሀ/ሐ/ኀ`, `ሰ/ሠ`, `አ/ዐ`, `ጸ/ፀ`).
- **🚶 Door-to-Tera Walking Directions**: Real pedestrian street routing from your exact doorstep directly to where taxis line up.
- **📍 Interactive Location & Drag-and-Drop Pin**: Quick one-click selection for Addis neighborhoods, browser GPS integration, and an interactive pin dropper to pinpoint your exact location.
- **🤝 Community Moderation & Fare Verification**: Commuters can submit new teras, update fares, and flag route changes with a community verification queue.
- **📱 PWA & Mobile-First Design**: Installable on Android, iOS, and desktop with low-bandwidth optimization and offline caching.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Mapping & GIS**: Leaflet, React-Leaflet, Leaflet-Rotate, OpenStreetMap
- **Styling**: Tailored CSS Design System (*Vibrant Urban Mobility*) with Dark/Light theme support
- **State & Backend**: Supabase (PostgreSQL, Row-Level Security, Realtime)
- **Internationalization**: i18next (Amharic `am` & English `en`)
- **Icons**: Lucide React

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0 or higher)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/RhizanTechnologies/Taxi-tera.git
   cd Taxi-tera
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in your Supabase credentials:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

5. **Build for Production**:
   ```bash
   npm run build
   ```

---

## 🗄️ Database Setup

SQL migration scripts and seed datasets are available in the `supabase/` directory:

- `supabase/migration.sql`: Defines tables (`stations`, `lines`, `fares`, `contributions`, `reports`), indexes, and RLS security policies.
- `supabase/seed_real_map_et_stations.sql`: Seeds 100+ verified Addis Ababa stations and active transit lines.

To apply via the Supabase Dashboard SQL Editor, run `migration.sql` followed by `seed_real_map_et_stations.sql`.

---

## 📜 Data Sources & Licensing

- Transit map data sourced from community contributions, **OpenStreetMap** (ODbL), and **map.et / OpenPlaceGuide**.
- Map tiles: &copy; [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).

---

## 👥 Contributing

Contributions to station data, routes, and features are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feat/new-tera`)
3. Commit your Changes (`git commit -m 'feat: add Jemo 1 taxi corridor'`)
4. Push to the Branch (`git push origin feat/new-tera`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
