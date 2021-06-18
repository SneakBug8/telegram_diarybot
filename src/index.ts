import * as dotenv from "dotenv";
dotenv.config();

import TelegramBot = require("node-telegram-bot-api");
import { Logger } from "./logger";
import { BotAPI } from "./api/bot";
import { MessageWrapper } from "./MessageWrapper";
import { AuthService } from "./AuthService";
import { PublishService } from "./PublishService";

function sleep(ms: number)
{
    return new Promise((resolve) =>
    {
        setTimeout(resolve, ms);
    });
}

class App
{
    private bot: TelegramBot;

    public constructor()
    {
        this.bot = BotAPI;

        this.bot.on("text", async (msg) =>
        {
            const message = new MessageWrapper(msg);
            const time = message.getPrintableTime();
            console.log(`[${time}] ${msg.text}`);

            if (message.checkRegex(/\/auth/)) {
                AuthService.ResetAuth();
            }

            let res = false;
            if (!AuthService.HasAuth()) {
                res = AuthService.TryAuth(msg.text + "", msg.chat.id);
                if (res) {
                    message.reply("Authorized successfuly")
                    .then((newmsg) => newmsg.deleteAfterTime(1));
                    return;
                }
                else {
                    message.reply("Wrong password")
                    .then((newmsg) => newmsg.deleteAfterTime(1));
                    return;
                }
            }
            else {
                res = AuthService.CheckAuth(msg.chat.id);
            }

            if (!res) {
                message.reply("You are not authorized")
                .then((newmsg) => newmsg.deleteAfterTime(1));
                return;
            }

            if (!msg.text) {
                return;
            }

            if (message.checkRegex(/\/path/)) {
                return message.reply(`Current path: ${Logger.getFilename()}`)
                .then((newmsg) => newmsg.deleteAfterTime(1));
            }

            if (message.checkRegex(/\/publish/)) {
                return PublishService.PublishLast();
            }

            if (message.checkRegex(/\/load/)) {
                return PublishService.DownloadLast();
            }

            if (message.checkRegex(/\/space/)) {
                return Logger.Log("\n---\n", false);
            }

            if (message.checkRegex(/\/ping/)) {
                return message
                    .deleteAfterTime(1)
                    .reply("Pong")
                    .then((newmsg) => newmsg.deleteAfterTime(1));
            }

            if (message.checkRegex(/\/reset/)) {
                Logger.ResetFile();
                return message.reply("File path reset.")
                .then((newmsg) => newmsg.deleteAfterTime(1));
            }

            if (message.checkRegex(/\/files/)) {
                Logger.listFiles();
                return message;
            }

            if (message.checkRegex(/\/file .+/)) {
                const capture = message.captureRegex(/\/file (.+)/);

                if (!capture) {
                    return;
                }

                return message.reply(Logger.SetFilename(capture[1]))
                .then((newmsg) => newmsg.deleteAfterTime(1));
            }

            // today logs
            if (message.checkRegex(/^\/log$/)) {
                // const today = dateFormat(Date.now(), "yyyy-mm-dd");

                return message
                    .reply(await Logger.GetLogs())
                    .then((newmsg) => newmsg.deleteAfterTime(5));
            }

            if (message.checkRegex(/^\/logs$/)) {
                // const today = dateFormat(Date.now(), "yyyy-mm-dd");

                const logs = await Logger.GetLogs();
                return message
                    .deleteAfterTime(1)
                    .replyMany(logs.split("---"))
                    .then((messages) =>
                    {
                        for (const newmsg of messages) {
                            newmsg.deleteAfterTime(5);
                        }
                    });
            }

            const logregexp = new RegExp("\/get (.+)");
            if (message.checkRegex(logregexp)) {
                const filematch = message.captureRegex(logregexp);

                if (!filematch) {
                    return;
                }

                return message
                    .deleteAfterTime(1)
                    .reply(await Logger.GetLogs(filematch[1]))
                    .then((newmsg) => newmsg.deleteAfterTime(15));
            }

            const logsregexp = new RegExp("\/logs (.+)");
            if (message.checkRegex(logsregexp)) {
                const datematches = message.captureRegex(logsregexp);

                if (!datematches) {
                    return;
                }

                const logs = await Logger.GetLogs(datematches[1]);
                return message.deleteAfterTime(1)
                    .replyMany(logs.split("---"))
                    .then((msgs) =>
                    {
                        for (const newmsg of msgs) {
                            newmsg.deleteAfterTime(15);
                        }
                    });
            }

            if (message.checkRegex(/\/delete/)) {
                return message.reply(await Logger.DeleteFile());
            }

            if (message.checkRegex(/\/delete (.+)/)) {
                const filename = message.captureRegex(/\/delete (.+)/);

                if (!filename) {
                    return;
                }

                return message
                    .deleteAfterTime(1)
                    .reply(await Logger.DeleteFile(filename[1]))
                    .then((newmsg) => newmsg.deleteAfterTime(1));
            }

            if (message.checkRegex(/^\/.*$/)) {
                message.deleteAfterTime(1);
            }
            else {
                const r = await Logger.Log(msg.text);
                message.reply(r || "✔").then((newmsg) => newmsg.deleteAfterTime(1));
            }
        });
    }

    public async SendMessage(text: string)
    {
        console.log(text);
        const msg = await BotAPI.sendMessage(AuthService.chatId + "", text);
        return new MessageWrapper(msg);
    }
}

export const Server = new App();

console.log("Bot started");
