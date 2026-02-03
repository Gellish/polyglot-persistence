# Polyglot Persistence 🚀

**A High-Performance, Tiered Event Sourcing Framework**

Polyglot Persistence is a lightweight yet powerful CQRS/Event Sourcing framework designed to scale from local development to global cloud architectures. It leverages the concept of "Polyglot Persistence" by distributing data across different storage tiers (Local Disk, S3, KV, Kafka) based on its "temperature" (Hot vs. Cold).

## ✨ Key Features

- **Offline-First Core**: Fully functional event store that works locally without a database.
- **Segmented Storage**: Events are batched into segments (max 100 events/file) to support Terabyte-scale event logs on local disk.
- **Type-Safe**: Written in TypeScript with a focus on developer experience and robust debugging.
- **Developer Dashboard**: Built-in Admin UI for real-time monitoring, event inspection, and manual seeding.
- **Tiered Architecture (Roadmap)**: Intelligent data migration between Local, S3, Redis, and Kafka.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

### 3. Open Dashboard
Navigate to `http://localhost:5173/dashboard/` (or the port Vite provides) to see the live event log.

## 🛠️ Architecture

Polyglot Persistence uses a simple but effective file-based event store:
- **Streams**: Every aggregate (e.g., `user-123`) has its own stream.
- **Segments**: Events are stored in `storage/events/{aggregateType}/segment-{N}.json`.
- **Sync Engine**: Automatically synchronizes local events to the backend via a Vite middleware bridge.

## 🗺️ Roadmap

See [ROADMAP.md](./ROADMAP.md) for the full vision, including S3 adapters, Redis snapshotting, and High-Throughput Kafka streaming.

## ⚖️ License
MIT
