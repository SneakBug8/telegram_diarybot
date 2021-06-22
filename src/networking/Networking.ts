import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server } from "..";
import { NetworkingData, NetworkingStat } from "./NetworkingData";

let data = new NetworkingData();

const datafilepath = path.resolve(Config.dataPath(), "networking.json");
const howmanyperday = 1;
const whattimeofaday = 16;

export async function InitNetworking()
{
  if (fs.existsSync(datafilepath)) {
    const file = fs.readFileSync(datafilepath);

    data = JSON.parse(file.toString()) as NetworkingData;
    data.done = data.done || 0;
    data.totalsent = data.totalsent || 0;
    data.lastname = data.lastname || "";
    data.contacts = data.contacts || [];

    let edited = false;
    for (let i = 0; i < data.contacts.length; i++) {
      if (typeof data.contacts[i] === "string") {
        const name = data.contacts[i] as any as string;
        data.contacts[i] = new NetworkingStat();
        data.contacts[i].name = name;

        edited = true;
      }
    }

    if (edited) {
      NetworkingSave();
    }

    console.log(`Read ${data.contacts.length} contacts.`);
  }
  else {
    console.log(`Created new datafile for networking.`);
    NetworkingSave();
  }

  setInterval(NetworkingCycle, 15 * 60 * 1000);
}

export async function NetworkingSave()
{
  const tcontacts = JSON.stringify(data);
  fs.writeFileSync(datafilepath, tcontacts);
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
    const active = data.contacts.filter((x) => x.active);
    const randomind = Math.floor(Math.random() * active.length);

    if (previds.includes(randomind) && previds.length !== active.length) { continue; }

    previds.push(randomind);

    res += active[randomind] + "\n";
    data.lastname = active[randomind].name;
    RaiseSentForStat(active[randomind].name);

    i++;
  }

  Server.SendMessage(res);
  data.totalsent++;
  NetworkingSave();
}

function RaiseSentForStat(name: string)
{
  let stat = data.contacts.find((x) => x.name.includes(name));

  if (!stat) {
    stat = new NetworkingStat();
    stat.name = name;
  }

  stat.totalsent++;

  data.contacts = data.contacts.filter((x) => !x.name.includes(name));
  data.contacts.push(stat);
}

function RaiseDoneForStat(name: string)
{
  let stat = data.contacts.find((x) => x.name.includes(name));

  if (!stat) {
    stat = new NetworkingStat();
    stat.name = name;
  }

  stat.done++;

  data.contacts = data.contacts.filter((x) => !x.name.includes(name));
  data.contacts.push(stat);
}

export async function ProcessNetworking(message: MessageWrapper)
{
  if (message.checkRegex(/\/add/)) {
    const name = message.captureRegex(/\/add (.+)/);

    if (!name) { return; }

    const stat = new NetworkingStat();
    stat.name = name[1];
    data.contacts.push(stat);
    NetworkingSave();

    message.reply(`Added ${name[1]} to your networking contacts.`);

    return;
  }
  if (message.checkRegex(/\/done (.+)/)) {
    const name = message.captureRegex(/\/done (.+)/);
    if (!name) { return; }

    const suitable = data.contacts.filter((x) => x.name.includes(name[1]));

    if (suitable.length > 1) {
      return message.reply(`More than one suitable entry: ` + suitable.join(", "));
    }

    data.done++;

    RaiseDoneForStat(name[1]);

    NetworkingSave();

    message.reply(`Marked interaction with ${name[1]} as done. `
      + `Current statistics: ${data.done} / ${data.totalsent} (${Math.round(data.done * 100 / data.totalsent)}%)`);

    return;
  }
  if (message.checkRegex(/\/done/)) {
    data.done++;

    if (data.lastname) {
      RaiseDoneForStat(data.lastname);
    }

    NetworkingSave();

    message.reply(`Marked interaction with ${data.lastname} (last one) as done. `
      + `Current statistics: ${data.done} / ${data.totalsent}(${data.done * 100 / data.totalsent}%)`);

    return;
  }
  if (message.checkRegex(/\/list/)) {
    let res = "";

    const sorted = data.contacts.sort((x, y) => (y.totalsent - x.totalsent) + (y.done - x.done));

    for (const contact of sorted) {
      res += `${contact.name} (${contact.done}/${contact.totalsent}, ${contact.done * 100 / contact.totalsent}%)\n`;
    }

    message.reply(res);
    return;
  }
  if (message.checkRegex(/\/remove (.+)/)) {
    const name = message.captureRegex(/\/remove (.+)/);

    if (!name) { return; }

    const suitable = data.contacts.filter((x) => x.name.includes(name[1]));

    if (suitable.length > 1) {
      return message.reply(`More than one suitable entry: ` + suitable.join(", "));
    }

    const sel = data.contacts.filter((x) => !x.name.includes(name[1]));
    for (const s of sel) {
      s.active = false;
    }

    message.reply(`Deactivated ${name[1]} in your networking contacts.`);
    NetworkingSave();

    return;
  }
  if (message.checkRegex(/\/force/)) {
    NetworkingSend();

    return;
  }
  return false;
}