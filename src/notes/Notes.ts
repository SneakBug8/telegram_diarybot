import { Logger } from "./logger";
import { MessageWrapper } from "../MessageWrapper";
import { PublishService } from "../PublishService";
import { NotesData } from "./NotesData";
import * as path from "path";
import * as fs from "fs";
import { Config } from "../config";
import { MapToObject } from "../util/MapToObject";
import { Slots } from "./Slots";
import TelegramBot = require("node-telegram-bot-api");
import { setWaitingForValue } from "..";

export let NotesRepo = new NotesData();

const datafilepath = path.resolve(Config.dataPath(), "notes.json");

function yesNoKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "yes" }, { text: "no" }],
  ];
}

function waitingForPublishAnswer(msg: MessageWrapper)
{
  if (msg.message.text === "yes") {
    PublishService.PublishLast();
  }
  else {
    msg.reply("Publishing aborted.");
  }
}
function waitingForLoadAnswer(msg: MessageWrapper)
{
  if (msg.message.text === "yes") {
    PublishService.DownloadLast();
  }
  else {
    msg.reply("Loading aborted.");
  }
}

export async function InitNotes()
{
  if (fs.existsSync(datafilepath)) {
    const file = fs.readFileSync(datafilepath);

    NotesRepo = JSON.parse(file.toString()) as NotesData;
    NotesRepo.Slots = new Map(NotesRepo.Slots) as any;
    console.log(`Read ${NotesRepo.Slots.size} slots.`);
  }
  else {
    console.log(`Created new datafile for notes.`);
    NotesDataSave();
  }
}

export async function NotesDataSave()
{
  const tempdata = new NotesData();
  tempdata.Slots = MapToObject.Convert(NotesRepo.Slots) as any;
  fs.writeFileSync(datafilepath, JSON.stringify(tempdata));
}

