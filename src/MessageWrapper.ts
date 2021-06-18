import TelegramBot = require("node-telegram-bot-api");
import { BotAPI } from "./api/bot";
import dateFormat = require("dateformat");

export class MessageWrapper
{
    public message: TelegramBot.Message;

    constructor(message: TelegramBot.Message)
    {
        this.message = message;
    }

    public deleteAfterTime(minutes: number)
    {
        setTimeout(() =>
        {
            BotAPI.deleteMessage(this.message.chat.id, this.message.message_id.toString());
            console.log(`Deleting message ${this.message.message_id}`);
        }, 1000 * 60 * minutes);

        return this;
    }

    public async reply(text: string)
    {
        const msg = await BotAPI.sendMessage(this.message.chat.id, text || "None.");
        return new MessageWrapper(msg);
    }

    public async replyMany(texts: string[])
    {
        const res = [];
        for (const message of texts) {
            const msg = await BotAPI.sendMessage(this.message.chat.id, message);
            res.push(new MessageWrapper(msg));
        }
        return res;
    }

    public checkRegex(regexp: RegExp)
    {
        if (!this.message.text) {
            return false;
        }

        return regexp.test(this.message.text);
    }

    public captureRegex(regexp: RegExp)
    {
        if (!this.message.text) {
            return undefined;
        }

        const captures = regexp.exec(this.message.text);

        if (!captures) { return undefined; }

        return captures;
    }

    public getPrintableTime()
    {
        const now = this.message.date * 1000;
        return dateFormat(now, "HH:MM");
    }
}
