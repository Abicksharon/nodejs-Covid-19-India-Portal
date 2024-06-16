const express = require('express')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const path = require('path')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const app = express()
app.use(express.json())
let db = null

const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')

const intializedb = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Successfully Running')
    })
  } catch (e) {
    console.log(`${e.message}`)
    process.exit(1)
  }
}
intializedb()

app.post('/login/', async (request, response) => {
  try {
    const logindetails = request.body
    const {username, password} = logindetails
    const checkuserquery = `
        select * from user where username='${username}'`
    const dbresponsecheckuser = await db.get(checkuserquery)

    if (dbresponsecheckuser !== undefined) {
      const iscorrectpassword = await bcrypt.compare(
        password,
        dbresponsecheckuser.password,
      )
      if (iscorrectpassword) {
        response.status(200)
        const payload = {
          username: username,
        }
        const jwtToken = jwt.sign(payload, 'My_auth_jwt_token')
        response.send({jwtToken})
      } else {
        response.status(400)
        response.send('Invalid password')
      }
    } else {
      response.status(400)
      response.send('Invalid user')
    }
  } catch (e) {
    console.log(`${e.message}`)
  }
})

//authenticate jwt
const logger = (request, response, next) => {
  try {
    let jwttoken
    const authheader = request.headers['authorization']
    if (authheader !== undefined) {
      jwttoken = authheader.split(' ')[1]
    }

    if (jwttoken === undefined) {
      response.status(401)
      response.send('Invalid JWT Token')
    } else {
      const verifyjwt = jwt.verify(
        jwttoken,
        'My_auth_jwt_token',
        (error, payload) => {
          if (error) {
            response.status(401)
            response.send('Invalid JWT Token')
          } else {
            next()
          }
        },
      )
    }
  } catch (e) {
    console.log(`${e.message}`)
  }
}

//get a list of all states in the state table
app.get('/states/', logger, async (request, response) => {
  const dbquery = `
    select * from state;`

  const dbresponse = await db.all(dbquery)
  const changeobj = dbobj => {
    return {
      stateId: dbobj.state_id,
      stateName: dbobj.state_name,
      population: dbobj.population,
    }
  }
  response.send(dbresponse.map(each => changeobj(each)))
})

//get a state based on the state ID
app.get('/states/:stateId/', logger, async (request, response) => {
  const {stateId} = request.params
  const dbquery = `
    select * from state
    where state_id=${stateId};`

  const dbresponse = await db.get(dbquery)
  const changeobj = dbobj => {
    return {
      stateId: dbobj.state_id,
      stateName: dbobj.state_name,
      population: dbobj.population,
    }
  }
  response.send(changeobj(dbresponse))
})

//post a district
app.post('/districts/', logger, async (request, response) => {
  try {
    const districtdetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtdetails
    const dbquery = `
   INSERT INTO district ( state_id,district_name, cases, cured, active, deaths)
    VALUES 
    (${stateId},'${districtName}',${cases},${cured},${active},${deaths});`

    await db.run(dbquery)

    response.send('District Successfully Added')
  } catch (e) {
    console.log(`${e.message}`)
  }
})

//get a district based
app.get('/districts/:districtId/', logger, async (request, response) => {
  const {districtId} = request.params
  const dbquery = `
    select * from district 
    where district_id=${districtId};`

  const dbresponse = await db.get(dbquery)
  const changeobj = dbobj => {
    return {
      districtId: dbobj.district_id,
      districtName: dbobj.district_name,
      stateId: dbobj.state_id,
      cases: dbobj.cases,
      cured: dbobj.cured,
      active: dbobj.active,
      deaths: dbobj.deaths,
    }
  }
  response.send(changeobj(dbresponse))
})

//delete
app.delete('/districts/:districtId/', logger, async (request, response) => {
  const {districtId} = request.params
  const dbquery = `
    delete from district 
    where district_id=${districtId};`
  await db.get(dbquery)

  response.send('District Removed')
})

//put
app.put('/districts/:districtId/', logger, async (request, response) => {
  const {districtId} = request.params
  const districtdetails = request.body
  const {districtName, stateId, cases, cured, active, deaths} = districtdetails
  const dbquery = `
    update district 
    set
       district_name='${districtName}',
       state_id=${stateId},
       cases=${cases},
       cured=${cured},
       active=${active},
       deaths=${deaths}   
    where district_id=${districtId};`

  await db.run(dbquery)

  response.send('District Details Updated')
})

//get stats
app.get('/states/:stateId/stats/', logger, async (request, response) => {
  const {stateId} = request.params
  const dbquery = `
    select sum(cases),sum(cured),sum(active),sum(deaths) from district 
    where state_id=${stateId};`

  const dbresponse = await db.get(dbquery)
  const changeobj = dbobj => {
    return {
      totalCases: dbobj['sum(cases)'],
      totalCured: dbobj['sum(cured)'],
      totalActive: dbobj['sum(active)'],
      totalDeaths: dbobj['sum(deaths)'],
    }
  }

  response.send(changeobj(dbresponse))
})

//get
app.get(
  '/districts/:districtId/details/',
  logger,
  async (request, response) => {
    const {districtId} = request.params
    const dbquery = `
    select * from state inner join district 
    on state.state_id =district.state_id
    where district_id=${districtId};`

    const dbresponse = await db.get(dbquery)
    const changeobj = dbobj => {
      return {
        stateName: dbobj.state_name,
      }
    }

    response.send(changeobj(dbresponse))
  },
)

module.exports = app
