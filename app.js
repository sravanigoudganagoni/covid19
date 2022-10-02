const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const dbpath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDbserver = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("server runnig at http/3000");
    });
  } catch (e) {
    console.log("DB error:${e.message}");
    process.exit(1);
  }
};

initializeDbserver();

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(
      jwtToken,
      "my_secrete_token",
      async(error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          next();
        }
      });
  }
};


app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user 
    WHERE username='${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordSame = await bcrypt.compare(password, dbUser.password);
    if (isPasswordSame === true) {
      const payload = { username: username,};
      const jwtToken = jwt.sign(payload, "my_secrete_token");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});



const convertionOfStates = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    papulation: dbobject.population,
  };
};

app.get("/states/", authenticationToken,  async (request, response) => {
  const selectStateQuery = `SELECT * FROM state;`;
  const statesArray = await db.all(selectStateQuery);
  response.send(statesArray.map((each)=>convertionOfStates(each));
  );
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const selectStateQuery = `SELECT * FROM state
    WHERE state_id=${stateId};`;
  const statesArray = await db.get(selectStateQuery);
  response.send(convertionOfStates(statesArray));
});

app.post("/districts/", authenticationToken,async (request, response) => {
  const {
    districtName,
    stateId,
    cases,
    curved,
    active,
    deaths,
  } = request.body;
  const addingDistricQuery = `INSERT INTO district (district_name,
        state_id,cases,curved,active,deaths VALUES ('${districtName}',
        ${stateId},${cases},${curved},${active},${deaths});`;
  await db.run(addingDistricQuery);
  response.send("District Successfully Added");
});

const converstionofDistrict = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.curved,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};


app.put("/districts/:districtId/", authenticationToken,async (request, response) => {
  const {districtId} = request.params;
   const {
    districtName,
    stateId,
    cases,
    curved,
    active,
    deaths,
  } = request.body;
  const addingDistricQuery = `UPDATE district SET district_name='${districtName}',
        state_id=${stateId},cases=${cases},curved=${curved},
        active=${active},deaths=${deaths} WHERE district_id=${districtId};`;
  await db.run(addingDistricQuery);
  response.send("District Details Updated");
});


app.get("/districts/:districtId/",authenticationToken,  async (request, response) => {
  const { districtId } = request.params;
  const selectDistrictQuery = `SELECT * FROM district WHERE
    district_id=${districtId};`;
  const districtArray = await db.get(selectDistrictQuery);
  response.send(converstionofDistrict(districtArray));
});

app.delete("/districts/:districtId/", authenticationToken, async (request, response) => {
  const { districtId } = request.params;
  const selectDistrictQuery = `DELETE FROM district WHERE
    district_id=${districtId};`;
  await db.run(selectDistrictQuery);
  response.send("District Removed");
});

app.get("/states/:stateId/stats/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const sumDetailsQuery = `SELECT SUM(cases),SUM(curved),
  SUM(active),SUM(deaths) FROM district WHERE state_id=${stateId};`;
  const states=await db.get(sumDetailsQuery);
  response.send({
      totalCases:states["SUM(cases)"],
      totalCurved:states["SUM(curved)"],
      totalActive:states["SUM(active)"],
      totalDeaths:states["SUM(deaths)"],

  })
});

module.exports = app;
