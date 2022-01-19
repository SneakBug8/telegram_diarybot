import * as express from "express";
import { Config } from "../config";

class WebApiClass
{
  public app: express.Express;
  public constructor()
  {
    this.app = express();
    const port = Config.port();

    /* const hbs = exphbs.create({ extname: ".hbs" });

    /*app.engine(".hbs", hbs.engine);
    app.set("view engine", ".hbs");
    app.set("views", __dirname + "/views");

    app.use(express.static(Config.projectPath() + "/client/build"));*/
    this.app.use(express.static(Config.projectPath() + "/public"));

    // app.use(cookieParser());
    // app.use(bodyParser.urlencoded({ extended: false }));
    // app.use(bodyParser.json());

    this.app.listen(port, () =>
    {
      console.log(`Server listening at http://localhost:${port}`);
    });

    this.app.use((req, res, next) =>
    {
      console.log(req.method + " to " + req.url);
      next();
    });
  }
}

export const WebApi = new WebApiClass();
