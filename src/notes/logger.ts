import * as fs from "fs-extra";
import * as path from "path";

import * as dateFormat from "dateformat";
import { Server } from "..";
import { Config } from "../config";
import { Slots } from "./Slots";
import { NoteChange } from "./NoteChange";
import { PublishService } from "./PublishService";
import { WebApi } from "../api/web";
import { MIS_DT } from "../util/MIS_DT";
import * as express from "express";
import { Color } from "../util/Color";

export const foldername: string = "diary";

const changes = new Array<NoteChange>();

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

    public async getTitle(filename: string)
    {
        const filepath = this.resolveFile(filename);

        if (!await fs.pathExists(filepath)) {
            return "No such logfile";
        }

        const logs = await fs.readFile(filepath);

        if (new RegExp("#(.+)\n").test(logs.toString())) {
            const titlematch = new RegExp("# *(.+)\n").exec(logs.toString());
            return (titlematch && titlematch.length) ? titlematch[1] : filename;
        }
        else {
            return filename;
        }
    }

    public async Log(message: string, checkdate = true)
    {
        const filename = this.getFilename();
        const filepath = this.resolveFile(filename);

        let newfile = false;

        let addedtext = "";

        if (!await fs.pathExists(filepath)) {
            await fs.ensureFile(filepath);

            if (!message.includes("# ")) {
                const header = `# Telegram ${filename}`;
                await fs.appendFile(filepath, header);
                addedtext += header;
            }

            newfile = true;
        }

        const text = "\n\n" + await this.ParseMessage(message);
        fs.appendFile(filepath, text);
        addedtext += text;

        const change = new NoteChange(filename, addedtext, newfile);
        const r = await NoteChange.Insert(change);
        changes.push(r);

        // PublishService.QueuePublishing(filename);
        // PublishService.Publish(filename);

        if (newfile) {
            return "Created new file " + filename;
        }
    }

    public async Undo()
    {
        try {
            const change = changes.pop();

            if (!change) { return "No changes to undo."; }
            const filename = change.filename;
            const filepath = this.resolveFile(filename);

            if (change.newfile) {
                fs.remove(filepath);
                return true;
            }

            let filetext = (await fs.readFile(filepath)).toString();

            filetext = filetext.substr(0, filetext.length - change.length);

            await fs.writeFile(filepath, filetext);

            if (change.Id) {
                await NoteChange.Delete(change.Id);
            }
            return true;
        }
        catch (e) {
            return e + "";
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

        // await PublishService.Download(filename, true, false);

        console.log("Reading logs " + filename);

        const filepath = this.resolveFile(filename);

        if (!await fs.pathExists(filepath)) {
            return "No such logfile";
        }

        const logs = await fs.readFile(filepath);

        if (logs.length >= 10000) {
            return `Publish the note to read more at https://wiki.sneakbug8.com/${filename}`
                + `\n-- -\n` + logs.toString().substr(logs.length - 10000, 10000);
        }
        else if (logs) {
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

    public Init()
    {
        WebApi.app.get("/notes/graph", this.OnNotesGraph);
    }

    private async OnNotesGraph(req: express.Request, res: express.Response)
    {
        const allchanges = await NoteChange.All();

        if (!allchanges) {
            return;
        }

        const created = new Array<number>();

        for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
            const c = allchanges.filter((x) => MIS_DT.RoundToDay(new Date(x.MIS_DT)) === i);

            const comb = c.reduce((p, c) => p + c.length, 0);

            created.push(comb);
        }
        // console.log(`${proj.subject}: ${arr}`);

        const datasets = new Array<object>();

        datasets.push({
            label: "Chars written",
            data: created,
            borderColor: Color.GetColor(0),
            fill: "origin",
            backgroundColor: Color.GetBackground(0)
        });

        const labels = [];

        for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
            labels.push(MIS_DT.FormatDate(i));
        }

        res.json({ datasets, labels });
    }
}

export const Logger = new LoggerService();
