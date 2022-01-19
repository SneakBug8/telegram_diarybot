import { MIS_DT } from "../util/MIS_DT";

export class Todo
{
  public id: number | undefined;
  public subject = "";
  public MIS_DT = MIS_DT.GetExact();
  public DONE_DT = 0;
  public suggestedTimes = 0;
  public done: boolean = false;
}