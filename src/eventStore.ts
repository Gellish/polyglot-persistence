import { uuidv4 } from './uuid';
import { BrowserAdapter } from './adapters/browser';
import { Adapter, Event } from './types';

// Default to Browser Adapter if in browser environment
let currentAdapter: Adapter | null = (typeof window !== 'undefined') ? (BrowserAdapter as unknown as Adapter) : null;

/**
 * Universal Event Store
 * Defaults to BrowserAdapter (LocalStorage).
 * For Node.js, you must call `EventStore.setAdapter(FileAdapter)`.
 */
export class EventStore {

    static setAdapter(adapter: Adapter) {
        currentAdapter = adapter;
        console.log(`[EventStore] Adapter configured: ${adapter['name'] || 'Custom'}`);
    }

    static async writeEvent(eventData: Partial<Event> & { aggregateId: string; aggregateType: string; eventType: string; payload: any }) {
        if (!currentAdapter) throw new Error('EventStore adapter not configured (and not in browser).');

        // Auto-Versioning
        let nextVersion = eventData.version;
        if (!nextVersion) {
            const existingEvents = await currentAdapter.readEvents(eventData.aggregateType, eventData.aggregateId);
            nextVersion = existingEvents.length + 1;
        }

        const event: Event = {
            ...eventData,
            eventId: uuidv4(),
            timestamp: new Date().toISOString(),
            version: nextVersion
        };

        // Delegate to adapter
        await currentAdapter.saveToStream(event);
        await currentAdapter.addToOutbox(event);

        return event;
    }

    static async readEvents(aggregateType: string, aggregateId: string): Promise<Event[]> {
        if (!currentAdapter) return [];
        return currentAdapter.readEvents(aggregateType, aggregateId);
    }

    static async saveToStream(event: Event) {
        if (!currentAdapter) return;
        return currentAdapter.saveToStream(event);
    }

    static getOutbox(): Event[] {
        if (!currentAdapter) return [];
        return currentAdapter.getOutbox();
    }

    static removeFromOutbox(ids: string[]) {
        if (!currentAdapter) return;
        return currentAdapter.removeFromOutbox(ids);
    }
}
