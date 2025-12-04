require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;
console.log('Testing Connection to:', uri ? uri.split('@')[1] : 'UNDEFINED'); // Hides password for safety

mongoose.connect(uri)
  .then(() => {
    console.log('✅ SUCCESS: Connected to MongoDB!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ FAILURE: Could not connect.');
    console.error('Error Name:', err.name);
    console.error('Error Message:', err.message);
    if (err.codeName === 'AtlasError') {
       console.error('💡 HINT: This might be an IP Whitelist issue.');
    }
    process.exit(1);
  });
