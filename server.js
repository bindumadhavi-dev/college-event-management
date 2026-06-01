
const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

/* ================= DATABASE ================= */
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "root",
  database: "event_db"
});

db.connect(err => {
  if (err) console.log("❌ DB Error:", err);
  else console.log("✅ MySQL Connected");
});

/* ================= FILE UPLOAD SETUP ================= */
const uploadFolder = path.join(__dirname, "uploads");

// create uploads folder if not exists
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder);
}

// serve images
app.use("/uploads", express.static(uploadFolder));

// multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

/* ================= PAGE ROUTES ================= */
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "register.html")));
app.get("/home", (req, res) => res.sendFile(path.join(__dirname, "home.html")));
app.get("/login-page", (req, res) => res.sendFile(path.join(__dirname, "login.html")));
app.get("/about", (req, res) => res.sendFile(path.join(__dirname, "about.html")));
app.get("/live", (req, res) => res.sendFile(path.join(__dirname, "live.html")));
app.get("/events", (req, res) => res.sendFile(path.join(__dirname, "events.html")));
app.get("/booking", (req, res) => res.sendFile(path.join(__dirname, "booking.html")));
app.get("/payment-page", (req, res) => res.sendFile(path.join(__dirname, "payment.html")));
app.get("/tickets", (req, res) => res.sendFile(path.join(__dirname, "tickets.html")));
app.get("/attendence", (req, res) => res.sendFile(path.join(__dirname, "attendence.html")));

/* ================= REGISTER ================= */
app.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, student_id, dob, gender } = req.body;

    if (!fullName || !email || !password) {
      return res.json({ success: false, message: "Missing fields" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users (name, email, password, student_id, dob, gender)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [fullName, email, hashedPassword, student_id, dob, gender], (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.json({ success: false, message: "Email already exists" });
        }
        return res.json({ success: false, message: "Database error" });
      }

      res.json({ success: true, message: "Registered Successfully" });
    });

  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ================= LOGIN ================= */
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email=?", [email], async (err, result) => {
    if (err) return res.json({ success: false });
    if (result.length === 0) return res.json({ success: false, message: "User not found" });

    const match = await bcrypt.compare(password, result[0].password);

    if (match) res.json({ success: true });
    else res.json({ success: false, message: "Wrong password" });
  });
});

/* ================= BOOKING ================= */
app.post("/book", (req, res) => {
  const { userId, event, seats } = req.body;

  const bookingId = "BK" + Date.now();
  const values = seats.map(seat => [bookingId, userId, event, seat]);

  db.query(
    "INSERT INTO bookings (booking_id, user_id, event_name, seat_number) VALUES ?",
    [values],
    (err) => {
      if (err) return res.json({ success: false });
      res.json({ success: true, bookingId });
    }
  );
});

/* ================= PAYMENT ================= */
app.post("/payment", (req, res) => {
  const { bookingId, amount, method } = req.body;

  db.query(
    "INSERT INTO payments (booking_id, amount, payment_method) VALUES (?, ?, ?)",
    [bookingId, amount, method],
    (err, result) => {
      if (err) return res.json({ success: false });
      res.json({ success: true, paymentId: result.insertId });
    }
  );
});

/* ================= SAVE ATTENDANCE ================= */
app.post("/attendance", upload.single("ticket_pic"), (req, res) => {

  const {
    student_name,
    student_id,
    student_section,
    student_course,
    student_attending,
    student_ticket,
    student_ticket_id,
    student_ticket_details
  } = req.body;

  const ticket_pic = req.file ? req.file.filename : null;

  const sql = `
    INSERT INTO students 
    (student_name, student_id, student_section, student_course, student_attending, student_ticket, student_ticket_id, student_ticket_details, ticket_pic)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
    student_name=?, student_section=?, student_course=?, student_attending=?, student_ticket=?, student_ticket_id=?, student_ticket_details=?, ticket_pic=?
  `;

  db.query(sql, [
    student_name,
    student_id,
    student_section,
    student_course,
    student_attending,
    student_ticket,
    student_ticket_id,
    student_ticket_details,
    ticket_pic,

    student_name,
    student_section,
    student_course,
    student_attending,
    student_ticket,
    student_ticket_id,
    student_ticket_details,
    ticket_pic
  ], (err) => {
    if (err) {
      console.log(err);
      return res.json({ message: "Database error" });
    }

    res.json({ message: "Attendance saved successfully" });
  });
});

/* ================= GET STUDENTS ================= */
app.get("/students", (req, res) => {
  db.query("SELECT * FROM students ORDER BY id DESC", (err, result) => {
    if (err) return res.json([]);
    res.json(result);
  });
});

/* ================= UPDATE STATUS ================= */
app.post("/update-status", (req, res) => {
  const { student_id, student_status, attendance_status } = req.body;

  db.query(
    "UPDATE students SET student_status=?, attendance_status=? WHERE student_id=?",
    [student_status, attendance_status, student_id],
    (err) => {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});

/* ================= DELETE STUDENT ================= */
app.delete("/student/:id", (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM students WHERE student_id=?", [id], (err) => {
    if (err) return res.json({ success: false });
    res.json({ success: true });
  });
});

/* ================= START SERVER ================= */
app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});