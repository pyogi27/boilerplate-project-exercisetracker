const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
const connection = mongoose.connection;
connection.once('open', () => {
  console.log("MongoDB database connection established successfully");
});

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: { type: String, required: true },
}, {
  timestamps: true,
});

const exerciseSchema = new Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now },
}, {
  timestamps: true,
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);


app.post('/api/users', async (req, res) => {
  try {
    const user = new User({ username: req.body.username });
    const newUser = await user.save();
    res.json({ username: newUser.username, _id: newUser._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({}).select('username _id');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.post('/api/users/:_id/exercises', async (req, res) => {
  const { description, duration, date } = req.body;
  const userId = req.params._id;

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const exercise = new Exercise({
      userId: user._id,
      description: description,
      duration: parseInt(duration, 10),
      date: date ? new Date(date) : new Date()  // Use current date if no date provided
    });

    const savedExercise = await exercise.save();
    res.status(201).json({
      _id: userId,
      username: user.username,
      date: savedExercise.date.toDateString(),
      duration: savedExercise.duration,
      description: savedExercise.description
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


app.get('/api/users/:_id/logs', async (req, res) => {
  const { _id } = req.params;

  try {
    // Verify the user exists
    const user = await User.findById(_id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Building the query for exercises based on date filters
    let queryConditions = { userId: _id }; // Ensures exercises are queried by userId
    const { from, to, limit } = req.query;

    // Date filters: Ensure both 'from' and 'to' are included in the condition correctly
    if (from) {
      queryConditions.date = { ...queryConditions.date, $gte: new Date(from) };
    }
    if (to) {
      queryConditions.date = { ...queryConditions.date, $lte: new Date(to) };
    }

    // Fetching exercises with optional limit
    let exercises = await Exercise.find(queryConditions)
      .limit(parseInt(limit, 10) || 0)  // Parse limit to integer, default to no limit
      .select('description duration date');  // Properly select fields, ensure '_id' is needed or not

    // Formatting exercises' date to a readable string
    exercises = exercises.map(ex => ({
      description: ex.description,
      duration: ex.duration,
      date: ex.date.toDateString()  // Convert date to a more readable format
    }));

    // Respond with user info and exercise log
    res.json({
      _id: _id,
      username: user.username,
      count: exercises.length,
      log: exercises
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
