import { Database } from "@db/sqlite";
import type { KeyValueConfig, KeyValueEntry, KeyValueKey } from "./types.ts";

function dbFromConfig(cfg : KeyValueConfig) {
    if(typeof cfg === "string") {
        return new Database(cfg, {
            int64: true
        });
    } else {
        return new Database(":memory:", {
            int64: true,
            memory: true
        });
    }
}

export class KeyValue {
    private db : Database;
    private isClosed : boolean;

    constructor(cfg : KeyValueConfig) {
        this.db = dbFromConfig(cfg);
        this.setup();
        this.removeExpired();
        this.isClosed = false;
    }

    private setup() : void {
        this.db.exec(`PRAGMA journal_mode = WAL;
        PRAGMA synchronous = normal;
        PRAGMA journal_size_limit = 6144000;
        PRAGMA foreign_keys = ON;`);

        this.db.exec(`--sql
        CREATE TABLE IF NOT EXISTS data (
            key JSON NOT NULL PRIMARY KEY,
            value JSON NOT NULL,
            expiresAt BIGINT
        );
        `);
    }

    private removeExpired() : void {
        const currentMs = Date.now();
        this.db.exec("DELETE FROM data WHERE expiresAt IS NOT NULL AND expiresAt < ?", currentMs);
    }

    private checkClosed() : void {
        if(this.isClosed) throw new Error("KeyValue already Closed");
    }

    public close() : void {
        if(this.isClosed) return;
        this.isClosed = true;
        this.db.exec("PRAGMA analysis_limit=400; PRAGMA optimize;");
        this.db.close();
    }

    [Symbol.dispose]() {
        this.close();
    }

    private isValidKey(key : KeyValueKey) {
        return key.length > 0 && !key.some(x => typeof x === "string" ? x.trim().length === 0 : false)
    }

    private stringifyKey(key : KeyValueKey) {
        return JSON.stringify(key);
    }

    private _get<T>(key : KeyValueKey) : KeyValueEntry<T> | undefined  {
        const stmt = this.db.prepare("SELECT * FROM data WHERE key = ?");
        const result = stmt.get<KeyValueEntry<T>>(this.stringifyKey(key));
        stmt.finalize();
        if(!result) return undefined;
        if(result.expiresAt) {
            const currentMs = Date.now();
            if(result.expiresAt < currentMs) {
                this.removeExpired();
                return undefined;
            }
        }
        return result;
    }

    public get<T>(key : KeyValueKey, _default?: T) : T | undefined {
        this.checkClosed();
        return this._get<T>(key)?.value ?? _default;
    }

    public set<T>(key : KeyValueKey, value : T, expiresInMs?: number) : boolean {
        this.checkClosed();
        if(!this.isValidKey(key)) throw new Error("Invalid Key");
        const expiresAt = expiresInMs === undefined ? null : Date.now() + Math.max(expiresInMs, 0);
        const changes = this.db.exec(`--sql
            INSERT OR REPLACE INTO data (key, value, expiresAt) VALUES (?, ?, ?)
        `, this.stringifyKey(key), JSON.stringify(value), expiresAt);
        return changes > 0;
    }

    public delete(key : KeyValueKey) : boolean {
        this.checkClosed();
        const changes = this.db.exec("DELETE FROM data WHERE key = ?", this.stringifyKey(key)); 
        return changes > 0;
    }

    public has(key : KeyValueKey) : boolean {
        this.checkClosed();
        const stmt = this.db.prepare("SELECT count(key) as cnt FROM data WHERE key = ?");
        const result = stmt.get<{cnt : number}>(this.stringifyKey(key));
        stmt.finalize();
        return result?.cnt === 1;
    }

    public clear() : void {
        this.checkClosed();
        this.db.exec("DELETE FROM data;");
    }    
}