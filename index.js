const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();

const port = process.env.PORT || 5000;

/* 
    MiddleWare
    * Cors
    * Body parser
*/

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

/* Middleware  end*/

app.get("/", async (req, res) => {
  res.send("Hello World!");
});

// Database Connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mj0nqa8.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    // Database
    const db = client.db("ToriTorkari");

    // Collections
    const usersCollections = db.collection("Users");

    // Create user
    app.post("/users", async (req, res) => {
      const user = req.body;

      const result = await usersCollections.insertOne(user);

      res.json(result);
    });

    // Get JWT token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };

      const user = await usersCollections.findOne(query);
      if (user) {
        const token = jwt.sign({ user }, process.env.JWT_TOKEN, {
          expiresIn: "1d",
        });
        return res.json({ message: "success", token: token });
      } else {
        return res.status(403).json("Unauthorized Access");
      }
    });
  } finally {
  }
}
run().catch(console.dir);

// Database End

//server
app.listen(port, () => {
  client.connect((err) => {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Toritorkari DB connected");
    }
  });
  console.log("Toritorkari Server is running on port: ", port);
});
