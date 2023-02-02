const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const verifyJwtToken = require("./middleware/verifyJwtToken");
const verifyEmail = require("./middleware/verifyEmail");
require("dotenv").config();
const app = express();
const stripe = require("stripe")(process.env.Stripe_Secret_Key);

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
    const invoicesCollection = db.collection("invoices");
    const offersCollection = db.collection("offers");

    /* ************** APIs ********************* */

    /*====================Utils========================= */
    const updateAverageRatings = async (data) => {
      /**
       * Get the product id
       * Fetch all reviews
       * Calculate total review
       * Averaage = total reviews/ number of reviews
       * Get the product from product collection
       * Update the review or upsert it with the avarage calculated
       */

      const targetProductReviews = await reviewsCollection
        .find({
          productId: data.productId,
        })
        .toArray();

      let average = "0";

      if (targetProductReviews.length) {
        const totalRatings = targetProductReviews.reduce(
          (prev, curr) => prev + parseFloat(curr.ratings),
          0
        );

        // calculate avg
        average = (totalRatings / targetProductReviews.length).toFixed(2);
      }
      // Calculate total reviews

      // Update in the product

      productsCollection.updateOne(
        { _id: ObjectId(data.productId) },
        { $set: { ratings: average } },
        { upsert: true }
      );
    };

    const updatePurchase = (orderDetails) => {
      orderDetails.cart.map(async (item) => {
        const { purchases } = await productsCollection.findOne({
          _id: ObjectId(item.productId),
        });

        const newPurchase = purchases
          ? parseInt(purchases) + parseInt(item.quantity)
          : 0 + parseInt(item.quantity);

        productsCollection.updateOne(
          { _id: ObjectId(item.productId) },
          {
            $set: {
              purchases: newPurchase,
            },
          },
          {
            upsert: true,
          }
        );
      });
    };

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
      try {
        const id = req.params.id;
        const categoryQuery = { _id: ObjectId(id) };
        const category = await categoriesCollections.findOne(categoryQuery);
        const { categoryName } = category;
        // Flter query

        const subCat = req.query.subcategory;
        const sort = req.query.sort;

        let query;
        if (subCat === "all") {
          query = {
            category: { $regex: "^" + categoryName + "$", $options: "i" },
          };
        } else {
          query = {
            category: categoryName,
            subCategory: {
              $regex: "^" + req.query.subcategory + "$",
              $options: "i",
            },
          };
        }
        let options = {};
        if (sort === "ascending") {
          options = {
            sort: { price: 1 },
          };
        } else if (sort === "descending") {
          options = {
            sort: { price: -1 },
          };
        }

        const data = await productsCollection.find(query, options).toArray();
        const dataCount = data.length;
        const result = await productsCollection
          .find(query, options)
          .skip(parseInt(req.query.page) * parseInt(req.query.size))
          .limit(parseInt(req.query.size))
          .toArray();

        res.json({ result, dataCount });
      } catch (err) {
        console.log(err);
        res.status(400).json("Server Error");
      }
    });

    /* ===============Get Search Results=================== */
    app.get("/search", async (req, res) => {
      const query = {
        // Regex in field to ignore case
        $or: [
          { tags: { $regex: req.query.query, $options: "i" } },
          { category: { $regex: "^" + req.query.query + "$", $options: "i" } },
          { subCategory: { $regex: req.query.query, $options: "i" } },
          { name: { $regex: req.query.query, $options: "i" } },
        ],
      };

      const sort = req.query.sort;
      let options = {};
      if (sort === "ascending") {
        options = {
          sort: { price: 1 },
        };
      } else if (sort === "descending") {
        options = {
          sort: { price: -1 },
        };
      }

      const data = await productsCollection.find(query, options).toArray();
      const dataCount = data.length;
      const result = await productsCollection
        .find(query, options)
        .skip(parseInt(req.query.page) * parseInt(req.query.size))
        .limit(parseInt(req.query.size))
        .toArray();

      res.json({ result, dataCount });
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
        // Update Average
        updateAverageRatings(data);
        res.json(result);
      } catch (error) {
        console.log(error);
        res.status(400).json("Server Error");
      }
    });

    /* ================Edit a review================== */
    /**
     * Find the review
     * If review exist set the updated data
     * Verify review email with request email also for extra safety
     */
    app.patch(
      "/reviews/:reviewId",
      verifyJwtToken,
      verifyEmail,
      async (req, res) => {
        try {
          const data = req.body;
          const reviewId = req.params.reviewId;
          // to find the target review
          const filter = {
            _id: ObjectId(reviewId),
            userEmail: req.query.email,
          };

          // Updated data
          const updateData = {
            $set: {
              review: data.review,
              ratings: data.ratings,
            },
          };
          // update
          const result = await reviewsCollection.updateOne(filter, updateData);

          // Update average
          // Fetch the review
          const review = await reviewsCollection.findOne({
            _id: ObjectId(reviewId),
          });
          // Send that review as data
          updateAverageRatings(review);

          res.json(result);
        } catch (err) {
          res.status(400).json("Server Error");
        }
      }
    );

    /* ===============Delete a Review=================== */
    app.delete(
      "/reviews/:reviewId",
      verifyJwtToken,
      verifyEmail,
      async (req, res) => {
        try {
          const query = {
            _id: ObjectId(req.params.reviewId),
            userEmail: req.query.email,
          };
          /**
           * Fetch review
           * Then delete
           * Then update
           * */

          const review = await reviewsCollection.findOne({
            _id: ObjectId(req.params.reviewId),
          });

          const result = await reviewsCollection.deleteOne(query);

          // Update average
          updateAverageRatings(review);

          res.json(result);
        } catch (error) {
          res.status(400).json("Server Error");
        }
      }
    );

    /* ===============Get shopping cart items=================== */
    /**
     * Get the cart id's from body
     * Find the proudcts that mathces up those ids
     * return the result array
     * */

    app.post("/shopping-cart", async (req, res) => {
      try {
        const cartItems = req.body;
        const cart = [];
        for (id in cartItems) {
          const query = { _id: ObjectId(id) };

          const item = await productsCollection.findOne(query);
          cart.push(item);
        }

        res.json(cart);
      } catch (err) {
        console.log(err);
        res.status(400).json("Server Error");
      }
    });

    /* ================Create Payment================== */
    app.post(
      "/create-payment-intent",
      verifyJwtToken,
      verifyEmail,
      async (req, res) => {
        try {
          const { grandTotal } = req.body;
          const amount = grandTotal * 100;

          // Create a PaymentIntent with the order amount and currency
          const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: "usd",
            automatic_payment_methods: {
              enabled: true,
            },
          });
          res.json({
            clientSecret: paymentIntent.client_secret,
          });
        } catch (error) {
          res.status(400).json("Server Error");
        }
      }
    );

    /* ================ Place Payment Details/order ================== */
    app.post("/invoices", verifyJwtToken, verifyEmail, async (req, res) => {
      try {
        const { orderDetails } = req.body;

        const result = await invoicesCollection.insertOne(orderDetails);

        // Update purchase
        updatePurchase(orderDetails);

        res.json(result);
      } catch (err) {
        res.status(400).json("Server Error");
      }
    });

    // app.post("/invoices/v2", verifyJwtToken, verifyEmail, async (req, res) => {
    //   try {
    //     const { orderDetails } = req.body;
    //     // const result = await invoicesCollection.insertOne(orderDetails);

    //     // Update purchase
    //     orderDetails.cart.map(async (item) => {
    //       const { purchases } = await productsCollection.findOne({
    //         _id: ObjectId(item.productId),
    //       });

    //       const newPurchase = purchases
    //         ? parseInt(purchases) + parseInt(item.quantity)
    //         : 0 + parseInt(item.quantity);

    //       productsCollection.updateOne(
    //         { _id: ObjectId(item.productId) },
    //         {
    //           $set: {
    //             purchases: newPurchase,
    //           },
    //         },
    //         {
    //           upsert: true,
    //         }
    //       );
    //     });

    //     // res.json(result);
    //   } catch (err) {
    //     res.status(400).json("Server Error");
    //   }
    // });

    /* =================Get A invoice=================== */
    app.get("/invoices/:uid", verifyJwtToken, verifyEmail, async (req, res) => {
      try {
        const query = { invoiceId: req.params.uid };

        const result = await invoicesCollection.findOne(query);

        res.json(result);
      } catch (error) {
        res.status(400).json("Server Error");
      }
    });

    /* ================Get All the invoices of a user================== */
    app.get("/invoices", verifyJwtToken, verifyEmail, async (req, res) => {
      try {
        const result = await invoicesCollection
          .find({ email: req.query.email })
          .skip(parseInt(req.query.page) * parseInt(req.query.size))
          .limit(parseInt(req.query.size))
          .toArray();

        res.json(result);
      } catch (err) {
        res.status(400).json("Server Error");
      }
    });

    /* =============== Get All the offers=================== */
    app.get("/offers", async (req, res) => {
      try {
        const size = req.query.size;

        const result = await offersCollection
          .find()
          .limit(parseInt(size))
          .toArray();
        res.json(result);
      } catch (error) {
        res.status(400).json("Server Error");
      }
    });
    /* =============== Get latest Discounted products================= */
    app.get("/discounts", async (req, res) => {
      try {
        const result = await productsCollection
          .find({
            discount: { $exists: true },
          })
          .limit(12)
          .toArray();

        res.json(result);
      } catch (err) {
        res.status(400).json("Server Error");
      }
    });

    /* ============== Check Coupon Velidity==================== */
    app.post("/offers", verifyJwtToken, verifyEmail, async (req, res) => {
      try {
        const query = { coupon: req.body.coupon };
        const coupon = await offersCollection.findOne(query);

        if (coupon) {
          /**
           * Chekck if coupon code is expired or not
           */
          if (new Date(coupon.expiresIn).getTime() > new Date().getTime()) {
            return res.json({
              message: "Valid",
              discount: coupon.discount,
              leastAmount: coupon.leastAmount,
            });
          } else {
            return res.json({ message: "Expired" });
          }
        } else {
          return res.json({ message: "Invalid" });
        }
      } catch (err) {
        res.status(400).json("Server Error");
      }
    });

    /* ===============Get Popular products =================== */
    app.get("/products/popular", async (req, res) => {
      try {
        const result = await productsCollection
          .find({ purchases: { $exists: true } }, { sort: { purchases: -1 } })
          .limit(12)
          .toArray();

        res.json(result);
      } catch (error) {
        console.log(error);
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
