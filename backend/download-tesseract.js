const fs = require('fs');
const path = require('path');
const https = require('https');

const targetDir = path.join(__dirname, '..', 'frontend', 'public', 'tesseract');

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const assets = [
  {
    name: 'worker.min.js',
    url: 'https://unpkg.com/tesseract.js@4.1.1/dist/worker.min.js'
  },
  {
    name: 'tess-core.wasm.js',
    url: 'https://unpkg.com/tesseract.js-core@4.0.3/tess-core.wasm.js'
  },
  {
    name: 'eng.traineddata.gz',
    url: 'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz'
  }
];

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: Status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded: ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
};

const run = async () => {
  console.log('Downloading self-hosted Tesseract.js assets to speed up mobile devices...');
  for (const asset of assets) {
    const destPath = path.join(targetDir, asset.name);
    try {
      await downloadFile(asset.url, destPath);
    } catch (err) {
      console.error(`Error downloading ${asset.name}:`, err.message);
    }
  }
  console.log('All Tesseract.js assets downloaded successfully.');
};

run();
