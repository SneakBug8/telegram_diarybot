import { foldername, Logger } from "./logger";

import * as Client from "ftp";
import * as fs from "fs-extra";
import * as path from "path";
import { Server } from ".";
import { Config } from "./config";

class PublishServiceClass
{
    public FormatFileBeforePublishing(text: string)
    {
        text = text.replace("\n", "\n\n");

        return text;
    }

    public PublishLast() {
        const c = new Client();
        c.on("ready", () => {
            const filename = Logger.getFilename();
            const filepath = Logger.resolveFile(filename);

            Server.SendMessage(`Uploaded ${filepath} to ${filename}.txt`);

            const tempfilepath = path.resolve(Config.basePath(), "temp.md");
            fs.copyFileSync(filepath, tempfilepath);
            const text = fs.readFileSync(tempfilepath);
            const newtext = this.FormatFileBeforePublishing(text.toString());
            fs.writeFileSync(tempfilepath, newtext);

            const fragments = path.dirname(filename);

            c.mkdir(fragments, true, (err) => {
                if (err) {throw err; }
            });

            c.put(tempfilepath, filename + ".txt", (err) => {
                if (err) {throw err; }
                c.end();
            });
        });

        c.connect({
            host: Config.ftphost(),
            user: Config.ftpuser(),
            password: Config.ftppassword(),
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
            host: Config.ftphost(),
            user: Config.ftpuser(),
            password: Config.ftppassword(),
        });
    }
}

export const PublishService = new PublishServiceClass();