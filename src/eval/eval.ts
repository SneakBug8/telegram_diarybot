import { MessageWrapper } from "../MessageWrapper";

export async function ProcessEval(message: MessageWrapper)
{
  if (message.checkRegex(/\/eval (.+)/)) {
    const val = message.captureRegex(/\/eval (.+)/);

    if (!val) {
      return;
    }

    return message.reply(eval(val[1]));
  }
  return false;
}
