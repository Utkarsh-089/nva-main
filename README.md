Nutri Vision Flat
A minimal yet powerful nutrition tracking application built with Express.js and MongoDB. Track your meals, monitor daily nutritional goals, and get AI-powered insights about your diet using Google's Gemini API.

Features
User Authentication - Secure sign-up and login with session management
Profile Management - Create detailed health profiles with medical conditions, dietary restrictions, and allergies
Nutrition Tracking - Log meals and track nutritional intake
AI-Powered Analysis - Get intelligent insights about your nutrition using Google Gemini API
Daily Goals - Set and monitor daily targets for calories, protein, carbs, fat, and water intake
Personalized Settings - Customize notifications, privacy settings, and accessibility options
Dashboard - View nutritional summaries and health insights
Responsive Design - Works seamlessly on desktop and mobile devices
Tech Stack
Backend: Node.js, Express.js
Database: MongoDB with Mongoose ODM
Frontend: HTML, CSS, Vanilla JavaScript
AI Integration: Google Generative AI (Gemini)
Environment Management: dotenv
Project Structure
nva-main/
├── app.js                 # Express application entry point
├── package.json           # Project dependencies and metadata
│
├── public/                # Frontend assets
│   ├── index.html        # Landing page
│   ├── auth.html         # Authentication page
│   ├── onboarding.html   # User onboarding flow
│   ├── dashboard.html    # Main dashboard
│   ├── profile.html      # User profile page
│   ├── settings.html     # Settings page
│   ├── client.js         # Frontend JavaScript
│   └── styles.css        # Global styles
│
└── server/               # Backend code
    ├── auth.js           # Authentication middleware
    ├── db.js             # MongoDB connection
    ├── models.js         # Mongoose schemas
    ├── utils.js          # Utility functions
    ├── routes/           # API route handlers
    │   ├── auth.js       # Authentication endpoints
    │   ├── profile.js    # Profile management endpoints
    │   ├── dashboard.js  # Dashboard data endpoints
    │   └── logs.js       # Food logging endpoints
    └── services/         # Business logic services
        └── ai.js         # AI integration service
Installation
Prerequisites
Node.js (v14 or higher)
MongoDB (local or cloud instance)
Google API key for Gemini API
Setup Steps
Clone the repository

git clone <repository-url>
cd nva-main
Install dependencies

npm install
Create a .env file

PORT=3000
MONGODB_URI=mongodb://localhost:27017/nutri-vision
GEMINI_API_KEY=your-google-api-key-here
GEMINI_MODEL=gemini-2.5-flash
Start the application

npm start
For development with auto-reload:

npm run dev
Access the application

http://localhost:3000
API Endpoints
Authentication
POST /api/auth/signup - User registration
POST /api/auth/login - User login
POST /api/auth/logout - User logout
Profile
GET /api/profile - Get user profile
PUT /api/profile - Update user profile
PUT /api/profile/goals - Update daily nutritional goals
PUT /api/profile/settings - Update user settings
Dashboard
GET /api/dashboard - Get dashboard data
GET /api/dashboard/summary - Get nutritional summary
Food Logs
POST /api/logs - Create food log entry
GET /api/logs - Get user's food logs
DELETE /api/logs/:id - Delete a food log entry
Health Check
GET /api/health - API health status
Database Models
Profile Schema
Basic info: name, email, password
Health data: age, gender, activity level, primary goal
Medical info: conditions, dietary restrictions, allergies
Daily goals: calories, protein, carbs, fat, water
Settings: notifications, privacy, accessibility
Session Schema
Stores user sessions for authentication
Token-based session management
Food Item Schema
Tracks individual food items with nutritional data
Links to user profiles
Configuration
All configuration is managed through environment variables in the .env file:

PORT - Server port (default: 3000)
MONGODB_URI - MongoDB connection string
GEMINI_API_KEY - Google API key for AI features
GEMINI_MODEL - Gemini model version (default: gemini-2.5-flash)
Dependencies
express - Web framework
mongoose - MongoDB ODM
dotenv - Environment variable management
Security Features
Password hashing for secure storage
CORS support for cross-origin requests
Session-based authentication
Privacy settings with data encryption options
Input validation and sanitization
CORS
The application supports CORS with the following configuration:

Allows requests from all origins
Enables standard HTTP methods (GET, POST, PUT, DELETE, OPTIONS)
Supports common headers including Authorization
Error Handling
The API returns appropriate HTTP status codes:

200 - Success
400 - Bad request
401 - Unauthorized
404 - Not found
409 - Conflict (e.g., duplicate email)
500 - Server error
File Size Limits
The API accepts JSON payloads up to 6MB, suitable for image-based nutrition tracking.

Contributing
Fork the repository
Create a feature branch
Make your changes
Submit a pull request
**Created with❤️by Utkarsh Chauhan
