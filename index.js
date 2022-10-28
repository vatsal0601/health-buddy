const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const tesseract = require("tesseract.js");

const app = express();

app.use(
  cors({
    origin: "*",
  })
);

app.use(express.static(__dirname + "/public"));
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

app.post("/upload", upload.single("image"), (req, res, next) => {
  console.log(req.file);

  tesseract.recognize(`./images/${req.file.filename}`, "eng", {}).then(({ data: { text } }) => {
    console.log(text);
  });

  res.status(200).redirect("/");
});

app.get("/", (req, res, next) => {
  res.status(200).render("index.html");
});

app.listen(process.env.PORT || 5000);
