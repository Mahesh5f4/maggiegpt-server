const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB } = require('./db');
const authRoutes = require('./authRoutes');
const chatRoutes = require('./chatRoutes');

dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Routes
app.use('/api', authRoutes);
app.use('/api', chatRoutes);

// Start the server
connectDB()
  .then(() => {
   app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
  })
  .catch(err => console.error("MongoDB connection error:", err));
