import { Connection } from "../../Database";
import { findStat, networkingChangesHistory } from "../Networking";
import { NetworkingChange } from "../NetworkingChange";
import { OfflineNetworkingEntry } from "./OfflineNetworkingEntry";

export class OfflineNetworking
{
  public static async AddEntry(name: string)
  {
    const stat = await findStat(name);

    if (typeof stat === "string") {
      return stat;
    }

    const entry = new OfflineNetworkingEntry();
    entry.name = stat.name;

    const change = new NetworkingChange(stat.name, "Offline");
    networkingChangesHistory.push(change);

    await OfflineNetworkingEntriesRepository().insert(entry);
    return `Successfully added offline networking entry with ${entry.name}`;
  }

  public static async Count(name: string)
  {
    const stat = await findStat(name);

    if (typeof stat === "string") {
      return 0;
    }

    const res = await OfflineNetworkingEntriesRepository().where("name", stat.name).count();

    return Object.values(res[0])[0];
  }

  public static async RemoveEntry(name: string)
  {
    const stat = await findStat(name);

    if (typeof stat === "string") {
      return stat;
    }

    const entries = await OfflineNetworkingEntriesRepository().where("name", stat.name).orderBy("MIS_DT", "desc");

    if (!entries.length) {
      return "No suitable entries";
    }

    const entry = entries[0];

    if (entry.Id) {
      await OfflineNetworkingEntriesRepository().where("Id", entry.Id).delete();
      return `Successfully removed offline networking entry with ${entry.name}`;
    }

    return `No suitable entry`;
  }
}

export const OfflineNetworkingEntriesRepository = () => Connection<OfflineNetworkingEntry>("OfflineNetworkingEntries");
