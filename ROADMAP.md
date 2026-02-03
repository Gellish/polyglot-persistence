# Polyglot Persistence: Master Roadmap 🚀

This document outlines the strategic vision for the "Polyglot Persistence" framework, ensuring it scales from a local dev tool to a global, high-throughput event streaming architecture.

## 📍 Phase 1: Foundation (Current Status: ✅ Completed)
**Goal:** A solid, offline-first Event Store running locally.
- [x] **Event Sourcing Core**: Immutable `Event` objects (`eventId`, `aggregateId`, `type`, `payload`).
- [x] **Local Persistence**: `vite-plugin` interceptor saving to `storage/events`.
- [x] **Segmented Storage**: Events grouped by `aggregateType` and batched in `segment-XXX.json` (max 100 events) to support 1TB+ locally.
- [x] **Type Safety**: Full TypeScript migration for robust debugging.
- [x] **Dashboard**: Local Admin UI for debugging, seeding, and syncing.
- [x] **Dynamic Data Grid**: Airtable-like interface with dynamic columns, column visibility persistence, and Drag-and-Drop reordering.

---

## 🏗️ Phase 2: Hybrid Cloud Storage (The "Polyglot" Step)
**Goal:** Move "Cold" data to cheaper storage while keeping "Hot" data fast.
- [ ] **S3 Adapter**: Implement `src/adapters/s3.ts`.
    - **Strategy**: When a `segment-XXX.json` is full (100 events), upload it to S3/R2/MinIO.
    - **Benefit**: Infinite storage limit, no local disk pressure.
- [ ] **Redis/KV Adapter**: Implement `src/adapters/kv.ts` for "Head" state.
    - **Strategy**: Keep only the *latest* aggregate state (Snapshot) in Redis for instant read access.
- [ ] **Tiered Access**:
    - **Hot**: Recent events in Memory/KV.
    - **Warm**: Recent segments on Local Disk.
    - **Cold**: Older segments on S3.

---

## ⚡ Phase 3: Event Streaming (High Throughput)
**Goal:** Decouple Write throughput from Read latency.
- [ ] **Kafka / Redpanda Integration**:
    - **Producer**: `EventStore.writeEvent` pushes to a Kafka Topic (`events.all`).
    - **Consumer**: A separate worker reads Kafka and writes to S3 (Archival) and Postgres (Queries).
- [ ] **CQRS Strict Separation**:
    - **Write Side**: Accepts command -> Validates -> Pushes to Queue (Sub-millisecond response).
    - **Read Side**: Async workers update View Models (SQL/ElasticSearch).

---

## 🔮 Phase 4: Global Replication (Edge)
**Goal:** Sub-millisecond latency for users worldwide.
- [ ] **Edge Workers**: Run `vite-plugin` equivalent on Cloudflare Workers or Deno Deploy.
- [ ] **Multi-Region Sync**: Use active-active replication for the Event Log.

---

## 🛡️ Appendix: Safety & Limits
- **Immutability**: Never overwrite a `segment` once it is "sealed" (full).
- **Sanitization**: All filenames must use the `sanitize()` function to prevent traversal.
- **Verification**: Checksums (SHA256) for Segment files before uploading to Cloud.
