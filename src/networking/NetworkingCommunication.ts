import { Connection } from "../Database";
import { MIS_DT } from "../util/MIS_DT";

export class NetworkingCommunication
{

  public static async GetWithContact(contact: string)
  {
    return NetworkingCommunicationsRepository().where("Contact", contact).select().orderBy("MIS_DT", "desc");
  }

  public static async StatOfContacts()
  {
    return NetworkingCommunicationsRepository().groupBy("Contact").sum({
      Sent: "Sent", Initiated: "Initiated", Done: "Done"
    }).select("Contact");
  }

  public static async GetWithContactUnfinished(contact: string)
  {
    return NetworkingCommunicationsRepository().where("Contact", contact).andWhere("Done", 0).select()
      .orderBy("MIS_DT", "desc");
  }

  public static async GetWithContactUninitiated(contact: string)
  {
    return NetworkingCommunicationsRepository().where("Contact", contact).andWhere("Initiated", 0)
      .select().orderBy("MIS_DT", "desc");
  }

  public static async GetUnfinished()
  {
    return NetworkingCommunicationsRepository().where("Done", 0).andWhere(function ()
    {
      this.where("Sent", 1).orWhere("Initiated", 1);
    }).select();
  }

  public static async GetRecentCommsToComplete()
  {
    return NetworkingCommunicationsRepository().where("Done", 0)
      .andWhere("MIS_DT", ">=", MIS_DT.GetExact() - MIS_DT.OneWeek()).andWhere(function ()
      {
        this.where("Sent", 1).orWhere("Initiated", 1);
      }).select();
  }

  public static async Update(comm: NetworkingCommunication)
  {
    comm.UPDATE_DT = MIS_DT.GetExact();
    console.log(`Updating NetworkingComm id ${comm.Id}`);
    return NetworkingCommunicationsRepository().where("Id", comm.Id).update(comm);
  }

  public static async Insert(comm: NetworkingCommunication)
  {
    console.log(`Creating NetworkingComm with ${comm.Contact}`);
    comm.UPDATE_DT = MIS_DT.GetExact();
    comm.MIS_DT = MIS_DT.GetExact();
    return NetworkingCommunicationsRepository().insert(comm);
  }

  public static async Delete(id: number)
  {
    console.log(`Deletind NetworkingComm with id ${id}`);
    return NetworkingCommunicationsRepository().where("Id", id).delete();
  }

  public Id: number | undefined;
  public Contact: string;
  public Sent: number = 0;
  public Initiated: number = 0;
  public Done: number = 0;
  public MIS_DT: number = 0;
  public UPDATE_DT: number = 0;

  public constructor(contact: string)
  {
    this.Contact = contact;
  }
}

export const NetworkingCommunicationsRepository = () => Connection<NetworkingCommunication>("NetworkingCommunication");
