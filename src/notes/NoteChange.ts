import { Statistics } from "../Statistics";
import { MIS_DT } from "../util/MIS_DT";

export class NoteChange
{
  public Id: number | undefined;
  public filename: string;
  public content: string;
  public newfile: boolean;
  public length: number;
  public MIS_DT = MIS_DT.GetExact();

  public constructor(filename: string, content: string, newfile: boolean = false)
  {
    this.filename = filename;
    this.content = content;
    this.newfile = newfile;
    this.length = content.length;
  }

  public static async Insert(change: NoteChange)
  {
    const d = await ChangesRepository().insert(change);
    change.Id = d[0];

    return change;
  }

  public static async Delete(id: number)
  {
    return await ChangesRepository().where("Id", id).del();
  }

  public static async All()
  {
    return await ChangesRepository().select();
  }
}

export const ChangesRepository = () => Statistics<NoteChange>("NoteChanges");
