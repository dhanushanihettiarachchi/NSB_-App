// index.js
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const circuitRoutes = require('./routes/circuits');

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Serve uploaded images publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/circuits', circuitRoutes);

app.get('/ping', (req, res) => {
  res.send('pong');
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on port ${PORT}`);
});
