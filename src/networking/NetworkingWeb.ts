import { WebApi } from "../api/web";
import { ProjectEntry } from "../projects/ProjectEntry";
import { Project } from "../projects/ProjectsData";
import { Color } from "../util/Color";
import { MIS_DT } from "../util/MIS_DT";
import * as express from "express";
import { NetworkingCommunication } from "./NetworkingCommunication";

export class NetworkingWebClass
{
  public Init()
  {
    WebApi.app.get("/networking/chart", this.OnNetworkingChart);
    WebApi.app.get("/networking/monthly", this.OnNetworkingMonthly);
    WebApi.app.get("/networking/cumulative", this.OnNetworkingChartCumulative);
  }

  public async OnNetworkingChart(req: express.Request, res: express.Response)
  {
    const entries = await NetworkingCommunication.GetLastMonth();

    const crarr = new Array<number>();
    const inarr = new Array<number>();
    const doarr = new Array<number>();

    for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
      const created = entries.filter((x) => x.Sent && MIS_DT.RoundToDay(new Date(x.CREATED_DT)) === i);
      const initiated = entries.filter((x) => x.Initiated && MIS_DT.RoundToDay(new Date(x.INITIATED_DT)) === i);
      const done = entries.filter((x) => x.Done && MIS_DT.RoundToDay(new Date(x.DONE_DT)) === i);

      crarr.push(created.length);
      inarr.push(initiated.length);
      doarr.push(done.length);
    }

    const datasets = new Array<object>();

    datasets.push({
      label: "Sent",
      data: crarr,
      borderColor: Color.GetColor(0),
    });
    datasets.push({
      label: "Initiated",
      data: inarr,
      borderColor: Color.GetColor(1),
    });
    datasets.push({
      label: "Done",
      data: doarr,
      borderColor: Color.GetColor(2),
    });

    const labels = [];

    for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
      labels.push(MIS_DT.FormatDate(i));
    }

    res.json({ datasets, labels });
  }

  public async OnNetworkingChartCumulative(req: express.Request, res: express.Response)
  {
    const entries = await NetworkingCommunication.GetLastMonth();

    const crarr = new Array<number>();
    const inarr = new Array<number>();
    const doarr = new Array<number>();

    let crsum = 0;
    let insum = 0;
    let dosum = 0;

    for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
      const created = entries.filter((x) => x.Sent && MIS_DT.RoundToDay(new Date(x.CREATED_DT)) === i);
      const initiated = entries.filter((x) => x.Initiated && MIS_DT.RoundToDay(new Date(x.INITIATED_DT)) === i);
      const done = entries.filter((x) => x.Done && MIS_DT.RoundToDay(new Date(x.DONE_DT)) === i);

      crsum += created.length;
      insum += initiated.length;
      dosum += done.length;

      crarr.push(crsum);
      inarr.push(insum);
      doarr.push(dosum);
    }

    const datasets = new Array<object>();

    datasets.push({
      label: "Sent",
      data: crarr,
      borderColor: Color.GetColor(0),
    });
    datasets.push({
      label: "Initiated",
      data: inarr,
      borderColor: Color.GetColor(1),
    });
    datasets.push({
      label: "Done",
      data: doarr,
      borderColor: Color.GetColor(2),
    });

    const labels = [];

    for (let i = MIS_DT.GetDay() - MIS_DT.OneDay() * 30; i <= MIS_DT.GetDay(); i += MIS_DT.OneDay()) {
      labels.push(MIS_DT.FormatDate(i));
    }

    res.json({ datasets, labels });
  }

  public async OnNetworkingMonthly(req: express.Request, res: express.Response)
  {
    const date = new Date(MIS_DT.GetDay());

    const crarr = new Array<number>();
    const inarr = new Array<number>();
    const doarr = new Array<number>();

    const labels = [];

    // Jan - 0th month

    for (let i = date.getMonth() - 12; i <= date.getMonth(); i++) {
      const y = date.getFullYear();

      const firstDay = new Date(y - (i < 0 ? 1 : 0), (i + 12) % 12, 1);
      const lastDay = new Date(y - (i < 0 ? 1 : 0), (i + 12) % 12 + 1, 0);

      console.log(`First day - ${MIS_DT.FormatDate(firstDay.getTime())} + ${firstDay.getTime()}`);
      console.log(`Last day - ${MIS_DT.FormatDate(lastDay.getTime())} + ${lastDay.getTime()}`);

      const entries = await NetworkingCommunication.GetBetweenDates(firstDay.getTime(),
        lastDay.getTime());

      const crsum = entries.reduce((p, c) => p + c.Sent, 0);
      const insum = entries.reduce((p, c) => p + c.Initiated, 0);
      const dosum = entries.reduce((p, c) => p + c.Done, 0);
      crarr.push(crsum);
      inarr.push(insum);
      doarr.push(dosum);

      labels.push(MIS_DT.FormatMonth(firstDay.getTime()));
      console.log(`Month ${i} - ${MIS_DT.FormatMonth(firstDay.getTime())}`);
    }

    const datasets = new Array<object>();

    datasets.push({
      label: "Sent",
      data: crarr,
      borderColor: Color.GetColor(0),
    });
    datasets.push({
      label: "Initiated",
      data: inarr,
      borderColor: Color.GetColor(1),
    });
    datasets.push({
      label: "Done",
      data: doarr,
      borderColor: Color.GetColor(2),
    });

    res.json({ datasets, labels });
  }
}

export const NetworkingWeb = new NetworkingWebClass();