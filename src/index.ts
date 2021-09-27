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
import { InitNotifier, ProcessNotifier } from "./notifier/Notifier";
import { InitProjects, ProcessProjects } from "./projects/Projects";
import { InitInvestment, ProcessInvestments } from "./investment/Investment";
import { InitBackup, ProcessBackup } from "./backup/BackupService";
import { InitCrypto, ProcessCrypto } from "./investment/CryptoController";
import { InitCryptoNotifications, ProcessCryptoNotifications } from "./investment/CryptoNotificationsController";

let waitingCallback: ((message: MessageWrapper) => any) | null = null;

export function setWaitingForValue(message: string, callback: (message: MessageWrapper) => any)
{
    Server.SendMessage(message, [[{ text: "/exit" }]]);
    waitingCallback = callback;
}

export function setWaitingForValuePure(callback: (message: MessageWrapper) => any)
{
    waitingCallback = callback;
}

export function defaultKeyboard(): TelegramBot.KeyboardButton[][]
{
    return [
        [{ text: "/slots" }, { text: "/slot prev" }, { text: "/slot next" }, { text: "/reset" }],
        [{ text: "/logs" }, { text: "/publish" }, { text: "/load" }, { text: "/networking" }],
        [{ text: "/crypto" }, { text: "/investment" }, { text: "/projects" }],
        [{ text: "/learning" }, { text: "/extra" }],
    ];
}

export function extraKeyboard(): TelegramBot.KeyboardButton[][]
{
    return [
        [{ text: "/notify" }, { text: "/timer" }, { text: "/networking policy set" }],
        [{ text: "/exit" },],
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
        InitNotifier();
        InitProjects();
        InitInvestment();
        InitBackup();
        InitCrypto();
        InitCryptoNotifications();

        console.log(Config.projectPath());

        this.bot.on("text", async (msg) =>
        {
            const message = new MessageWrapper(msg);
            const time = message.getPrintableTime();
            console.log(`[${time}] ${msg.text}`);

            if (message.checkRegex(/^\/id/)) {
                message.reply(`Current chat id: ${message.message.chat.id}`); return;
            }

            if (message.checkRegex(/^\/auth/)) {
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
                if (message.message.text === "/exit") {
                    waitingCallback = null; return;
                }

                const callback = waitingCallback;
                waitingCallback = null;
                await callback.call(this, message);

                return true;
            }

            if (message.checkRegex(/\/exit/)) {
                return message.reply("Main module.");
            }

            if (message.checkRegex(/\/extra/)) {
                return Server.SendMessage("Extra modules", extraKeyboard());
            }

            if (process.env.networkingenabled === "yes") {
                const m2 = await ProcessNetworking(message);
                if (m2 !== false) {
                    return;
                }
            }

            const listeners = [
                ProcessInvestments,
                ProcessCrypto,
                ProcessCryptoNotifications,
                ProcessNotes,
                ProcessLearning,
                ProcessProjects,
                ProcessBackup,
                ProcessNotifier,
                ProcessTimer,
                ProcessEval,
                ImageGenProcess
            ];

            for (const listener of listeners) {
                const r = await listener(message);
                if (r !== false) {
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
Server.SendMessage("Bot restarted");
