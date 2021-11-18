export class Todo
{
  public id: number | undefined;
  public subject = "";
  public MIS_DT = new Date();
  public suggestedTimes = 0;
  public done: boolean = false;
}