export async function ProcessNotes(message: MessageWrapper)
{
  if (message.checkRegex(/\/slot ([0-9]+)/)) {
    const slot = message.captureRegex(/\/slot ([0-9]+)/);
    if (!slot) { return; }

    const slotind = Number.parseInt(slot[1], 10);
    Slots.changeSlot(slotind);

    /*
    const filename = data.Slots.get(slotind);
    if (data.Slots.has(slotind) && filename) {
      Logger.SetFilename(filename);
    }
    else {
      data.Slots.set(slotind, Logger.generateFilename());
    }
    NotesDataSave();*/

    return message.reply(`Using slot ${Slots.getSlot()} with file ${Slots.getFilename()}`);
  }
  if (message.checkRegex(/\/slots/)) {
    let res = "";
    for (const slot of NotesRepo.Slots) {
      res += `${slot[0]} - ${slot[1]}\n`;
    }

    res += `---\nUsing slot ${Slots.getSlot()} with file ${Slots.getFilename()}`;

    return message.reply(res).then((x) => x.deleteAfterTime(1));
  }
  if (message.checkRegex(/\/slot next/)) {
    const slotind = Slots.getSlot() + 1;
    Slots.changeSlot(slotind);
    return message.reply(`Using slot ${Slots.getSlot()} with file ${Slots.getFilename()}`);
  }
  if (message.checkRegex(/\/slot prev[ious]*/)) {
    const slotind = Slots.getSlot() - 1;
    Slots.changeSlot(slotind);
    return message.reply(`Using slot ${Slots.getSlot()} with file ${Slots.getFilename()}`);
  }
  if (message.checkRegex(/\/slot reset ([0-9]+)/)) {
    const slot = message.captureRegex(/\/slot reset ([0-9]+)/);
    if (!slot) { return; }

    const slotind = Number.parseInt(slot[1], 10);
    NotesRepo.Slots.delete(slotind);
    return message.reply(`Removed slot #${slotind}`).then((x) => x.deleteAfterTime(1));
  }
  if (message.checkRegex(/\/slot reset/)) {
    Slots.setFilename("");
    return message.reply(`Removed slot #${Slots.getSlot()}`).then((x) => x.deleteAfterTime(1));
  }
  if (message.checkRegex(/\/slots reset/)) {
    NotesRepo.Slots = new Map();
    NotesDataSave();
    return message.reply(`Cleared slots`).then((x) => x.deleteAfterTime(1));
  }
  if (message.checkRegex(/\/slot/)) {
    return message.reply(`Current slot ${Slots.getSlot()} with file ${Slots.getFilename()}`)
      .then((x) => x.deleteAfterTime(1));
  }

  if (message.checkRegex(/\/path/)) {
    return message.reply(`Current path: ${Slots.getFilename()}`)
      .then((newmsg) => newmsg.deleteAfterTime(1));
  }

  if (message.checkRegex(/\/publish/)) {
    message.reply("Are you sure you want to publish current note to remote server?", yesNoKeyboard());
    return setWaitingForValue(waitingForPublishAnswer);
  }

  if (message.checkRegex(/\/load/)) {
    message.reply("Are you sure you want to load current note from remote server?", yesNoKeyboard());
    return setWaitingForValue(waitingForLoadAnswer);
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
    Slots.setFilename("");

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

    Slots.setFilename(capture[1]);

    return message.reply(Logger.SetFilename(capture[1]))
      .then((newmsg) => newmsg.deleteAfterTime(1));
  }

  // today logs
  if (message.checkRegex(/^\/log$/) || message.checkRegex(/^\/read$/)) {
    // const today = dateFormat(Date.now(), "yyyy-mm-dd");

    const res = await Logger.GetLogs();
    if (res.length > 2048) {
      return message
        .reply(`File is too long. Use /logs instead.`)
        .then((newmsg) => newmsg.deleteAfterTime(1));
    }

    return message
      .reply(res)
      .then((newmsg) => newmsg.deleteAfterTime(5));
  }

  if (message.checkRegex(/^\/logs$/)) {
    // const today = dateFormat(Date.now(), "yyyy-mm-dd");

    const logs = await Logger.GetLogs();
    return message
      .deleteAfterTime(1)
      .replyMany(properSplit(logs))
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
      .then((newmsg) => newmsg.deleteAfterTime(5));
  }

  const logsregexp = new RegExp("\/logs (.+)");
  if (message.checkRegex(logsregexp)) {
    const datematches = message.captureRegex(logsregexp);

    if (!datematches) {
      return;
    }

    const logs = await Logger.GetLogs(datematches[1]);
    return message.deleteAfterTime(1)
      .replyMany(properSplit(logs))
      .then((msgs) =>
      {
        for (const newmsg of msgs) {
          newmsg.deleteAfterTime(5);
        }
      });
  }

  if (message.checkRegex(/\/delete/)) {
    message.reply(await Logger.DeleteFile()).then((newmsg) => newmsg.deleteAfterTime(1));
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
  return false;
}

function properSplit(note: string)
{
  const bigparts = note.split("\n\n");
  const res = new Array<string>();

  let k = "";
  for (const part of bigparts) {
    const sentences = part.split(". ");

    for (const s of sentences) {
      console.log(s);

      if (k.length + s.length > 2048) {
        res.push(k);
        k = "";
      }

      k += s + ". ";
    }
    k += "\n\n";
  }

  if (k.length) {
    res.push(k);
  }

  return res;
}

export async function LogNote(message: MessageWrapper)
{
  /*const filename = data.Slots.get(slotind);
  if (filename && filename !== Logger.getFilename()) {
    Logger.SetFilename(filename);
  }
  if (!data.Slots.get(slotind)) {
    data.Slots.set(slotind, Logger.getFilename());
    NotesDataSave();
  }*/

  // Make sure logging all text is last so that commands are properly executed
  const r = await Logger.Log(message.message.text + "");
  message.reply(r || "✔").then((newmsg) => newmsg.deleteAfterTime(1));
}