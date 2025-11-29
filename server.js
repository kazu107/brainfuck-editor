const path = require("path");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

const publicDir = __dirname;

app.use(express.static(publicDir));

app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
    console.log(`Brainfuck runner listening on port ${port}`);
});
