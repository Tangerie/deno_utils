export type Resolver<T> = (value: T | PromiseLike<T>) => void;
export type Reject = (err : unknown) => void;
export type QueueCaller<T> = () => Promise<T>