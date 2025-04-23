import { Database } from "jsr:@db/sqlite";

const handles = new Map<string, { count: number, handle: Database }>();

interface DatabaseConfig {
    path: string;
    readonly: boolean;
}

interface ActiveConfig {
    onOpen(db : Database) : void;
    onClose(db : Database) : void;
}

const activeConfig : ActiveConfig = {
    onOpen: (_db) => {},
    onClose: (_db) => {}
}

export const setDbHandlerOpen = (func : ActiveConfig["onOpen"]) : void => {
    activeConfig.onOpen = func;
}

export const setDbHandlerClose = (func : ActiveConfig["onClose"]) : void => {
    activeConfig.onClose = func;
}

export const openDbHandler = (cfg : DatabaseConfig) : Database => {
    const key = JSON.stringify(cfg);

    if(handles.has(key)) {
        handles.get(key)!.count++;
        return handles.get(key)!.handle;
    }

    const db = new Database(cfg.path, {
        readonly: cfg.readonly
    }) as Database & { _close: Database["close"] };
    
   activeConfig.onOpen(db);

    Object.assign(db, { _close: db.close });
    
    Object.assign(db, {
        close() {
            handles.get(key)!.count--;
            if(handles.get(key)!.count === 0) {
                if(!cfg.readonly) { 
                    db.exec("PRAGMA analysis_limit=400; PRAGMA optimize;");
                }
                activeConfig.onClose(db);
                db._close();
                Object.assign(db, { close: db._close });
                handles.delete(key);
            }
        }
    });
    
    handles.set(key, {
        count: 1,
        handle: db
    });

    return db as Database;
}