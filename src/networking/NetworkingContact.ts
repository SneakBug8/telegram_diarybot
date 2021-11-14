export class NetworkingContact
{
  public name: string = "";
  // store day before total removal;
  public sent: number = 0;
  public init: number = 0;
  public done: boolean = false;

  public constructor(name: string)
  {
    this.name = name;
  }
}