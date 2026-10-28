const mongoose = require('mongoose');

async function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartlib';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2500 });
    console.log(`MongoDB Connected successfully to ${mongoose.connection.host || 'database'}`);
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    throw error;
  }
}

module.exports = {
  connect,
};
