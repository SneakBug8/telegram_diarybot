export class NetworkingData
{
  public totalsent = 0;
  public done = 0;
  public contacts = new Array<NetworkingStat>();
  public lastname: string = "";
  public lastSend: number = 0;
}

export class NetworkingStat
{
  public name: string = "";
  public totalsent = 0;
  public done = 0;
  public active = true;
}