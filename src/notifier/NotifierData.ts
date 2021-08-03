export class NotifierData
{
  public Archive = new Array<NotifierEntry>();
  public Pending = new Array<NotifierEntry>();
  public lastSend: number = 0;
  public lastId: number = 0;
}

export class NotifierEntry
{
  public id: number = 0;
  public name: string = "";
  public datetime: string = "";
}