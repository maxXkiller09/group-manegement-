const handlers = [];
const CHANGE_EVENT = "nexguard:back-stack-change";

function notifyChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function registerBack(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("Back handler must be a function");
  }
  const existing = handlers.lastIndexOf(handler);
  if (existing !== -1) handlers.splice(existing, 1);
  handlers.push(handler);
  notifyChange();
  return handler;
}

export function unregisterBack(handler) {
  const index = handlers.lastIndexOf(handler);
  if (index === -1) return false;
  handlers.splice(index, 1);
  notifyChange();
  return true;
}

export function handleBack() {
  const handler = handlers[handlers.length - 1];
  if (!handler) return false;
  handler();
  return true;
}

export function hasBackHandler() {
  return handlers.length > 0;
}

export function onBackChange(handler) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, handler);
  return () => window.removeEventListener(CHANGE_EVENT, handler);
}
