import { EventEmitter } from "events";

const globalForTransactionEvents = globalThis as unknown as {
  transactionEvents: EventEmitter | undefined;
};

export const transactionEvents = globalForTransactionEvents.transactionEvents ?? new EventEmitter();
transactionEvents.setMaxListeners(0);

if (process.env.NODE_ENV !== "production") {
  globalForTransactionEvents.transactionEvents = transactionEvents;
}

export function emitTransactionChanged() {
  transactionEvents.emit("changed");
}
