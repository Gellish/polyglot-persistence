import fs from 'fs';
import path from 'path';

const STORAGE_ROOT = './storage/events';
const AGGREGATES_DIR = path.join(STORAGE_ROOT, 'aggregates');
const OUTBOX_FILE = path.join(STORAGE_ROOT, 'outbox.json');

// Ensure root structure exists
if (!fs.existsSync(AGGREGATES_DIR)) {
    fs.mkdirSync(AGGREGATES_DIR, { recursive: true });
}

import { Adapter, Event } from '../types';

export class FileAdapter {
    static get name() { return 'FileAdapter'; }

    static async saveToStream(event: Event): Promise<void> {
        // Create aggregate folder: storage/events/aggregates/{type}/{type}-{id}
        // Note: Vite Plugin uses "slug--id", but here we stick to "type-id" for simplicity in CLI
        // Key is the nested folder structure.

        const typeDir = path.join(AGGREGATES_DIR, event.aggregateType);
        if (!fs.existsSync(typeDir)) {
            fs.mkdirSync(typeDir, { recursive: true });
        }

        const aggregateDirName = `${event.aggregateType}-${event.aggregateId}`;
        const aggregatePath = path.join(typeDir, aggregateDirName);

        if (!fs.existsSync(aggregatePath)) {
            fs.mkdirSync(aggregatePath, { recursive: true });
        }

        // Write file: event-{uuid}.json
        // (FileAdapter writes individual files, VitePlugin writes segments. 
        // We should arguably align to segments too, but for Seed, individual files are fine 
        // IF the reader supports them. VitePlugin reader supports segments.
        // Wait, VitePlugin reader ONLY supports segments: `f.startsWith('segment-')`.
        // So FileAdapter MUST write segments or VitePlugin won't see it.)

        // Let's implement simple Segment logic here too.
        const fileName = 'segment-001.json';
        const filePath = path.join(aggregatePath, fileName);

        let batch: Event[] = [];
        if (fs.existsSync(filePath)) {
            batch = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }

        if (!batch.find(e => e.eventId === event.eventId)) {
            batch.push(event);
            fs.writeFileSync(filePath, JSON.stringify(batch, null, 2));
        }
    }

    static async readEvents(aggregateType: string, aggregateId: string): Promise<Event[]> {
        // storage/events/aggregates/{type}/{type}-{id}
        const aggregateDirName = `${aggregateType}-${aggregateId}`;
        const aggregatePath = path.join(AGGREGATES_DIR, aggregateType, aggregateDirName);

        if (!fs.existsSync(aggregatePath)) {
            return [];
        }

        // Read segments
        const files = fs.readdirSync(aggregatePath).filter(f => f.startsWith('segment-') && f.endsWith('.json'));
        const events: Event[] = [];

        files.forEach(file => {
            const content = fs.readFileSync(path.join(aggregatePath, file), 'utf-8');
            const batch = JSON.parse(content);
            events.push(...batch);
        });

        // Sort by version or timestamp
        events.sort((a: any, b: any) => (a.version || 0) - (b.version || 0));

        return events;
    }

    static async addToOutbox(event: Event): Promise<void> {
        // In "File Mode" (Backend), typically we don't have an "Outbox" to sync elsewhere
        // But if this is a Node.js CLI tool syncing to another server, we might.
        // For now, let's implement a simple file-based outbox just in case.
        let outbox: Event[] = [];
        if (fs.existsSync(OUTBOX_FILE)) {
            outbox = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf-8'));
        }
        outbox.push(event);
        fs.writeFileSync(OUTBOX_FILE, JSON.stringify(outbox, null, 2));
    }

    static getOutbox(): Event[] {
        if (!fs.existsSync(OUTBOX_FILE)) return [];
        return JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf-8'));
    }

    static async removeFromOutbox(eventIds: string[]): Promise<void> {
        if (!fs.existsSync(OUTBOX_FILE)) return;
        let outbox: Event[] = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf-8'));
        outbox = outbox.filter(e => !eventIds.includes(e.eventId));
        fs.writeFileSync(OUTBOX_FILE, JSON.stringify(outbox, null, 2));
    }
}
