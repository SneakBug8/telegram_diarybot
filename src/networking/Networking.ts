import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server, setWaitingForValue } from "..";
import { NetworkingData, NetworkingStat } from "./NetworkingData";
import TelegramBot = require("node-telegram-bot-api");

let data = new NetworkingData();

const datafilepath = path.resolve(Config.dataPath(), "networking.json");
const howmanyperday = 1;
const whattimeofaday = 12;

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/networking done" }, { text: "/networking init" }, { text: "/networking list" }],
    [{ text: "/networking add" }, { text: "/networking remove" }, { text: "/networking stats" }],
    [{ text: "/networking policy set" }],
    [{ text: "/exit" }],
  ];
}

function reply(msg: MessageWrapper, text: string)
{
  msg.reply(text, getKeyboard());
}

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

    /*data.done = 0; data.initiated = 0; data.totalsent = 0;
    for (const contact of data.contacts) {
      data.done += contact.done; data.initiated += contact.initiated; data.totalsent += contact.totalsent;
    }*/

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

async function NetworkingCycle()
{
  const now = new Date(Date.now());

  if (now.getHours() === whattimeofaday && now.getMinutes() <= 30 && data.lastSend !== now.getDay()) {
    console.log(now + " sending time");
    NetworkingSend();
  }
}

async function NetworkingSend()
{
  const now = new Date(Date.now());
  data.lastSend = now.getDay();

  let res = `Ваш нетворкинг на сегодня:\n`;

  const previds = new Array<number>();
  let i = 0;

  while (i < howmanyperday) {
    const active = data.contacts.filter((x) => x.active);
    const randomind = Math.floor(Math.random() * active.length);

    if (previds.includes(randomind) && previds.length !== active.length) { continue; }

    previds.push(randomind);

    res += formatName(active[randomind]) + "\n";
    data.lastname = active[randomind].name;
    RaiseSentForStat(active[randomind].name);

    i++;
  }

  if (data.policy) {
    res += `---\n${data.policy}`;
  }

  Server.SendMessage(res);
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
  data.totalsent++;

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
  data.done++;

  data.contacts = data.contacts.filter((x) => !x.name.includes(name));
  data.contacts.push(stat);
}

function RaiseInitForStat(name: string)
{
  let stat = data.contacts.find((x) => x.name.includes(name));

  if (!stat) {
    stat = new NetworkingStat();
    stat.name = name;
  }

  stat.initiated++;
  data.initiated++;

  data.contacts = data.contacts.filter((x) => !x.name.includes(name));
  data.contacts.push(stat);
}

function formatName(contact: NetworkingStat)
{
  let res = `${contact.name}`;
  if (contact.active) {
    res += ` (d${contact.done} / i${contact.initiated} / t${contact.totalsent})`;
  }
  else {
    res += ` (disabled, d${contact.done} / i${contact.initiated} / t${contact.totalsent})`;
  }
  res += `\n`;
  return res;
}

function FullStatistics()
{
  return `Current statistics: `
    + `d${data.done} / i${data.initiated} / t${data.totalsent} `
    + `(d${ Math.round(data.done * 100 / data.totalsent)}% / i${ Math.round(data.initiated * 100 / data.totalsent) }%)`;
}

export async function ProcessNetworking(message: MessageWrapper)
{
  if (message.checkRegex(/\/networking add/)) {
    setWaitingForValue(`Please, write name who to add.`,
      (msg) =>
      {
        const name = msg.message.text;

        if (!name) { return; }

        const existing = data.contacts.filter((x) => x.name === name);
        if (existing.length) {
          existing[0].active = true;
          reply(message, `Reactivated ${name}.`);
          NetworkingSave();
          return;
        }

        const stat = new NetworkingStat();
        stat.name = name;
        data.contacts.push(stat);
        NetworkingSave();

        reply(message, `Added ${name} to your networking contacts.`);
      });
    return;
  }
  if (message.checkRegex(/\/networking done (.+)/)) {
    const name = message.captureRegex(/\/networking done (.+)/);
    if (!name) { return; }

    const suitable = data.contacts.filter((x) => x.name.includes(name[1]));

    if (suitable.length > 1) {
      return reply(message, `More than one suitable entry: ` + suitable.join(", "));
    }

    RaiseDoneForStat(name[1]);

    NetworkingSave();

    reply(message, `Marked interaction with ${name[1]} as done. `
      + FullStatistics());

    return;
  }
  if (message.checkRegex(/\/networking init/)) {
    if (data.lastname) {
      RaiseInitForStat(data.lastname);
    }

    NetworkingSave();

    reply(message, `Marked interaction with ${data.lastname} (last one) as initiated. `
      + FullStatistics());

    return;
  }
  if (message.checkRegex(/\/networking done/)) {
    if (data.lastname) {
      RaiseDoneForStat(data.lastname);
    }

    NetworkingSave();

    reply(message, `Marked interaction with ${data.lastname} (last one) as done. `
      + FullStatistics());

    return;
  }
  if (message.checkRegex(/\/networking list/)) {
    let res = "";

    const sorted = data.contacts.sort((x, y) =>
    {
      if (y.active !== x.active) {
        return (y.active) ? 1 : -1;
      }
      if (y.totalsent !== x.totalsent) {
        return y.totalsent - x.totalsent;
      }
      if (y.initiated !== x.initiated) {
        return y.initiated - x.initiated;
      }
      return y.done - x.done;
    });

    for (const contact of sorted) {
      res += formatName(contact);
    }

    reply(message, res);
    return;
  }
  if (message.checkRegex(/\/networking remove (.+)/)) {
    setWaitingForValue(`Please, write name who to remove.`,
      (msg) =>
      {
        const name = msg.message.text;

        if (!name) { return; }

        const suitable = data.contacts.filter((x) => x.name.includes(name));

        if (suitable.length > 1) {
          return reply(message, `More than one suitable entry: ` + suitable.join(", "));
        }

        suitable[0].active = false;

        const sel = data.contacts.filter((x) => !x.name.includes(name));
        sel.push(suitable[0]);

        data.contacts = sel;
        reply(message, `Deactivated ${name} in your networking contacts.`);
        NetworkingSave();
      });

    return;
  }
  if (message.checkRegex(/^\/networking policy set/)) {
    setWaitingForValue(`Please, write current networking policy`,
      (msg) =>
      {
        data.policy = msg.message.text + "";
        reply(msg, `Networking policy set`);

        NetworkingSave();
      });
    return;
  }
  if (message.checkRegex(/^\/networking force/)) {
    NetworkingSend();

    return;
  }
  if (message.checkRegex(/^\/networking/) || message.checkRegex(/^\/networking stats/)) {
    reply(message, `Networking module.\n` + FullStatistics());

    return;
  }
  return false;
}
