import { MessageWrapper } from "../MessageWrapper";
import * as fs from "fs";
import * as path from "path";

import { Config } from "../config";
import { Server, setWaitingForValue, setWaitingForValuePure } from "..";
import { NetworkingData, NetworkingStat } from "./NetworkingData";
import TelegramBot = require("node-telegram-bot-api");
import { shortNum, StringIncludes } from "../util/EqualString";
import { NetworkingChange } from "./NetworkingChange";
import { NetworkingContact, NetworkingContactsRepository } from "./NetworkingContact";
import { Connection } from "../Database";
import { NetworkingCommunication } from "./NetworkingCommunication";
import { MIS_DT } from "../util/MIS_DT";
import { OfflineNetworking } from "./offlinenetworking/OfflineNetworking";
import { yesNoKeyboard } from "../notes/NotesController";

let data = new NetworkingData();

const datafilepath = path.resolve(Config.dataPath(), "networking.json");
const howmanyperday = 1;
const whattimeofaday = 12;

export const networkingChangesHistory = new Array<NetworkingChange>();

function getKeyboard(): TelegramBot.KeyboardButton[][]
{
  return [
    [{ text: "/networking done" }, { text: "/networking init" }, { text: "/networking list" }],
    [{ text: "/networking add" }, { text: "/networking remove" }, { text: "/networking stats" }],
    [{ text: "/networking done (...)" }, { text: "/networking init (...)" }, { text: "/networking send (...)" }],
    [{ text: "/networking offline" }, { text: "/networking undo" }, { text: "/exit" }],
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
    data.totaldays = data.totaldays || data.totalsent || 0;

    let edited = false;

    /*data.done = 0; data.initiated = 0; data.totalsent = 0;
    for (const contact of data.contacts) {
      data.done += contact.done; data.initiated += contact.initiated; data.totalsent += contact.totalsent;
    }*/

    if (edited) {
      NetworkingSave();
    }

    console.log(`[Networking] Read ${data.contacts.length} contacts.`);
  }
  else {
    console.log(`[Networking] Created new datafile for networking.`);
    NetworkingSave();
  }
}

export async function NetworkingSave()
{
  const tcontacts = JSON.stringify(data);
  fs.writeFileSync(datafilepath, tcontacts);
}

export async function NetworkingCycle()
{
  const now = new Date(Date.now());

  if (now.getHours() === whattimeofaday && now.getMinutes() <= 30 && data.lastSend !== now.getDay()) {
    console.log(now + " sending time");
    await NetworkingSend();

    if (now.getDay() - 1 === 4) {
      await WeeklyReview();
    }
  }
}

async function GetActiveContacts()
{
  let res = "";

  const applicableContacts = await NetworkingCommunication.GetRecentCommsToComplete();

  if (applicableContacts.length) {
    res += `---\n`;
  }

  for (const contact of applicableContacts) {
    if (contact.Initiated > 0) {
      res += `Unfinished initiated contact with ${contact.Contact} (${new Date(contact.CREATED_DT).toDateString()})\n`;
    }
    else if (contact.Sent > 0) {
      res += `Uninitiated contact with ${contact.Contact} (${new Date(contact.CREATED_DT).toDateString()})\n`;
    }
  }

  return res;
}

async function MigrateNetworkingCommunications()
{
  let comms = 0;

  for (const contact of data.contacts) {
    const done = contact.done;
    const init = contact.initiated - done;
    const sent = contact.totalsent - contact.initiated;

    for (let i = 0; i < done; i++) {
      const comm = new NetworkingCommunication(contact.name);
      comm.Sent = 1;
      comm.Initiated = 1;
      comm.Done = 1;
      comm.CREATED_DT = MIS_DT.GetDay() - MIS_DT.OneDay() * 25;

      comms++;

      await NetworkingCommunication.Insert(comm);
    }
    for (let i = 0; i < init; i++) {
      const comm = new NetworkingCommunication(contact.name);
      comm.Sent = 1;
      comm.Initiated = 1;
      comm.CREATED_DT = MIS_DT.GetDay() - MIS_DT.OneDay() * 25;

      comms++;

      await NetworkingCommunication.Insert(comm);
    }
    for (let i = 0; i < sent; i++) {
      const comm = new NetworkingCommunication(contact.name);
      comm.Sent = 1;
      comm.CREATED_DT = MIS_DT.GetDay() - MIS_DT.OneDay() * 25;

      comms++;

      await NetworkingCommunication.Insert(comm);
    }
  }
  return `Regenerated ${comms} networkingcomms`;
}

async function MigrateContacts()
{
  await NetworkingContactsRepository().delete();

  for (const contact of data.contacts) {
    const entry = new NetworkingContact(contact.name);
    entry.active = contact.active;

    await NetworkingContact.Insert(entry);
  }

  return `Migrated ${await NetworkingContact.GetContacts()} contacts`;
}

