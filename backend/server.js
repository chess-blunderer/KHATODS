// server.js — the entry point of the Khatod Hospital backend.
// Run with:  npm run dev   (development)   or   npm start   (plain Node)

// 1. Load the settings from the .env file into process.env.
//    This must happen before we read any process.env value below.
require("dotenv").config();

// 2. Import the tools we installed.
const express = require("express"); // the web framework
const cors = require("cors"); // lets the browser frontend talk to this backend

// 3. Read settings (with safe defaults if a value is missing from .env).
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";
const isDev = NODE_ENV === "development";

// "http://a.com, http://b.com"  ->  ['http://a.com', 'http://b.com']
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// 4. Create the app. Everything below attaches to this one object.
const app = express();

// ---------------------------------------------------------------------------
// CORS: decides which websites may call this backend from the browser.
// ---------------------------------------------------------------------------
const corsOptions = {
  origin(origin, callback) {
    // No Origin header = not a browser page calling us (address bar, curl, Postman). Allow.
    if (!origin) return callback(null, true);

    // Opening index.html by double-click sends the origin "null". Allow it in development only.
    if (origin === "null" && isDev) return callback(null, true);

    // Allow the websites listed in CORS_ORIGINS.
    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Anything else is refused with a clear error (handled by the error handler below).
    const error = new Error(`CORS blocked: ${origin} is not an allowed origin`);
    error.status = 403;
    return callback(error);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true, // will be needed later when we add login cookies
};

// ---------------------------------------------------------------------------
// Middleware: code that runs on every request, in the order written here.
// ---------------------------------------------------------------------------
app.use(cors(corsOptions)); // 1st: check who is calling
app.use(express.json()); // 2nd: turn JSON sent by the frontend into req.body

// ---------------------------------------------------------------------------
// Routes: the URLs this backend answers.
// ---------------------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Khatod Hospital backend is running",
    environment: NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Error handling. These two must stay AFTER all routes.
// ---------------------------------------------------------------------------

// A) 404: no route above matched the request.
app.use((req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error); // hand it to the error handler below
});

// B) Central error handler. Express knows it is an error handler because it has 4 parameters.
app.use((err, req, res, next) => {
  // If a response was already started we cannot send another one.
  if (res.headersSent) return next(err);

  const status = err.status || 500;

  // Real server bugs (500) are printed in the terminal so you can fix them.
  if (status >= 500) console.error(err);

  res.status(status).json({
    success: false,
    error: {
      status,
      // In production, do not leak internal details of a 500 error to users.
      message:
        status >= 500 && !isDev
          ? "Something went wrong on the server."
          : err.message,
    },
  });
});

// ---------------------------------------------------------------------------
// Start listening for requests.
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(
    `Khatod Hospital backend running at http://localhost:${PORT} (${NODE_ENV})`,
  );
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

// Friendly message if the port is already used by another program.
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Change PORT in .env or close the other program.`,
    );
  } else {
    console.error(error);
  }
  process.exit(1);
});
