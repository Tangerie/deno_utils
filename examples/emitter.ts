import { Emitter } from "@tangerie/utils/emitter";

type EventMap = {
    "start": [],
    "message": [name: string, other: [number]],
    "close": []
}

const emitter = new Emitter<EventMap>();

emitter.on("start", () => console.log("Start"));
emitter.once("message", (name, data) => console.log(name, data));