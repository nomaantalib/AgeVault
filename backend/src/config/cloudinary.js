const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

let isCloudinaryConfigured = false;

if (
  process.env.CLOUDINARY_URL ||
  (process.env.CLOUDINARY_CLOUD_NAME &&
   process.env.CLOUDINARY_API_KEY &&
   process.env.CLOUDINARY_API_SECRET)
) {
  if (!process.env.CLOUDINARY_URL) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  isCloudinaryConfigured = true;
  console.log('Cloudinary successfully configured.');
} else {
  console.log('Cloudinary credentials missing. Falling back to local disk storage.');
}

/**
 * Uploads a local file to Cloudinary or returns its local serving URL.
 * @param {string} localFilePath - Path to the file on disk.
 * @param {object} req - Express request object for generating base URL if fallback.
 * @returns {Promise<string>} The public URL of the uploaded image.
 */
const uploadImage = async (localFilePath, req) => {
  if (!localFilePath) return '';

  try {
    if (isCloudinaryConfigured) {
      const result = await cloudinary.uploader.upload(localFilePath, {
        folder: 'agevault',
      });
      // Delete local temporary file
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
      return result.secure_url;
    } else {
      // Local serving URL fallback
      const filename = localFilePath.split(/[\\/]/).pop();
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      return `${baseUrl}/uploads/${filename}`;
    }
  } catch (error) {
    console.error('Image upload failed:', error);
    // If Cloudinary fails, try returning the local URL as a absolute fallback
    try {
      const filename = localFilePath.split(/[\\/]/).pop();
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      return `${baseUrl}/uploads/${filename}`;
    } catch (_) {
      throw error;
    }
  }
};

module.exports = {
  uploadImage,
  isCloudinaryConfigured,
};
