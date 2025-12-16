export type EventCallback<TArgs extends unknown[]> = (...args : TArgs) => any;
export type EventWaitPredicate<TArgs extends unknown[]> = (...args : TArgs) => boolean;
export type EventRemover = () => void;
export type EventMap = Record<string, unknown[]>;