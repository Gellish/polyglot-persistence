import { describe, it, expect, beforeEach } from 'vitest';
import { EventStore } from '../src/eventStore';

describe('EventStore Integration', () => {
    beforeEach(() => {
        localStorage.clear();
        // Force adapter initialization if needed, but it defaults to BrowserAdapter in jsdom
    });

    it('should save an event to localStorage', async () => {
        const eventId = 'test-id-1';
        await EventStore.writeEvent({
            aggregateId: eventId,
            aggregateType: 'test-item',
            eventType: 'ITEM_CREATED',
            payload: { name: 'Test' }
        });

        // Verify it exists in LocalStorage
        // Based on app.ts logic, it should look for 'cqrs_events_...'
        const key = `cqrs_events_test-item_${eventId}`;
        const stored = localStorage.getItem(key);
        expect(stored).not.toBeNull();

        const events = JSON.parse(stored!);
        expect(events).toHaveLength(1);
        expect(events[0].payload.name).toBe('Test');
    });

    it('should read events back via EventStore', async () => {
        const id = 'test-id-2';
        await EventStore.writeEvent({
            aggregateId: id,
            aggregateType: 'user',
            eventType: 'USER_CREATED',
            payload: { name: 'Alice' }
        });

        const events = await EventStore.readEvents('user', id);
        expect(events).toHaveLength(1);
        expect(events[0].payload.name).toBe('Alice');
    });

    it('should auto-increment version', async () => {
        const id = 'test-id-3';
        const e1 = await EventStore.writeEvent({
            aggregateId: id,
            aggregateType: 'counter',
            eventType: 'INC',
            payload: { val: 1 }
        });
        expect(e1.version).toBe(1);

        const e2 = await EventStore.writeEvent({
            aggregateId: id,
            aggregateType: 'counter',
            eventType: 'INC',
            payload: { val: 2 }
        });
        expect(e2.version).toBe(2);
    });

    it('should seed database with example data', async () => {
        const { seedDatabase } = await import('../src/seed');
        const { userId, pageId } = await seedDatabase();

        const userEvents = await EventStore.readEvents('user', userId);
        expect(userEvents).toHaveLength(1);
        expect(userEvents[0].payload.name).toBe('Demo User');

        const pageEvents = await EventStore.readEvents('page', pageId);
        expect(pageEvents).toHaveLength(2); // Created + Updated
        expect(pageEvents[1].payload.content).toContain('Hello World');
    });
});
