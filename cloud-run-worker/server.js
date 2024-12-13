// server.js

const express = require("express");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const app = express();

app.use(express.json());

// Initialize Google Cloud Storage with error handling
const { Storage } = require("@google-cloud/storage");
let storage = new Storage();

app.post("/compute", async (req, res) => {
  console.log("Received computation request");

  const { sourceCode, input, inputUrl } = req.body;
  if (!sourceCode || (!input && !inputUrl)) {
    return res
      .status(400)
      .json({ error: "Missing sourceCode and either input or inputUrl" });
  }

  // Generate random IDs for temporary files
  const tmpDir = "/tmp";
  const randomId = Math.random().toString(36).substring(7);
  const sourcePath = path.join(tmpDir, `solution_${randomId}.cpp`);
  const binaryPath = path.join(tmpDir, `solution_${randomId}`);
  const inputPath = path.join(tmpDir, `input_${randomId}.txt`);
  const outputPath = path.join(tmpDir, `output_${randomId}.txt`);

  try {
    // Save source code to file
    await fs.writeFile(sourcePath, sourceCode, "utf8");

    // Handle input or inputUrl
    if (input) {
      await fs.writeFile(inputPath, input, "utf8");
    } else if (inputUrl) {
      await downloadFromGCS(inputUrl, inputPath);
    }

    // Compile and run the code
    const compileAndRunCommand = `g++ -std=c++20 "${sourcePath}" -o "${binaryPath}" && "${binaryPath}" < "${inputPath}" > "${outputPath}"`;

    await new Promise((resolve, reject) => {
      exec(compileAndRunCommand, (error, stdout, stderr) => {
        if (error) {
          reject(stderr || error.message);
        } else {
          resolve();
        }
      });
    });

    // Upload output to GCS
    const outputFilename = `output_${randomId}.txt`;
    const outputUrl = await uploadToGCS(outputPath, outputFilename);

    res.json({ outputUrl });
  } catch (error) {
    console.error("Computation error:", error);
    res.json({ error: error.toString() });
  } finally {
    // Cleanup temporary files
    try {
      await fs.unlink(sourcePath);
      await fs.unlink(binaryPath);
      await fs.unlink(inputPath);
      await fs.unlink(outputPath);
    } catch (error) {}
  }
});

// Helper functions to interact with GCS
async function downloadFromGCS(objectUrl, destPath) {
  console.log(`Downloading from GCS: ${objectUrl} to ${destPath}`);
  const [scheme, bucketWithPath] = objectUrl.split("://");
  const [bucketName, ...filePathParts] = bucketWithPath.split("/");
  const filePath = filePathParts.join("/");

  const options = { destination: destPath };
  await storage.bucket(bucketName).file(filePath).download(options);
}

async function uploadToGCS(localPath, destFilename) {
  console.log(`Uploading to GCS: ${localPath} as ${destFilename}`);
  const bucketName = "hacker-bucket"; // Replace with the bucket name you created
  await storage.bucket(bucketName).upload(localPath, {
    destination: destFilename,
  });
  return `gs://${bucketName}/${destFilename}`;
}

// Server setup
const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`Worker server listening on port ${PORT}`);
});

// Set server timeout to 10 minutes (600000 milliseconds)
server.setTimeout(600000);
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM signal, initiating shutdown");
  // Clean up resources here
  process.exit(0);
});
