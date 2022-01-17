import { Connection } from "../Database";
import { MIS_DT } from "../util/MIS_DT";

export class EvergreenEntry
{
  public Id: number | undefined;
  public title = "";
  public postId = 0;
  public MIS_DT = MIS_DT.GetExact();
  public UPDATE_DT = MIS_DT.GetExact();
  public Updates = 0;
  public enabled = true;

  public static async GetWithPostId(postId: string)
  {
    return EvergreenPostsRepository().where("postId", postId).select();
  }

  public static async GetWithName(postId: string)
  {
    return EvergreenPostsRepository().where("title", "LIKE", postId).select().limit(1);
  }

  public static async All()
  {
    return EvergreenPostsRepository().select();
  }

  public static async Enabled()
  {
    return EvergreenPostsRepository().where("enabled", 1).select();
  }

  public static async GetOldEntries()
  {
    return EvergreenPostsRepository().where("UPDATE_DT", "<", MIS_DT.GetExact() - MIS_DT.OneDay() * 30)
      .andWhere("enabled", 1)
      .select();
  }

  public static async Update(comm: EvergreenEntry)
  {
    // comm.UPDATE_DT = MIS_DT.GetExact();
    console.log(`Updating NetworkingComm id ${comm.Id}`);
    return EvergreenPostsRepository().where("Id", comm.Id).update(comm);
  }

  public static async Insert(comm: EvergreenEntry)
  {
    console.log(`Creating Evergreen with ${comm.postId}`);
    // comm.MIS_DT = MIS_DT.GetExact();
    // comm.UPDATE_DT = MIS_DT.GetExact();
    return EvergreenPostsRepository().insert(comm);
  }

  public static async Delete(id: number)
  {
    console.log(`Deleting Evergreen with id ${id}`);
    return EvergreenPostsRepository().where("Id", id).delete();
  }
}

export const EvergreenPostsRepository = () => Connection<EvergreenEntry>("EvergreenPosts");