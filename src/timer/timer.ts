import { MessageWrapper } from "../MessageWrapper";

const timers = new Array<Date>();

export async function ProcessTimer(message: MessageWrapper)
{
  if (message.checkRegex(/\/timer start/) || message.checkRegex(/\/timer add/)) {
    timers.push(new Date(Date.now()));

    return message.reply(`Created timer ${timers.length}.`);
  }
  if (message.checkRegex(/\/timer stop/)) {
    if (!timers.length) {
      return message.reply("No timers running");
    }
    const timern = timers.length;
    const timer = timers.pop() as Date;

    return message.reply(`Stopped timer ${timern}.` +
      `Elapsed time - ${parseTime(Date.now() - timer.valueOf())}`);
  }
  if (message.checkRegex(/\/timer clear/)) {
    if (!timers.length) {
      return message.reply("No timers running");
    }

    while (timers.length) {
      const timern = timers.length;
      const timer = timers.pop() as Date;

      message.reply(`Stopped timer ${timern}. ` +
        `Elapsed time - ${parseTime(Date.now() - timer.valueOf())}`);
    }
    return;
  }

  if (message.checkRegex(/\/timer/)) {
    return message.reply(`Unrecognized timer command.`);
  }
  return false;
}

function parseTime(time: number)
{
  let res = "";
  if (time >= 1000 * 60 * 60 * 24) {
    res += `${Math.floor(time / 1000 / 60 / 60 / 24)}d`;
    time = time % (1000 * 60 * 60 * 24);
  }
  if (time >= 1000 * 60 * 60) {
    res += `${Math.floor(time / 1000 / 60 / 60)}h`;
    time = time % (1000 * 60 * 60);
  }
  if (time >= 1000 * 60) {
    res += `${Math.floor(time / 1000 / 60)}m`;
    time = time % (1000 * 60);
  }
  res += `${time / 1000}s`;
  return res;
}