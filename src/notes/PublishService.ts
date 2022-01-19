import { foldername, Logger } from "./logger";

import * as Client from "ftp";
import * as fs from "fs-extra";
import * as path from "path";
import { Server } from "..";
import { Config } from "../config";
import { BotAPI } from "../api/bot";
import { Sleep } from "../util/Sleep";

class PublishServiceClass
{
    private DownloadCache = new Array<string>();
    private PublishQueue = new Array<string>();

    public FormatFileBeforePublishing(text: string)
    {
        text = text.replace(new RegExp("\n"), "\n\n");

        return text;
    }

    private lastSend = 0;

    public Interval()
    {
        const now = new Date(Date.now());

        if (now.getHours() === 6 && now.getMinutes() <= 30 && this.lastSend !== now.getDay()) {
            console.log(`Removed ${this.DownloadCache.length} items from Download Cache`);
            this.DownloadCache = [];
            this.lastSend = now.getDay();
        }

        if (this.PublishQueue.length) {
            console.log(`Publishing ${this.PublishQueue.length} items`);
        }
        while (this.PublishQueue.length) {
            const item = this.PublishQueue.pop();
            if (item) {
                this.Publish(item);
            }
        }
    }

    public PublishLast(verbose = false)
    {
        const filename = Logger.getFilename();
        return this.Publish(filename, verbose);
    }

    public QueuePublishing(filename: string)
    {
        return this.PublishQueue.push(filename);
    }

    public Publish(filename: string, verbose = false)
    {
        try {
            const c = new Client();
            c.on("ready", () =>
            {
                const filepath = Logger.resolveFile(filename);

                // Make temporary file with better formating for upload
                const tempfilepath = path.resolve(Config.dataPath(), "temp.md");
                fs.copyFileSync(filepath, tempfilepath);
                const text = fs.readFileSync(tempfilepath);
                const newtext = this.FormatFileBeforePublishing(text.toString());
                fs.writeFileSync(tempfilepath, newtext);

                const fragments = path.dirname(filename);

                // Ensure remote has needed folder for upload
                c.mkdir(fragments, true, (err) =>
                {
                    if (err) { throw err; }
                });

                c.put(tempfilepath, filename + ".txt", (err) =>
                {
                    if (err) { throw err; }

                    if (verbose) {
                        Server.SendMessage(`Uploaded ${filepath} to ${filename}.txt`)
                            .then((x) => x.deleteAfterTime(1));
                    }
                    c.end();
                });
            });

            c.connect({
                host: Config.ftphost(),
                user: Config.ftpuser(),
                password: Config.ftppassword(),
            });
        }
        catch (e) {
            console.error(e);
            Server.SendMessage(JSON.stringify(e) || "null");
        }
    }

    public async DownloadLast(force = false, verbose = false)
    {
        const filename = Logger.getFilename();
        return await this.Download(filename, force, verbose);
    }

    public async Download(filename: string, force = false, verbose = false)
    {
        if (!force && this.DownloadCache.includes(filename)) {
            return;
        }

        let blocker = true;

        const c = new Client();
        c.on("ready", async () =>
        {
            const filepath = Logger.resolveFile(filename);

            await fs.ensureFile(filepath);

            c.size(filename + ".txt", (err, size) =>
            {
                if (!size) {
                    if (verbose) {
                        Server.SendMessage(`No file ${filename}.txt on remote server.`)
                            .then((x) => x.deleteAfterTime(1));
                    }
                    return;
                }

                c.get(filename + ".txt", (err2, stream) =>
                {
                    if (err2) { throw err; }
                    stream.once("close", () => { c.end(); });
                    stream.pipe(fs.createWriteStream(filepath));

                    if (verbose) {
                        Server.SendMessage(`Downloaded ${filename}.txt to ${filepath}`)
                            .then((x) => x.deleteAfterTime(1));
                    }

                    blocker = false;
                });
            });
        });

        console.log({
            host: Config.ftphost(),
            user: Config.ftpuser(),
            password: Config.ftppassword(),
        });

        c.connect({
            host: Config.ftphost(),
            user: Config.ftpuser(),
            password: Config.ftppassword(),
        });

        while (blocker) {
            await Sleep(1000);
        }

        this.DownloadCache.push(filename);
    }
}

export const PublishService = new PublishServiceClass();