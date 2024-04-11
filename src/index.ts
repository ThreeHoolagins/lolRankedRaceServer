import axios from "axios";
import cors from "cors";
import express, {Express, Request, Response} from "express";
import key from "./apiKey.js";
import pkg from 'limiter';
// const { RateLimiter } = pkg;

const app : Express = express();
app.use(cors());
app.use(express.json());

// TODO: introduct rate limiter or get source owner to update it, try linkedin
// const bigLimiter = new RateLimiter({ tokensPerInterval: 100, interval: 2*60*1000 });
// const smallLimiter = new RateLimiter({ tokensPerInterval: 20, interval: "second" });

const PORT = 8080;

app.get("/get-puuid/:name/:tag", async (req : Request, res : Response) => {
    logCall(req, "/get-puuid/:name/:tag");
    const { name, tag } = req.params;

    if (!name || !tag) {
        res.status(418).send({message : "Name or Tag unspecified"})
    }
    else {
        await getPUUID({gameName : name, tagLine : tag}).then((response) => {
            response.json().then((value) => {
                res.status(200).send(value)
            })
        });
    }
})

app.post("/get-match-ids", async (req : Request, res : Response) => {
    logCall(req, "/get-match-ids");
    const { puuid, matchesQueryParams } = req.body;

    if (!puuid) {
        res.status(418).send({message : "puuid unspecified"})
    }
    else {
        const response = await matchesByPuuid(puuid, matchesQueryParams);
        res.status(200).send(response.data);
    }
})

app.get("/get-match-details/:matchId", async (req : Request, res : Response) => {
    logCall(req, "/get-match-details/:matchId");
    const { matchId } = req.params;

    if (!matchId) {
        res.status(418).send({message : "matchId unspecified"})
    }
    else {
        await matchesByMatchID(matchId).then((response) => {
            response.json().then((value) => {
                res.status(200).send(value)
            })
        });
    }
})

app.post("/batch-get-match-details", (req : Request, res : Response) => {
    logCall(req, "/batch-get-match-details");
    const { matchIds } = req.body;

    // TODO: rate limit this so we can ask for as much as we want
    // TODO: maybe rate limit entire everything
    if (!matchIds) {
        res.status(418).send({message : "matchId unspecified"})
    }
    else {
        const promises = new Array<Promise<globalThis.Response>>;
        matchIds.forEach(matchId => promises.push(matchesByMatchID(matchId)));
        Promise.all(promises).then((matchesRequestInfo) => {
            const jsonPromises = new Array<Promise<any>>;
            matchesRequestInfo.map(matchRequestInfo => jsonPromises.push(matchRequestInfo.json()));
            Promise.all(jsonPromises).then((matchesInfo) => {
                console.log(matchesInfo);
                res.status(200).send(matchesInfo.map(matchInfo => matchInfo.info?.endOfGameResult))
            })
        })
    }
})

app.listen(PORT, () => console.log(`now listening on port ${PORT}`));

interface PlayerProp {
    gameName : string
    tagLine : string
}

const getPUUID = (props : PlayerProp) => {
    const url=`https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${props.gameName}/${props.tagLine}?api_key=${key}`;
    return fetch(url, {
        method: "GET",
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
    });
}

interface MatchesQueryParams {
    startTime? : number,
    endTime? : number,
    queue? : number,
    type? : string,
    start? : number,
    count? : number,
}

// const waitForQueue = async () => {
//     const remainingBigRequests = await bigLimiter.removeTokens(1);
//     const remainingSmallRequests = await smallLimiter.removeTokens(1);
// }

const matchesByPuuidUrlBuilder = (puuid : String, matchesQueryParams : MatchesQueryParams) => {
    let url=`https://americas.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?`;
    const { startTime, endTime, queue, type, start, count }= matchesQueryParams;
    if (startTime) {
        url += `startTime=${startTime}&`;  
    }
    if (endTime) {
        url += `endTime=${endTime}&`;  
    }
    if (queue) {
        url += `queue=${queue}&`;  
    }
    if (type) {
        url += `type=${type}&`;  
    }
    if (start) {
        url += `start=${start}&`;  
    }
    if (count) {
        url += `count=${count}&`;  
    }
    return url + `api_key=${key}`;
}

const matchesByPuuid = async (puuid : String, matchesQueryParams : MatchesQueryParams) => {
    const url = matchesByPuuidUrlBuilder(puuid, matchesQueryParams);

    // await waitForQueue();
    return axios.get(url);
}

const matchesByMatchID = async (matchId : String) : Promise<globalThis.Response> =>  {
    const url = `https://americas.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${key}`;

    // await waitForQueue();
    return fetch(url, {
        method: "GET",
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
    });
}

// * Private Methods
const logCall = (req : Request, url : String) => {
    console.log(`${new Date(Date.now()).toLocaleString()}: Request from ${req.hostname} to ${url}`)
}