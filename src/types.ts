export interface Event {
    eventId: string;
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    payload: any;
    version?: number;
    timestamp?: string;
}

export interface Aggregate {
    type: string;
    id: string;
    version: number;
    key: string;
    events: Event[];
}

export interface Adapter {
    name?: string;
    readEvents(aggregateType: string, aggregateId: string): Promise<Event[]>;
    saveToStream(event: Event): Promise<void>;
    addToOutbox(event: Event): Promise<void>;
    getOutbox(): Event[];
    removeFromOutbox(eventIds: string[]): Promise<void>;
}
