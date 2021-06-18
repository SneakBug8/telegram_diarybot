import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server } from "..";

let contacts = new Array<string>();

const contactspath = path.resolve(Config.dataPath(), "contacts.json");
const howmanyperday = 1;
const whattimeofaday = 16;

export async function InitNetworking()
{
  const file = fs.readFileSync(contactspath);

  contacts = JSON.parse(file.toString());

  console.log(`Read ${contacts.length} contacts.`);

  setInterval(NetworkingCycle, 15 * 60 * 1000);
}

export async function NetworkingSave()
{
  const tcontacts = JSON.stringify(contacts);
  fs.writeFileSync(contactspath, tcontacts);
}

let lastSend = -1;

async function NetworkingCycle()
{
  const now = new Date(Date.now());

  if (now.getHours() === whattimeofaday && now.getMinutes() <= 30 && lastSend !== now.getDay()) {
    console.log(now + " sending time");
    NetworkingSend();
    lastSend = now.getDay();
  }
}

async function NetworkingSend()
{
  const now = new Date(Date.now());
  lastSend = now.getDay();

  let res = `Ваш нетворкинг на сегодня:\n`;

  const previds = new Array<number>();
  let i = 0;

  while (i < howmanyperday) {
    const randomind = Math.round(Math.random() * contacts.length);

    if (previds.includes(randomind) && previds.length !== contacts.length) { continue; }

    previds.push(randomind);

    res += contacts[randomind] + "\n";
    i++;
  }

  Server.SendMessage(res);
}

export async function ProcessNetworking(message: MessageWrapper)
{
  if (message.checkRegex(/\/add/)) {
    const name = message.captureRegex(/\/add (.+)/);

    if (!name) { return; }
    contacts.push(name[1]);
    NetworkingSave();

    message.reply(`Added ${name[1]} to your networking contacts.`);

    return;
  }
  if (message.checkRegex(/\/list/)) {
    let res = "";
    for (const contact of contacts) {
      res += contact + "\n";
    }

    message.reply(res);
    return;
  }
  if (message.checkRegex(/\/remove/)) {
    const name = message.captureRegex(/\/remove (.+)/);

    if (!name) { return; }

    contacts = contacts.filter((x) => !x.includes(name[1]));

    message.reply(`Removed ${name[1]} from your networking contacts.`);
    NetworkingSave();

    return;
  }
  if (message.checkRegex(/\/force/)) {
    NetworkingSend();

    return;
  }
  return false;
}