import * as fs from "fs-extra";
import * as path from "path";

import * as dateFormat from "dateformat";
import { Server } from "..";
import { Config } from "../config";
import { Slots } from "./Slots";

export const foldername: string = "diary";

class LoggerService
{
    public getFilename()
    {
        return Slots.getFilename();
    }

    public generateFilename()
    {
        return dateFormat(Date.now(), "yyyy/yyyymmddHHMM");
    }

    public async Log(message: string, checkdate = true)
    {
        const filename = this.getFilename();

        const filepath = this.resolveFile(filename);

        let newfile = false;

        if (!await fs.pathExists(filepath)) {
            await fs.ensureFile(filepath);

            if (!message.includes("# ")) {
                await fs.appendFile(filepath,
                    `# Telegram ${filename}`);
            }

            newfile = true;
        }

        fs.appendFile(filepath, "\n\n" + await this.ParseMessage(message));

        if (newfile) {
            return "Created new file " + filename;
        }
    }

    public async ParseMessage(message: string): Promise<string>
    {
        message = message.replace("\\n", "\r\n");
        return message;
    }

    public async GetLogs(date?: string)
    {
        let filename: string;

        if (!date) {
            filename = this.getFilename();
        }
        else {
            filename = date;
        }

        console.log("Reading logs " + filename);

        const filepath = this.resolveFile(filename);

        if (!await fs.pathExists(filepath)) {
            return "No such logfile";
        }

        const logs = await fs.readFile(filepath);

        if (logs) {
            return logs.toString();
        }
        else {
            return "Empty logs";
        }
    }

    public async DeleteFile(filename?: string)
    {
        if (!filename) {
            filename = this.getFilename();
        }
        const filepath = this.resolveFile(filename);
        await fs.remove(filepath);
        return `Removed file ${filename} completely`;
    }

    public async listFiles(directory?: string)
    {
        const f = path.resolve(Config.projectPath(), `${foldername}`, directory || "");
        const files = await fs.readdir(f);

        let res = "";
        for (const file of files) {
            const newpath = path.resolve(f, file);

            if (file.includes(".")) {
                const filename = path.relative(path.resolve(Config.projectPath(), `${foldername}`), newpath);
                res += filename.replace(".md", "") + "\n";
            }
            else {
                await this.listFiles(newpath);
            }
        }

        if (res) {
            await Server.SendMessage(res);
        }
    }

    public resolveFile(filename: string)
    {
        return path.resolve(Config.projectPath(), `${foldername}`, filename + ".md");
    }

    public SetFilename(filename: string)
    {
        const filepath = this.resolveFile(filename);
        const exists = fs.pathExistsSync(filepath);
        Slots.setFilename(filename);
        return `File set to ${filename}. File exists: ${exists}`;
    }

    public ResetFile()
    {
        Slots.setFilename("");
    }
}

export const Logger = new LoggerService();