async function NetworkingSend()
{
  const now = new Date(Date.now());
  data.lastSend = now.getDay();
  data.totaldays++;

  let res = `Ваш нетворкинг на сегодня:\n`;

  const previds = new Array<number>();
  let i = 0;

  while (i < howmanyperday) {
    const active = data.contacts.filter((x) => x.active);
    const randomind = Math.floor(Math.random() * active.length);

    if (previds.includes(randomind) && previds.length !== active.length) { continue; }

    previds.push(randomind);

    res += await formatName(active[randomind]) + "\n";
    data.lastname = active[randomind].name;
    RaiseSentForStat(active[randomind].name);

    i++;
  }

  /*
  const applicableContacts = activeContacts.filter((x) => (x.sent > 0 || x.init > 0) && !x.done);

  if (applicableContacts.length) {
    res += `---\n`;
  }

  for (const contact of applicableContacts) {
    if (contact.init > 0) {
      res += `Unfinished initiated contact with ${contact.name} (${contact.sent}/${contact.init}/${contact.done})\n`;
    }
    else if (contact.sent > 0) {
      res += `Uninitiated contact with ${contact.name} (${contact.sent}/${contact.init}/${contact.done})\n`;
    }

    contact.init--;
    contact.sent--;
  }
  */

  res += await GetActiveContacts();

  if (data.policy) {
    res += `---\n${data.policy}`;
  }

  Server.SendMessage(res);
  NetworkingSave();

  // Server.SendMessage(JSON.stringify(await NetworkingCommunication.StatOfContacts()));
  // Server.SendMessage(JSON.stringify(await NetworkingCommunication.GetRecentCommsToComplete()));
}

async function WeeklyReview()
{
  let res = `Networking for weekends:\n`;

  const firstpick = data.contacts.filter((x) => x.active && x.totalsent > x.initiated);
  const secondpick = data.contacts.filter((x) => x.active);

  let i = 0;

  while (i < 5 && firstpick.length) {
    const contact = firstpick.pop();

    if (contact) {
      res += await formatName(contact) + "\n";
      i++;
    }
  }

  const previds = new Array<number>();

  while (i < 5 && secondpick.length) {
    const randomind = Math.floor(Math.random() * secondpick.length);

    if (previds.includes(randomind) && previds.length !== secondpick.length) { continue; }

    previds.push(randomind);

    res += await formatName(secondpick[randomind]) + "\n";
    i++;
  }

  Server.SendMessage(res);
  NetworkingSave();
}

export async function findStat(name: string)
{
  // find duplicates
  const duplicates = new Array<NetworkingStat>();
  for (const contact of data.contacts) {
    const identical = data.contacts.filter((x) => x.name === contact.name);
    if (identical.length > 1) {
      duplicates.push(identical[1]);
    }
  }

  data.contacts = data.contacts.filter((x) => !duplicates.includes(x));
  await NetworkingSave();

  const stats = data.contacts.filter((x) => StringIncludes(x.name, name));

  if (!stats.length) {
    return `Noone named ${name} in the contacts list`;
  }
  if (stats.length > 1) {
    return `More than one suitable entry for ${name}.`;
  }

  return stats[0];
}

async function RaiseSentForStat(name: string)
{
  const stat = await findStat(name);
  if (typeof stat === "string") { return stat; }

  stat.totalsent++;
  data.totalsent++;

  networkingChangesHistory.push(new NetworkingChange(stat.name, "Sent"));

  writeChange(stat.name, 0);

  const comm = new NetworkingCommunication(stat.name);
  comm.Sent = 1;
  await NetworkingCommunication.Insert(comm);

  return stat;

  // data.contacts = data.contacts.filter((x) => !x.name.includes(name));
  // data.contacts.push(stat);
}

async function RaiseDoneForStat(name: string)
{
  const stat = await findStat(name);
  if (typeof stat === "string") { return stat; }

  stat.done++;
  data.done++;

  writeChange(stat.name, 2);

  const comms = await NetworkingCommunication.GetWithContactUnfinished(stat.name);

  if (comms.length) {
    for (const currcomm of comms) {
      if (currcomm.Done) {
        continue;
      }
      currcomm.Done = 1;
      currcomm.DONE_DT = MIS_DT.GetExact();
      await NetworkingCommunication.Update(currcomm);
      break;
    }
  }
  else {
    return "No record to raise Done";
  }

  networkingChangesHistory.push(new NetworkingChange(stat.name, "Done"));

  return stat;

  // data.contacts = data.contacts.filter((x) => !x.name.includes(name));
  // data.contacts.push(stat);
}

