import { Connection } from "../Database";
import { MIS_DT } from "../util/MIS_DT";

export class ProjectEntry
{
  public Id: number | undefined;
  public subject = "";
  public MIS_DT = MIS_DT.GetExact();
  public UPDATE_DT = MIS_DT.GetExact();
  public suggested = 0;
  public done = 0;

  public static async Projects()
  {
    return await ProjectEntriesRepository().select("subject").groupBy("subject");
  }

  public static async GetUndone()
  {
    return await ProjectEntriesRepository().where("done", 0).orderBy("MIS_DT", "desc").select();
  }

  public static async All()
  {
    return await ProjectEntriesRepository().select();
  }

  public static async GetLastYear()
  {
    return await ProjectEntriesRepository().where("MIS_DT", ">=", MIS_DT.GetExact() - MIS_DT.OneDay() * 365).select();
  }

  public static async GetLastMonth()
  {
    return await ProjectEntriesRepository().where("MIS_DT", ">=", MIS_DT.GetExact() - MIS_DT.OneDay() * 30).select();
  }

  public static async GetLastMonthWithSubject(subj: string)
  {
    return await ProjectEntriesRepository().where("MIS_DT", ">=", MIS_DT.GetExact() - MIS_DT.OneDay() * 30)
      .andWhere("subject", subj).select();
  }

  public static async Insert(entry: ProjectEntry)
  {
    return ProjectEntriesRepository().insert(entry);
  }

  public static async Update(entry: ProjectEntry)
  {
    return ProjectEntriesRepository().where("Id", entry.Id).update(entry);
  }
}
export const ProjectEntriesRepository = () => Connection<ProjectEntry>("ProjectEntries");
