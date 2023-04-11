const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.set("views", path.join(__dirname, "/views"));
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(express.static("public"));

app.get("/", function (req, res) {
  res.render("index.ejs");
});
app.get("/playlist", function (req, res) {
  res.render("playlist.ejs");
});
app.get("/profile", function (req, res) {
  res.render("profile.ejs");
});

app.listen(3000, function () {
  console.log("Server started on port 3000");
});
