# InnovateSphere — Jharkhand Societal Innovation Collaboration Portal

> **Problem Statement 2643** | Smart India Hackathon  
> **Theme:** Digital platform to crowdsource societal challenges and facilitate collaborative problem-solving through universities and industry partnerships.

---

## 🌟 Overview

**InnovateSphere** is a digital platform built specifically to address community challenges across the 24 districts of Jharkhand. The platform connects:

1. **Citizens & Communities:** Identify and submit ground-level societal problems (water quality, healthcare access, crop disease, rural roads, accessibility, etc.) with photos and geo-location.
2. **Higher Education Institutions (HEIs):** Form interdisciplinary student & faculty teams to design, prototype, and build practical solutions.
3. **Industry & CSR Partners:** Provide funding, technical mentorship, incubation, and field-pilot deployment opportunities.
4. **Government Administrators:** Review, validate, route, and track progress transparently with comprehensive analytics.

---

## 🚀 Technology Stack

- **Frontend:** Vanilla HTML5, CSS3 (Modern Light Theme with Design Tokens), Vanilla JavaScript (ES6+), Chart.js for data visualization.
- **Backend:** Node.js & Express.js REST API with modular controllers, services, and middlewares.
- **Database:** MongoDB & Mongoose ODM with indexing, aggregation pipelines, and text search.
- **Authentication:** JWT (JSON Web Tokens) with role-based access control (Citizen, University Rep, Industry Rep, Admin), bcryptjs password hashing.
- **File Uploads:** Multer with file type validation and size limits.
- **AI Classification Engine:** TF-IDF keyword-based domain classifier across 10 thematic sectors.

---

## 🛠️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [MongoDB](https://www.mongodb.com/) (running locally on port 27017 or MongoDB Atlas URI)

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables (.env)
Create or verify the `.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/innovatesphere
JWT_SECRET=innovatesphere_jwt_secret_key_2024_change_in_production
JWT_EXPIRE=7d
NODE_ENV=development
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./public/uploads
```

### 3. Seed Database
Populate the database with 50+ realistic Jharkhand challenges, 5 top universities, 5 industry partners, test users, notifications, and activity logs:
```bash
npm run seed
```

### 4. Start the Application
```bash
npm start
# or for auto-reload during development:
npm run dev
```

Open your browser and visit: **`http://localhost:5000`**

---

## 🔐 Demo Credentials

| Role | Email | Password | Access / Dashboard |
| :--- | :--- | :--- | :--- |
| 🛡️ **Admin** | `admin@innovatesphere.in` | `admin123` | `/dashboard/admin.html` |
| 👤 **Citizen** | `rajesh@gmail.com` | `citizen123` | `/dashboard/citizen.html` |
| 🏛️ **University** | `rajesh@iitjharkhand.ac.in` | `univ123` | `/dashboard/university.html` |
| 🏭 **Industry** | `tata@steel.com` | `industry123` | `/dashboard/industry.html` |

*(Quick demo login buttons are also provided directly on the login page for 1-click access!)*

---

## 📁 Project Structure

```
├── config/
│   └── database.js               # MongoDB connection logic
├── controllers/
│   ├── authController.js         # Register, Login, Profile, Password reset
│   ├── challengeController.js    # Challenge CRUD, filters, assignments, feedback
│   ├── adminController.js        # User management, stats, broadcasts, logs
│   ├── notificationController.js # Real-time notification queries & mark-read
│   └── analyticsController.js    # Aggregations, monthly trends, performance
├── middleware/
│   ├── auth.js                   # JWT verification & role validation
│   ├── roleCheck.js              # RBAC middleware (admin, university, industry)
│   ├── upload.js                 # Multer file upload configuration
│   └── errorHandler.js           # Centralized API error handling
├── models/
│   ├── User.js                   # Multi-role user schema with bcrypt
│   ├── Challenge.js              # Challenge lifecycle, milestones, feedback
│   ├── University.js             # University profiles, departments, facilities
│   ├── IndustryPartner.js        # Industry & CSR profiles, capabilities
│   ├── Notification.js           # System and user notifications
│   └── ActivityLog.js            # Audit trail & activity logger
├── public/
│   ├── css/
│   │   ├── main.css              # Typography, layout, hero, responsive design
│   │   ├── dashboard.css         # Sidebar, metric cards, charts, task boards
│   │   ├── auth.css              # Split-screen auth layout & inputs
│   │   └── components.css        # Modals, toasts, skeleton loaders, badges
│   ├── js/
│   │   ├── utils.js              # API client, Toast, Confirm modal, JWT auth
│   │   ├── main.js               # Landing page interactions & live stats
│   │   ├── auth.js               # Login, registration, role switcher
│   │   └── dashboard/
│   │       ├── citizen.js        # Citizen dashboard, submission, feedback
│   │       ├── admin.js          # Admin dashboard, assignment, user table
│   │       ├── university.js     # University task board & milestone tracker
│   │       └── industry.js       # Industry project explorer & collaboration
│   ├── dashboard/
│   │   ├── citizen.html          # Citizen portal
│   │   ├── admin.html            # Admin portal
│   │   ├── university.html       # University portal
│   │   └── industry.html         # Industry portal
│   ├── index.html                # Landing page
│   ├── login.html                # Authentication page
│   ├── register.html             # Multi-role registration
│   ├── forgot-password.html      # Password recovery
│   └── 404.html                  # Error page
├── routes/
│   ├── auth.js
│   ├── challenges.js
│   ├── admin.js
│   ├── notifications.js
│   └── analytics.js
├── seeds/
│   └── seedData.js               # Complete data seeder with 50+ challenges
├── services/
│   ├── aiClassifier.js           # Smart domain keyword classifier & priority
│   └── notificationService.js    # In-app alerts and audit logging
├── .env
├── package.json
└── server.js                     # Main Express server entrypoint
```

---

## 🎯 Key Features & Workflow

1. **AI-Assisted Challenge Submission:** Real-time domain detection and priority recommendation as citizens type their challenge description.
2. **End-to-End Lifecycle:** `Draft` ➔ `Submitted` ➔ `Validated` ➔ `Assigned` ➔ `In Progress` ➔ `Testing` ➔ `Resolved` ➔ `Closed`.
3. **Multi-Role Dashboards:**
   - **Citizen:** Track status timeline, submit evidence photos/documents, view assigned HEI, rate and review solutions.
   - **University:** View assigned problems, update progress, manage milestone checklists.
   - **Industry / CSR:** Browse validated challenges seeking funding/mentorship, send collaboration proposals.
   - **Admin:** Validate submissions, route challenges to HEIs, manage users, monitor platform KPIs.
4. **Real-time Notifications:** Automated alerts triggered on submission, validation, assignment, milestone updates, and citizen feedback.
5. **Interactive Visualizations:** Chart.js powered graphs for submission trends, category distributions, resolution rates, and university performance scorecards.

---

## 📜 License
MIT License. Built for Smart India Hackathon — Problem Statement 2643.
