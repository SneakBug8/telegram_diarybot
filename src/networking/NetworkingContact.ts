import { Connection } from "../Database";
import { MIS_DT } from "../util/MIS_DT";

export class NetworkingContact
{
  public Id: undefined | number;
  public name: string = "";

  public active: boolean = true;

  public MIS_DT = MIS_DT.GetExact();

  public constructor(name: string)
  {
    this.name = name;
  }

  public static async GetContact(name: string)
  {
    const entries = await NetworkingContactsRepository().where("name", "LIKE", name).select();

    if (entries.length) {
      return entries[0];
    }

    return null;
  }

  public static async GetContacts()
  {
    const entries = await NetworkingContactsRepository().select();

    return entries;
  }

  public static async Insert(contact: NetworkingContact)
  {
    await NetworkingContactsRepository().insert(contact);
  }

  public static async Update(contact: NetworkingContact)
  {
    await NetworkingContactsRepository().where("Id", contact.Id).update(contact);
  }
}

export const NetworkingContactsRepository = () => Connection<NetworkingContact>("NetworkingContacts");
