import { MIS_DT } from "../util/MIS_DT";

export class ProjectEntry
{
  public Id: number | undefined;
  public subject = "";
  public MIS_DT = MIS_DT.GetExact();
  public UPDATE_DT = MIS_DT.GetExact();
  public suggested = 0;
  public done = 0;
}