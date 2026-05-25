const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2'
];

const destDir = path.join(__dirname, '..', '..', 'frontend', 'public', 'models');

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

console.log(`Downloading face-api.js weights files to ${destDir}...`);

function downloadFile(fileIndex) {
  if (fileIndex >= FILES.length) {
    console.log('All model weights files downloaded successfully!');
    return;
  }

  const fileName = FILES[fileIndex];
  const fileUrl = `${BASE_URL}${fileName}`;
  const filePath = path.join(destDir, fileName);

  console.log(`Downloading (${fileIndex + 1}/${FILES.length}): ${fileName}...`);

  const fileStream = fs.createWriteStream(filePath);

  https.get(fileUrl, (response) => {
    if (response.statusCode !== 200) {
      console.error(`Failed to download ${fileName}. Status Code: ${response.statusCode}`);
      fileStream.close();
      fs.unlinkSync(filePath); // delete partial file
      // Proceed to next file
      downloadFile(fileIndex + 1);
      return;
    }

    response.pipe(fileStream);

    fileStream.on('finish', () => {
      fileStream.close();
      console.log(`Saved: ${fileName}`);
      downloadFile(fileIndex + 1);
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${fileName}:`, err.message);
    fileStream.close();
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    downloadFile(fileIndex + 1);
  });
}

downloadFile(0);
