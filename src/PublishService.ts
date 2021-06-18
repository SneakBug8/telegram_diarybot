import { foldername, Logger } from "./logger";

import * as Client from "ftp";
import * as fs from "fs-extra";
import * as path from "path";
import { Server } from ".";

class PublishServiceClass {
    public PublishLast() {
        const c = new Client();
        c.on("ready", () => {
            const filename = Logger.getFilename();
            const filepath = Logger.resolveFile(filename);

            Server.SendMessage(`Uploaded ${filepath} to ${filename}.txt`);

            c.put(filepath, filename + ".txt", (err) => {
                if (err) {throw err; }
                c.end();
            });
        });

        c.connect({
            host: "lextorg.myjino.ru",
            user: "lextorg_telegram",
            password: "alphaomega"
        });
    }

    public DownloadLast() {
        const c = new Client();
        c.on("ready", async () => {
            const filename = Logger.getFilename();
            const filepath = Logger.resolveFile(filename);

            Server.SendMessage(`Downloaded ${filename}.txt to ${filepath}`);

            await fs.ensureFile(filepath);

            c.get(filename + ".txt", (err, stream) => {
                if (err) {throw err; }
                stream.once("close", () => { c.end(); });
                stream.pipe(fs.createWriteStream(filepath));
            });
        });

        c.connect({
            host: "lextorg.myjino.ru",
            user: "lextorg_telegram",
            password: "alphaomega"
        });
    }
}

export const PublishService = new PublishServiceClass();