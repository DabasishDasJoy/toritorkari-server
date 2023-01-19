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

    /* ******* Collections **************** */
    const usersCollections = db.collection("users");
    const categoriesCollections = db.collection("categories");
    const productsCollection = db.collection("products");

    /* ************** APIs ********************* */
    /* ================Crete User================== */
    // Create user
    app.post("/users", async (req, res) => {
      const user = req.body;

      const result = await usersCollections.insertOne(user);

      res.json(result);
    });
    // Create user end

    /* ===============Get JWt=================== */

    /***************
     * Get JWT token for user
     * Find the logged in user in Database in every login
     * Then provide JWT token
     ****************/

    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };

      const user = await usersCollections.findOne(query);
      if (user) {
        const token = jwt.sign({ user }, process.env.JWT_token, {
          expiresIn: "1d",
        });
        return res.json({ message: "success", token: token });
      }
      return res.status(403).json("Unauthorized Access");
    });

    /* ===============Categories=================== */
    /***********************************************
     *  Get All the Categories which is a public route
     * Should not very jwt token in public routes
     * ********************************************/

    app.get("/categories", async (req, res) => {
      const categories = await categoriesCollections.find().toArray();

      res.json(categories);
    });
    /* ==============Get Products from specic Category==================== */
    /**
     * Get the category id
     * Filter all the products having the same category name
     * Return the result
     */
    app.get("/category/:name", async (req, res) => {
      const name = req.params.name;

      // Flter query
      const query = { category: name };
      const result = await productsCollection.find(query).toArray();

      res.json(result);
    });

    /* ================================== */

    /* ================================== */

    /* ================================== */

    /* ================================== */

    /* ================================== */

    /* ================================== */

    /* ================================== */

    /* ================================== */

    /* ================================== */
    /* ************** APIs ********************* */
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
