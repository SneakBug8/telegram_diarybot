export class NetworkingChange
{
  public name: string = "";
  public type: "Init" | "Done" | "Sent" | undefined;

  public constructor(name: string, type: "Init" | "Done" | "Sent" | undefined)
  {
    this.name = name;
    this.type = type;
  }
}