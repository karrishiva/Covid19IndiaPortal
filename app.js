const express = require("express");

const path = require("path");
const app = express();

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
app.use(express.json());

const { open } = require("sqlite");

const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB server '${error.message}'`);
    process.exit(1);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", authenticateToken, async (request, response) => {
  const { username, password } = request.body;

  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`;

  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };

      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");

      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const convertSnakeIntoPascalCase = (eachState) => {
  return {
    stateId: eachState.state_id,
    stateName: eachState.state_name,
    population: eachState.population,
  };
};

const convertDistrictObjectToDbObject = (eachDistrict) => {
  return {
    districtId: eachDistrict.district_id,
    districtName: eachDistrict.district_name,
    stateId: eachDistrict.state_id,
    cases: eachDistrict.cases,
    cured: eachDistrict.cured,
    active: eachDistrict.active,
    deaths: eachDistrict.deaths,
  };
};
app.get("/states/", async (request, response) => {
  const allStatesQuery = `SELECT * FROM state;`;

  const dbStates = await db.all(allStatesQuery);

  response.send(
    dbStates.map((eachState) => {
      convertSnakeIntoPascalCase(eachState);
    })
  );
});

app.get("/states/:stateId/", async (request, response) => {
  const { stateId } = request.params;
  const selectedStateQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;

  const stateData = await db.get(selectedStateQuery);
  response.send(stateData);
});

app.post("/districts/", async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;

  const createNewDistrictQuery = `INSERT INTO district (districtName, stateId, cases, cured, active, deaths)
    VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths};`;

  await db.run(createNewDistrictQuery);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;

  const selectedDistrictQuery = `SELECT * FROM district WHERE district_id=${districtId};`;

  const dbDistrict = await db.get(selectedDistrictQuery);
  response.send(
    dbDistrict.map((eachDistrict) => {
      convertDistrictObjectToDbObject(eachDistrict);
    })
  );
});

app.delete("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const deleteQuery = `DELETE FROM district WHERE district_id=${districtId};`;

  await db.run(deleteQuery);
  response.send("District Removed");
});

app.put("/districts/:districtId/", async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateQuery = `UPDATE district SET district_name = '${districtName}',
    state_id = ${stateId}, cases = ${cases}, cured=${cured}, active=${active}, deaths=${deaths} WHERE district_id=${districtId};`;

  await db.run(updateQuery);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", async (request, response) => {
  const { stateId } = request.params;

  const selectedStateQuery = `SELECT SUM(cases) AS totalCases,
    SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths WHERE state_id = ${stateId};`;

  const dbQuery = await db.get(selectedStateQuery);
  response.send(dbQuery);
});

module.exports = app;