async function RaiseInitForStat(name: string)
{
  const stat = await findStat(name);
  if (typeof stat === "string") { return stat; }

  networkingChangesHistory.push(new NetworkingChange(stat.name, "Init"));

  stat.initiated++;
  data.initiated++;

  const comms = await NetworkingCommunication.GetWithContactUninitiated(stat.name);

  if (comms.length) {
    for (const currcomm of comms) {
      if (currcomm.Initiated) {
        continue;
      }
      currcomm.Initiated = 1;
      currcomm.INITIATED_DT = MIS_DT.GetExact();
      await NetworkingCommunication.Update(currcomm);
      break;
    }
  }
  else {
    return "No record to raise Initiated";
  }

  await writeChange(stat.name, 1);

  return stat;

  // data.contacts = data.contacts.filter((x) => !x.name.includes(name));
  // data.contacts.push(stat);
}

async function undo()
{
  const lastchange = networkingChangesHistory.pop();

  if (!lastchange) { return "No changes history"; }

  const stat = await findStat(lastchange.name);
  if (typeof stat === "string") { return stat; }

  if (lastchange.type === "Sent") {
    stat.totalsent--;
    data.totalsent--;

    const comms = await NetworkingCommunication.GetWithContact(stat.name);
    for (const currcomm of comms) {
      if (currcomm.Id) {
        await NetworkingCommunication.Delete(currcomm.Id);
        break;
      }
    }

    return `Undone sending ${stat.name}`;
  }
  else if (lastchange.type === "Init") {
    stat.initiated--;
    data.initiated--;

    const comms = await NetworkingCommunication.GetWithContact(stat.name);
    for (const currcomm of comms) {
      if (currcomm.Initiated) {
        currcomm.Initiated = 0;
        await NetworkingCommunication.Update(currcomm);
        break;
      }
    }

    return `Undone initiating ${stat.name}`;
  }
  else if (lastchange.type === "Done") {
    stat.done--;
    data.done--;

    const comms = await NetworkingCommunication.GetWithContact(stat.name);
    for (const currcomm of comms) {
      if (currcomm.Done) {
        currcomm.Done = 0;
        await NetworkingCommunication.Update(currcomm);
        break;
      }
    }

    return `Undone doing ${stat.name}`;
  }
  else if (lastchange.type === "Offline") {
    await OfflineNetworking.RemoveEntry(lastchange.name);
  }

  return `Unexpected error`;
}

async function formatName(contact: NetworkingStat)
{
  let res = `${contact.name}`;

  const offline = await OfflineNetworking.Count(contact.name);
  const c = await NetworkingContact.GetContact(contact.name);
  const stat = await NetworkingCommunication.GetContactStat(contact.name);

  /*if (contact.active) {
    res += ` (d${contact.done} / i${contact.initiated} / t${contact.totalsent}, offline${offline})`;
  }
  else {
    res += ` (disabled, d${contact.done} / i${contact.initiated} / t${contact.totalsent}, offline${offline})`;
  }
  res += `\n`;*/

  if (c?.active) {
    res += ` (d${stat?.Done} / i${stat?.Initiated} / t${stat?.Sent}, offline${offline})`;
  }
  else {
    res += ` (disabled, d${stat?.Done} / i${stat?.Initiated} / t${stat?.Sent}, offline${offline})`;
  }
  res += `\n`;
  return res;
}

function ShortStatistics()
{
  return `Current statistics: `
    + `d${data.done} / i${data.initiated} / t${data.totalsent} `
    + `(d${Math.round(data.done * 100 / data.totalsent)}% / i${Math.round(data.initiated * 100 / data.totalsent)}%)`;
}

function FullStatistics()
{
  return ShortStatistics() +
    `\nAverage contacts per day: ${shortNum(data.initiated / data.totaldays)}` +
    `\nAverage answers per day: ${shortNum(data.done / data.totaldays)}`;
}

