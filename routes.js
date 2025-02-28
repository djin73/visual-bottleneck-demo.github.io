const express = require("express");
const { PythonShell } = require("python-shell");
let options = {
    args : []
}
PythonShell.run('./install_package.py', options, 
    function(err, results)
    {
        if (err) throw err;
        else console.log(results);
    })
const fs = require("fs");
const db = require("./db.js");
const router = express.Router();
const env = require("dotenv");

env.config();

// TODO look into error handling?
router.put(
  "/save-annotations/:dataset/:bottleneck/:class",
  async (req, res) => {
    try {
      await db.update_annotations(
        req.params.dataset,
        req.params.bottleneck,
        parseInt(req.params.class),
        req.body["new_concepts"]
      );
      res.send({ success: true });
    } catch (e) {
      res.send({ success: false });
    }
  }
);

router.get("/get-annotations/:dataset/:bottleneck/:class", async (req, res) => {
  try {
    const db_result = await db.get_annotations_for_class(
      req.params.dataset,
      req.params.bottleneck,
      parseInt(req.params.class)
    );
    res.send({ data: db_result, err: null });
    // if nothing matches, db_result should be null
  } catch (e) {
    res.send({ data: null, err: e });
  }
});

router.get("/download-annotations/:dataset/:bottleneck", async (req, res) => {
  try {
    const db_triplets = await db.get_all_annotations_for_bottleneck(
      req.params.dataset,
      req.params.bottleneck
    );
    res.send({ data: db_triplets, success: true });
  } catch (e) {
    res.send({ data: e, success: false });
  }
});

router.get("/get-datasets-bottlenecks", (req, res) => {
  // TODO EDIT PYTHON PATH IN .env
  const shell = new PythonShell("get_datasets_bottlenecks.py", {
    mode: "json",
    pythonPath: process.env.PYTHON_PATH,
  });

  shell.on("message", (message) => {
    res.send({ success: true, data: message });
  });
  shell.end((err) => {
    if (err) res.send({ success: false, data: err });
  });
});

router.get("/", async (req, res) => {
  res.render('public/search.html')
});

router.get("/get-random-dataset-bottleneck", (req, res) => {
  // TODO EDIT PYTHON PATH IN .env
  const shell = new PythonShell("get_random_bottleneck.py", {
    mode: "json",
    pythonPath: process.env.PYTHON_PATH,
  });

  shell.on("message", (message) => {
    res.send({ success: true, data: message });
  });
  shell.end((err) => {
    if (err) res.send({ success: false, data: err });
  });
});

module.exports = router;
