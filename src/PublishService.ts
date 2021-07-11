import { foldername, Logger } from "./notes/logger";

import * as Client from "ftp";
import * as fs from "fs-extra";
import * as path from "path";
import { Server } from ".";
import { Config } from "./config";

class PublishServiceClass
{
    public FormatFileBeforePublishing(text: string)
    {
        text = text.replace(new RegExp("\n"), "\n\n");

        return text;
    }

    public PublishLast()
    {
        const c = new Client();
        c.on("ready", () =>
        {
            const filename = Logger.getFilename();
            const filepath = Logger.resolveFile(filename);

            // Make temporary file with better formating for upload
            const tempfilepath = path.resolve(Config.basePath(), "temp.md");
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

                Server.SendMessage(`Uploaded ${filepath} to ${filename}.txt`)
                    .then((x) => x.deleteAfterTime(1));
                c.end();
            });
        });

        c.connect({
            host: Config.ftphost(),
            user: Config.ftpuser(),
            password: Config.ftppassword(),
        });
    }

    public DownloadLast()
    {
        const c = new Client();
        c.on("ready", async () =>
        {
            const filename = Logger.getFilename();
            const filepath = Logger.resolveFile(filename);

            await fs.ensureFile(filepath);

            c.size(filename + ".txt", (err, size) =>
            {
                if (!size) {
                    Server.SendMessage(`No file ${filename}.txt on remote server.`)
                        .then((x) => x.deleteAfterTime(1));
                    return;
                }

                c.get(filename + ".txt", (err2, stream) =>
                {
                    if (err2) { throw err; }
                    stream.once("close", () => { c.end(); });
                    stream.pipe(fs.createWriteStream(filepath));

                    Server.SendMessage(`Downloaded ${filename}.txt to ${filepath}`)
                        .then((x) => x.deleteAfterTime(1));
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
    }
}

export const PublishService = new PublishServiceClass();