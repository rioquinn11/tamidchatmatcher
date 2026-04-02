# TAMID Chat Matcher

An intelligent chat-matching platform that connects TAMID members for meaningful conversations based on shared interests, professional goals, and availability — replacing the guesswork of scheduling and planning TAMID chats.

## Problem

TAMID chats are one of the best ways for new members to integrate socially and learn from experienced members, but the current process is full of friction:

- **Scheduling is painful** — coordinating across busy calendars with no unified tool leads to missed opportunities buried in Slack threads and member cards.
- **Connections are left to chance** — there's no way to predict chemistry or shared interests before a chat, so members often miss people they'd genuinely connect with.
- **Planning is vague** — even once a chat is scheduled, members struggle to find common ground or activities ahead of time.
- **Reach is limited** — interactions tend to stay within IFC, TCF, and Education, leaving less-active members disconnected.

## Solution

TAMID Chat Matcher is a dynamic planner powered by a matching algorithm that recommends chat partners based on interests, activity preferences, and availability. Members can choose whether they're looking for professional advice, shared hobbies, or casual connection — and the system handles the rest.

### Key Features

- **Smart Matching Algorithm** — ML-driven recommendations built from Notion member cards, LinkedIn profiles, user input, and historical chat data.
- **Google Calendar Integration** — Automatic availability detection and `.ics` scheduling across members.
- **Slack Reminders** — Automated notifications for upcoming chats and weekly engagement highlights.
- **Interactive Dashboard** — Real-time leaderboards, engagement metrics, and mentorship tracking for members and admins.
- **Role-Based Access** — Distinct views for education users, committee admins, and general members.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js / Next.js |
| Backend | FastAPI / Express.js |
| Database | Supabase / Firebase |
| Integrations | Google Calendar API, Slack API, Notion API, LinkedIn |
| ML / Matching | Python (scikit-learn / custom algorithm) |
| Auth | Role-based authentication with HTTPS |

## Architecture

```
┌────────────────────────────────────────────────┐
│                  Frontend (React)               │
│   Dashboards · Profiles · Leaderboards · Auth   │
└────────────────────┬───────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────┐
│              Backend API (FastAPI)              │
│  Auth · Matching Engine · Points · Scheduling  │
└──┬──────────┬──────────┬──────────┬────────────┘
   │          │          │          │
   ▼          ▼          ▼          ▼
 Supabase   Google     Slack     Notion/
   (DB)    Calendar     API     LinkedIn
```

## Project Structure

```
tamid-chat-matcher/
├── client/              # Frontend application
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Route views
│   │   └── utils/       # Helper functions
├── server/              # Backend API
│   ├── api/             # Route handlers
│   ├── services/        # Business logic & integrations
│   ├── ml/              # Matching algorithm
│   └── db/              # Schema & migrations
├── docs/                # Documentation
└── README.md
```

## Deliverables

1. **Discovery Algorithm** — Interest and reflection-based recommendations with continuous optimization from historical chat data.
2. **Calendar & Scheduling** — Automated availability matching with Google Calendar integration and Slack reminders.
3. **Data Persistence** — Storage and retrieval of chat history, reflections, and user activity.
4. **Analytics & Leaderboards** — Visual dashboards showing engagement metrics, top chatters, and mentorship data for admins.
5. **Profile Enrichment** — Unified user profiles built from LinkedIn, Slack, Notion member cards, and self-reported input.
6. **Authentication** — Secure role-based access for education users, committee admins, and general members.

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10
- Supabase or Firebase project
- API keys for Google Calendar, Slack, Notion, and LinkedIn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/tamid-chat-matcher.git
cd tamid-chat-matcher

# Install frontend dependencies
cd client && npm install

# Install backend dependencies
cd ../server && pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Add your API keys and database credentials to .env

# Start the development servers
cd ../client && npm run dev
cd ../server && uvicorn main:app --reload
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m "Add your feature"`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is developed for [TAMID at Northeastern University](https://www.tamidgroup.org/).
