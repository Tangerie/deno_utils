import type { EventCallback, EventMap, EventRemover, EventWaitPredicate } from "./types.ts";

export class Emitter<TEventMap extends EventMap> {
    private listeners = new Map<keyof TEventMap, Set<EventCallback<any[]>>>();

    public on<K extends keyof TEventMap>(type : K, callback : EventCallback<TEventMap[K]>) : EventRemover {
        if(!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(callback);
        return () => this.remove(type, callback);
    }

    public once<K extends keyof TEventMap>(type : K, callback : EventCallback<TEventMap[K]>) : EventRemover {
        const cb : typeof callback = (...args) => { callback(...args); this.remove(type, cb); } 
        return this.on(type, cb);
    }

    public emit<K extends keyof TEventMap>(type : K, ...args : TEventMap[K]) {
        this.listeners.get(type)?.forEach(cb => cb(...args));
    }

    public remove<K extends keyof TEventMap>(type : K, callback : EventCallback<TEventMap[K]>) {
        this.listeners.get(type)?.delete(callback);
    }

    public removeAll<K extends keyof TEventMap>(type : K) {
        this.listeners.set(type, new Set());
    }

    public wait<K extends keyof TEventMap>(type : K, predicate ?: EventWaitPredicate<TEventMap[K]>) : Promise<TEventMap[K]> {
        if(!predicate) return new Promise(resolve => this.once(type, (...args) => resolve(args)));
        return new Promise(resolve => {
            const cb : EventCallback<TEventMap[K]> = (...args) => {
                if(predicate(...args)) {
                    this.remove(type, cb);
                    resolve(args);
                }
            }
            this.on(type, cb);
        });
    }
}

export function hideEmit<TEventMap extends EventMap>(emitter : Emitter<TEventMap>) {
    return {
        on: emitter.on.bind(emitter),
        once: emitter.once.bind(emitter),
        remove: emitter.remove.bind(emitter),
        removeAll: emitter.removeAll.bind(emitter),
        wait: emitter.wait.bind(emitter)
    }
}