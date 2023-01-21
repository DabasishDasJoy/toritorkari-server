const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const verifyJwtToken = require("./middleware/verifyJwtToken");
const verifyEmail = require("./middleware/verifyEmail");
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
    const reviewsCollection = db.collection("reviews");

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
    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const categoryQuery = { _id: ObjectId(id) };
      const category = await categoriesCollections.findOne(categoryQuery);
      const { categoryName } = category;
      // Flter query
      const query = { category: categoryName };
      const result = await productsCollection.find(query).toArray();

      res.json(result);
    });

    /* ===============Get A product=================== */
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };

      const result = await productsCollection.findOne(query);

      res.json(result);
    });

    /* ================Get A product review================== */
    app.get("/reviews/:productId", async (req, res) => {
      // Get the prouduct id
      try {
        const id = req.params.productId;
        const query = { productId: id };

        const result = await reviewsCollection.find(query).toArray();

        res.json(result);
      } catch (error) {
        res.status(400).json("Server Error");
      }
    });

    /* ================Create a review================== */
    app.post("/reviews", verifyJwtToken, verifyEmail, async (req, res) => {
      try {
        const data = req.body;
        const result = await reviewsCollection.insertOne(data);
        res.json(result);
      } catch (error) {
        res.status(400).json("Server Error");
      }
    });

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
