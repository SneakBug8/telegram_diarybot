import archiver = require("archiver");
import * as fs from "fs";
import * as path from "path";
import { Config } from "../config";

const backuppath = path.resolve(Config.dataPath(), "../backup.zip");

import { Server, setWaitingForValue } from "..";
import TelegramBot = require("node-telegram-bot-api");
import { BackupData } from "./BackupData";
import { MessageWrapper } from "../MessageWrapper";
import { BotAPI } from "../api/bot";
import { Sleep } from "../util/Sleep";

let data = new BackupData();

const datafilepath = path.resolve(Config.dataPath(), "backup.json");
const daysbetweenbackups = 5;
const whattimeofaday = 12;

export async function InitBackup()
{
  if (fs.existsSync(datafilepath)) {
    const file = fs.readFileSync(datafilepath);

    data = JSON.parse(file.toString()) as BackupData;

    console.log(`Read backup data.`);
  }
  else {
    console.log(`Created new datafile for backups.`);
    BackupSave();
  }

  setInterval(BackupCycle, 75 * 60 * 1000);
}

export async function BackupSave()
{
  const tdata = JSON.stringify(data);
  fs.writeFileSync(datafilepath, tdata);
}

async function BackupCycle()
{
  const now = new Date(Date.now());

  if (Math.abs(data.lastSend - now.getDate()) > daysbetweenbackups) {
    console.log(now + " backup time");
    CreateBackup();
  }
}

async function CreateBackup()
{
  const now = new Date(Date.now());
  data.lastSend = now.getDay();

  await MakeBackupArchive();

  await Sleep(1000);

  BotAPI.sendDocument(Config.DefaultChat, fs.createReadStream(backuppath));

  Server.SendMessage("Created backup");

  BackupSave();
}

async function MakeBackupArchive()
{
  const output = fs.createWriteStream(backuppath);
  const archive = archiver("zip");

  output.on("close", () =>
  {
    console.log(archive.pointer() + " total bytes");
  });

  archive.on("error", (err) =>
  {
    throw err;
  });

  archive.pipe(output);

  // append files from a directories into the archive
  archive.directory(Config.dataPath(), "data");
  archive.directory(path.resolve(Config.dataPath(), "../diary"), "diary");

  await archive.finalize();
}

export async function ProcessBackup(message: MessageWrapper)
{
  if (message.checkRegex(/\/backup force/)) {
    await CreateBackup();
    return;
  }
  return false;
}