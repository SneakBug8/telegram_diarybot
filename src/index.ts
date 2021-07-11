import * as dotenv from "dotenv";
dotenv.config();

import TelegramBot = require("node-telegram-bot-api");
import { Logger } from "./notes/logger";
import { BotAPI } from "./api/bot";
import { MessageWrapper } from "./MessageWrapper";
import { AuthService } from "./AuthService";
import { PublishService } from "./PublishService";
import { InitNotes, LogNote, ProcessNotes } from "./notes/Notes";
import { InitNetworking, ProcessNetworking } from "./networking/Networking";
import { Config } from "./config";
import { ProcessTimer } from "./timer/timer";
import { ProcessEval } from "./eval/eval";
import { InitLearning, ProcessLearning } from "./learning/Learning";
import { ImageGenProcess } from "./imagegen/ImageGen";

function sleep(ms: number)
{
    return new Promise((resolve) =>
    {
        setTimeout(resolve, ms);
    });
}

let waitingCallback: ((message: MessageWrapper) => any) | null = null;

export function setWaitingForValue(callback: (message: MessageWrapper) => any)
{
    waitingCallback = callback;
}

export function defaultKeyboard(): TelegramBot.KeyboardButton[][]
{
    return [
        [{ text: "/slots" }, { text: "/slot prev" }, { text: "/slot next" }],
        [{ text: "/path" }, { text: "/logs" }, { text: "/reset" }],
        [{ text: "/publish" }, { text: "/load" }],
        [{ text: "/networking" }, { text: "/learning" }, { text: "/timer" }],
    ];
}

class App
{
    private bot: TelegramBot;

    public constructor()
    {
        this.bot = BotAPI;

        InitNotes();
        InitNetworking();
        InitLearning();

        console.log(Config.projectPath());

        this.bot.on("text", async (msg) =>
        {
            const message = new MessageWrapper(msg);
            const time = message.getPrintableTime();
            console.log(`[${time}] ${msg.text}`);

            if (message.checkRegex(/\/id/)) {
                message.reply(`Current chat id: ${message.message.chat.id}`); return;
            }

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

            if (waitingCallback) {
                await waitingCallback.call(this, message);
                waitingCallback = null;

                return true;
            }

            if (message.checkRegex(/\/exit/)) {
                return message.reply("Main module.");
            }

            if (process.env.networkingenabled === "yes") {
                const m2 = await ProcessNetworking(message);
                if (m2 !== false) {
                    return;
                }
            }

            if (process.env.timersenabled === "yes") {
                const m3 = await ProcessTimer(message);
                if (m3 !== false) {
                    return;
                }
            }

            if (process.env.notesenabled === "yes") {
                const m1 = await ProcessNotes(message);
                if (m1 !== false) {
                    return;
                }
            }

            if (process.env.evalenabled === "yes") {
                const m4 = await ProcessEval(message);
                if (m4 !== false) {
                    return;
                }
            }

            if (process.env.imagegen === "yes") {
                const m6 = await ImageGenProcess(message);
                if (m6 !== false) {
                    return;
                }
            }

            if (process.env.learning === "yes") {
                const m5 = await ProcessLearning(message);
                if (m5 !== false) {
                    return;
                }
            }

            if (message.checkRegex(/^\/.*$/)) {
                return message.deleteAfterTime(1);
            }

            if (process.env.notesenabled === "yes") {
                await LogNote(message);
            }
            else {
                message.reply("Unknown command");
            }
        });
    }

    public async SendMessage(text: string, keyboard: TelegramBot.KeyboardButton[][] | null = null)
    {
        console.log(text);
        const msg = await BotAPI.sendMessage(Config.DefaultChat, text, {
            parse_mode: "Markdown",
            reply_markup: {
                keyboard: keyboard || defaultKeyboard(),
            }
        });
        return new MessageWrapper(msg);
    }
}

export const Server = new App();

console.log("Bot started");
