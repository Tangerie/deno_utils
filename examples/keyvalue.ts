import { sleep } from "../internal/sleep.ts";
import { KeyValue } from "../keyvalue/mod.ts";

using kv = new KeyValue(".cache/keyvalue.sqlite3");

kv.set(["key"], { test: "a" });
console.log(kv.get(["key"]));


kv.set(["key"], { test: "b" }, 1000);
await sleep(500);
console.log(kv.get(["key"]));
await sleep(600);
console.log(kv.get(["key"]));

kv.set(["key"], { test: "c" });
console.log(kv.get(["key"]));
console.log(kv.has(["key"]));
kv.delete(["key"]);
console.log(kv.get(["key"]));
console.log(kv.get(["key"], "DEFAULT"));
console.log(kv.has(["key"]));