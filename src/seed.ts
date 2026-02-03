import { EventStore } from './eventStore';
import { uuidv4 } from './uuid';

/**
 * Populates the EventStore with example data.
 * Useful for initializing the 'local database' for testing or demos.
 */
export async function seedDatabase() {
    console.log('[Seed] Starting database seeding...');

    // Generate IDs
    const userId = uuidv4();
    const pageId = uuidv4();

    // 1. Create a User
    await EventStore.writeEvent({
        aggregateId: userId,
        aggregateType: 'user',
        eventType: 'USER_CREATED',
        payload: {
            name: 'Demo User',
            email: 'demo@microframework.com',
            role: 'admin'
        },
        version: 1,
    });

    // 2. Create a Page
    await EventStore.writeEvent({
        aggregateId: pageId,
        aggregateType: 'page',
        eventType: 'PAGE_CREATED',
        payload: {
            title: 'Welcome to MicroFramework',
            slug: 'welcome-page',
            status: 'published'
        },
        version: 1
    });

    // 3. Update Page Content
    await EventStore.writeEvent({
        aggregateId: pageId,
        aggregateType: 'page',
        eventType: 'PAGE_CONTENT_UPDATED',
        payload: {
            content: '# Hello World\n\nThis content is stored in the local CQRS Event Store!'
        },
        version: 2
    });

    console.log('[Seed] Database seeded successfully!');
    console.log(`[Seed] Created User ID: ${userId}`);
    console.log(`[Seed] Created Page ID: ${pageId}`);

    return { userId, pageId };
}

// Allow running this script directly in Node.js: `npx ts-node src/seed.ts`
// Allow running this script directly in Node.js: `npx ts-node src/seed.ts`
// Ensure we are truly in Node environment and not a polyfilled browser environment
if (typeof process !== 'undefined' && process.versions && process.versions.node && process.argv && process.argv[1].endsWith('seed.ts')) {
    import('./adapters/file').then(({ FileAdapter }) => {
        EventStore.setAdapter(FileAdapter);
        seedDatabase().catch(console.error);
    });
}
