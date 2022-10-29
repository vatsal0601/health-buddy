const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const tesseract = require("tesseract.js");
const axios = require("axios");
const Image = require("./models/image");
const User = require("./models/user");
require("dotenv").config();

const app = express();

app.use(
  cors({
    origin: "*",
  })
);

mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const database = mongoose.connection;
database.on("error", (err) => console.error(err));
database.once("open", () => console.log("Connected to Database"));

app.set("view engine", "ejs");
app.use("/images", express.static(path.join(__dirname, "/images")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

app.post("/upload", upload.single("image"), async (req, res, next) => {
  console.log(req.file);

  tesseract
    .recognize(`./images/${req.file.filename}`, "eng", {})
    .then(({ data: { text } }) => {
      console.log(text);
      const processedWords = text
        .trim()
        .toLowerCase()
        .replace(/ingredients/i, "")
        .replace(/\n/gi, " ")
        .split(/,\s/gi);
      console.log("\nprocessed words: ", processedWords.length);
      return processedWords;
    })
    .then(async (words) => {
      const imageData = [];
      if (words.length <= 0) return imageData;
      for (let word of words) {
        const resAPI = await axios.get(
          `https://edamam-food-and-grocery-database.p.rapidapi.com/parser?ingr=${word}`,
          {
            headers: {
              "X-RapidAPI-Key": process.env.API_KEY,
              "X-RapidAPI-Host": process.env.HOST,
            },
          }
        );
        console.log(`${word}: ${resAPI.data.hints.length}`);
        imageData.push({ word, data: resAPI.data.hints });
      }
      return imageData;
    })
    .then(async (imageData) => {
      const image = new Image({ filename: req.file.filename, data: imageData });
      const newImageData = await image.save();
      console.log(newImageData);
      res.status(200).redirect(`/image/${newImageData._id.toString()}`);
    });

  res.status(400).redirect("/");
});

app.post("/register", async (req, res, next) => {
  let user = await User.findOne({ email: req.body.email });

  if (user === null) {
    user = new User({ name: req.body.name, email: req.body.email, password: req.body.password });
    const newUser = user.save();
    res.status(201).json(newUser);
  }

  res.status(200).json(user);
});

app.post("/login", async (req, res, next) => {
  let user = await User.findOne({ email: req.body.email });

  if (user === null) res.status(404).json({ message: "User not found" });

  if (user.password !== req.body.password) res.status(403).json({ message: "Invalid Password" });

  res.status(200).json(user);
});

app.get("/image/:id", async (req, res, next) => {
  const image = await Image.findById(req.params.id);
  if (image === null) return res.status(404).json({ message: "Cannot find image" });
  res.status(200).json(image);
});

app.get("/", (req, res, next) => {
  res.status(200).render("index");
});

app.listen(process.env.PORT || 5000);
