# Kiln

[Kiln](https://kiln.adityamer.dev) — chat that makes real things.

Ask in plain language and get back working pages, documents, spreadsheets and slide decks, with live web search and your choice of model.

## Key Features

- **Makes artifacts**: pages, documents, spreadsheets and slide decks you can preview and export (`.docx`, `.xlsx`, `.pptx`)
- **Live web search**: searches the web on its own, reads pasted links automatically
- **Deep Research mode**: in-depth research on complex topics
- **Model choice**: gateway model picker with effort control (instant → high), priced by model and effort
- **Voice input**: dictation with gateway transcription
- **Privacy-focused**: chat history stored locally in your browser (Local Storage + IndexedDB)
- **Admin dashboard**: manage models, usage and access

## Architecture

Kiln is built as a monorepo:

```
├── apps/
│   └── web/         # Next.js web application
│
└── packages/
    ├── ai/          # AI models and workflow orchestration
    ├── actions/     # Shared actions and API handlers
    ├── common/      # Common utilities, hooks and UI
    ├── orchestrator/# Workflow engine and task management
    ├── prisma/      # Database schema and client
    ├── shared/      # Shared types, constants and brand config
    ├── ui/          # Reusable UI components
    ├── tailwind-config/ # Shared Tailwind configuration
    └── typescript-config/ # Shared TypeScript configuration
```

Product identity (name, domain, tagline, description, support address) lives in one place: `packages/shared/config/brand.ts`.

## Tech Stack

### Frontend

- **Next.js 16**: React framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Animations
- **Tiptap**: Rich text editor
- **Zustand**: State management
- **Dexie.js**: IndexedDB interaction
- **AI SDK**: Unified interface for multiple AI providers

### Development

- **Turborepo**: Monorepo management
- **Bun**: JavaScript runtime and package manager
- **ESLint & Prettier**: Code quality tools
- **Husky**: Git hooks

## Getting Started

### Prerequisites

- Ensure you have `bun` installed

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Aditya190803/kiln.git
cd kiln
```

2. Install dependencies:

```bash
bun install
```

3. Configure environment:

```bash
cp apps/web/.env.example apps/web/.env.local
```

`TINYFISH_API_KEY` enables web search + page reading (free tier from agent.tinyfish.ai, falls back to `SERPER_API_KEY`, then DuckDuckGo).

4. Start the development server:

```bash
bun dev
```

5. Open your browser and navigate to `http://localhost:3000`

To change the name, domain or tagline, edit `packages/shared/config/brand.ts` — page titles, sidebar, manifest, and legal copy all follow it.
