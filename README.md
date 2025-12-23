# SmartSaveAI

A grocery price comparison app that helps you save money by tracking prices across multiple stores.

## Features

- Track prices across 5 local stores (Acme, Giant, Walmart, Costco, Aldi)
- Compare prices to find the best deals
- Enter receipts quickly with auto-complete
- Smart visual indicators (green = best price, red = worst price)
- Mobile-responsive design

## Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL database)
- **Deployment:** Vercel

## Running Locally

1. Clone the repo
2. Install dependencies: `npm install`
3. Create `.env.local` with Supabase credentials:
```
   NEXT_PUBLIC_SUPABASE_URL=your_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key_here
```
4. Run dev server: `npm run dev`
5. Open http://localhost:3000

## Current Status

**MVP/Demo Mode:** Currently using a shared user_id for all data. This allows easy testing but means all users see the same data. Perfect for a single household, but will need multi-tenancy (household/family accounts) before broader release.

## Roadmap

- [ ] Add authentication + household system
- [ ] Price history tracking over time
- [ ] Automated price alerts
- [ ] Price prediction based on historical trends
- [ ] Store-specific sale cycle tracking
- [ ] Export/backup functionality

## Live Demo

https://smartsaveai.vercel.app/