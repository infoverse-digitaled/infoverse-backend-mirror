import mongoose from 'mongoose';
import dotenv from 'dotenv';
import LicenseBatch from './src/models/LicenseBatch';

dotenv.config();

const checkLicenses = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/infoverse');
    const licenses = await LicenseBatch.find({});
    console.log('Total Licenses:', licenses.length);
    licenses.forEach((l) => {
      console.log(
        `Key: "${l.licenseKey}", School: "${l.schoolName}", Active: ${l.isActive}, Expiry: ${l.expiryDate}`,
      );
    });
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
};

checkLicenses();
