import { Adapter, Event } from '../types';

const STORAGE_KEY_PREFIX = 'cqrs_events_';
const OUTBOX_KEY = 'cqrs_outbox';

export class BrowserAdapter {
    // Add static name property for transparency in EventStore logging
    static get name() { return 'BrowserAdapter'; }

    // Instance wrapper if needed, or static usage. 
    // The Interface in types.ts implies instance methods, but our code uses static.
    // Let's stick to static for now but type safety might complain if we try to assign Class to Interface.
    // Actually EventStore.ts uses `currentAdapter.readEvents` which calls static if currentAdapter IS the class.
    // To satisfy TS interface, we might need an instance or change interface to allow static (which TS doesn't support easily in interfaces).
    // Correct approach for this "Micro Framework": Cast the Class to `any` or loose Adapter type, OR make methods instance methods.
    // To keep changes minimal: I will implement the methods as static but arguably compatible shape.

    private static getStreamKey(type: string, id: string) {
        return `${STORAGE_KEY_PREFIX}${type}_${id}`;
    }

    static async saveToStream(event: Event): Promise<void> {
        const key = this.getStreamKey(event.aggregateType, event.aggregateId);
        const json = localStorage.getItem(key);
        const events: Event[] = json ? JSON.parse(json) : [];

        // Idempotency Check: Don't add if already exists
        if (!events.find(e => e.eventId === event.eventId)) {
            events.push(event);
            // Sort by version/timestamp (safeguard)
            events.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
            localStorage.setItem(key, JSON.stringify(events));
        }
    }

    static async readEvents(aggregateType: string, aggregateId: string): Promise<Event[]> {
        const key = this.getStreamKey(aggregateType, aggregateId);
        const json = localStorage.getItem(key);
        return json ? JSON.parse(json) : [];
    }

    static async addToOutbox(event: Event): Promise<void> {
        const json = localStorage.getItem(OUTBOX_KEY);
        const outbox: Event[] = json ? JSON.parse(json) : [];
        outbox.push(event);
        localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
    }

    static getOutbox(): Event[] {
        const json = localStorage.getItem(OUTBOX_KEY);
        return JSON.parse(json || '[]');
    }

    static async removeFromOutbox(eventIds: string[]): Promise<void> {
        let outbox = this.getOutbox();
        outbox = outbox.filter(e => !eventIds.includes(e.eventId));
        localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
    }
}