export async function ProcessNetworking(message: MessageWrapper)
{
  if (message.checkRegex(/\/networking add/)) {
    setWaitingForValue(`Please, write name who to add.`,
      (msg) =>
      {
        const name = msg.message.text;

        if (!name) { return; }

        const existing = data.contacts.filter((x) => x.name.toLowerCase() === name);
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
  if (message.checkRegex(/\/networking init$/)) {
    if (!data.lastname) {
      return reply(message, `No last user to mark initiated.`);
    }

    const res = RaiseInitForStat(data.lastname);
    if (typeof res === "string") {
      return reply(message, res);
    }

    NetworkingSave();

    reply(message, `Marked interaction with ${data.lastname} (last one) as initiated. `
      + ShortStatistics());

    return;
  }
  if (message.checkRegex(/\/networking done$/)) {
    if (!data.lastname) {
      return reply(message, `No last user to mark done.`);
    }

    const res = RaiseDoneForStat(data.lastname);
    if (typeof res === "string") {
      return reply(message, res);
    }

    NetworkingSave();

    reply(message, `Marked interaction with ${data.lastname} (last one) as done. `
      + ShortStatistics());

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
      res += await formatName(contact);
    }

    const active = data.contacts.filter((x) => x.active);

    res += `---\n`;
    res += `Average cycle ${active.length / howmanyperday} days.`;

    reply(message, res);
    return;
  }
  if (message.checkRegex(/^\/networking done \(...\)/)) {
    setWaitingForValue(`Please, write name who to mark as done.`,
      async (msg) =>
      {
        const name = msg.message.text;

        if (!name) { return; }

        const res = await RaiseDoneForStat(name);
        if (typeof res === "string") {
          return reply(message, res);
        }

        NetworkingSave();
        reply(message, `Marked interaction with ${res.name} as done.\n` + ShortStatistics());
      });
    return;
  }
  if (message.checkRegex(/^\/networking init \(...\)/)) {
    setWaitingForValue(`Please, write name who to mark as initiated.`,
      async (msg) =>
      {
        const name = msg.message.text;

        if (!name) { return; }

        const res = await RaiseInitForStat(name);
        if (typeof res === "string") {
          return reply(message, res);
        }

        NetworkingSave();
        reply(message, `Marked interaction with ${res.name} as initiated.\n` + ShortStatistics());
      });
    return;
  }
  if (message.checkRegex(/^\/networking send \(...\)/)) {
    setWaitingForValue(`Please, write name who to mark as sent.`,
      async (msg) =>
      {
        const name = msg.message.text;

        if (!name) { return; }

        const res = await RaiseSentForStat(name);
        if (typeof res === "string") {
          return reply(message, res);
        }

        NetworkingSave();
        reply(message, `Created non-regular interaction with ${res.name}.\n` + ShortStatistics());
      });
    return;
  }
  if (message.checkRegex(/^\/networking offline/)) {
    setWaitingForValue(`Please, write name who to mark as communicated offline.`,
      async (msg) =>
      {
        const name = msg.message.text;

        if (!name) { return; }

        const res = await OfflineNetworking.AddEntry(name);
        if (typeof res === "string") {
          return reply(message, res);
        }
      });
    return;
  }
  if (message.checkRegex(/^\/networking remove/)) {
    setWaitingForValue(`Please, write name who to remove.`,
      async (msg) =>
      {
        const name = msg.message.text;

        if (!name) { return; }

        const c = await NetworkingContact.GetContact(name);
        if (c) {
          c.active = false;
          await NetworkingContact.Update(c);
        }
        else {
          return reply(message, "No such contact");
        }

        const suitable = data.contacts.filter((x) => StringIncludes(x.name, name));

        if (suitable.length > 1) {
          return reply(message, `More than one suitable entry: ` + suitable.join(", "));
        }
        else if (suitable.length < 1) {
          return reply(message, `No suitable entries.`);
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
  if (message.checkRegex(/^\/networking undo/)) {
    message.reply("Are you sure you want to undo?", yesNoKeyboard());
    return setWaitingForValuePure(undo);
  }
  if (message.checkRegex(/^\/networking migrate contacts/)) {
    reply(message, await MigrateContacts());

    return;
  }
  if (message.checkRegex(/^\/networking test contacts stats/)) {
    const contacts = await NetworkingContact.GetContacts();

    let res = "";
    for (const contact of contacts) {
      const stat = await NetworkingCommunication.GetContactStat(contact.name);
      res += `\n${contact.name}\n`;

      res += JSON.stringify(stat);
    }

    reply(message, res);

    return;
  }
  if (message.checkRegex(/^\/networking migrate$/)) {
    reply(message, await MigrateNetworkingCommunications());

    return;
  }
  if (message.checkRegex(/^\/networking unfinished/)) {
    reply(message, await GetActiveContacts());

    return;
  }
  if (message.checkRegex(/^\/networking force/)) {
    NetworkingSend();

    return;
  }
  if (message.checkRegex(/^\/networking stats/)) {
    reply(message, FullStatistics());

    return;
  }
  if (message.checkRegex(/^\/networking/)) {
    reply(message, `Networking module.\n` +
    `Networking dashboard: ${await Config.url()}networkingchart.html\n`
      + ShortStatistics());
    return;
  }
  return false;
}

async function writeChange(contact: string, type: number)
{
  const r = {
    Contact: contact,
    Type: type,
    MIS_DT: MIS_DT.GetExact()
  };
  await NetworkingEntriesRepository().insert(r);
}

export const NetworkingEntriesRepository = () => Connection("NetworkingHistory");
