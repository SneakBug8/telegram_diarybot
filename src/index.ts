import * as dotenv from "dotenv";
dotenv.config();

import TelegramBot = require("node-telegram-bot-api");
import { Logger } from "./logger";
import { BotAPI } from "./api/bot";
import { MessageWrapper } from "./MessageWrapper";
import { AuthService } from "./AuthService";
import { PublishService } from "./PublishService";
import { ProcessNotes } from "./notes/Notes";
import { InitNetworking, ProcessNetworking } from "./networking/Networking";
import { Config } from "./config";

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

        InitNetworking();

        this.bot.on("text", async (msg) =>
        {
            const message = new MessageWrapper(msg);
            const time = message.getPrintableTime();
            console.log(`[${time}] ${msg.text}`);

            if (message.checkRegex(/\/auth/)) {
                AuthService.ResetAuth();
            }

            let res = AuthService.CheckAuth(msg.chat.id);
            if (!res) {
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

            if (!res) {
                message.reply("You are not authorized")
                    .then((newmsg) => newmsg.deleteAfterTime(1));
                return;
            }

            if (!msg.text) {
                return;
            }

            const m2 = await ProcessNetworking(message);
            if (m2 !== false) {
                return;
            }

            const m1 = await ProcessNotes(message);
            if (m1 !== false) {
                return;
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
        const msg = await BotAPI.sendMessage(Config.DefaultChat, text);
        return new MessageWrapper(msg);
    }
}

export const Server = new App();

console.log("Bot started");
