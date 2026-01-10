# PRMS+ | Patient Record Management System

PRMS+ is a modern, responsive, and intelligent hospital dashboard designed to streamline clinical workflows between doctors and nurses. It features real-time vital monitoring, AI-powered clinical snapshots, and a robust emergency management system.

## 🚀 Key Features

- **Centralized Dashboard**: Real-time patient queue with status indicators (Stable, Recovering, Critical).
- **Clinical Orders & Instructions**: Doctors can issue structured, timestamped instructions that nurses can track and mark as completed.
- **Live Vitals Monitoring**: Dynamic Chart.js integration for tracking heart rate and other critical vitals.
- **AI Clinical Snapshot**: Intelligent patient analysis to provide a quick clinical overview.
- **Code Red Emergency System**: A nurse-triggered, hospital-wide alert system for critical "Code Red" events with real-time state synchronization.
- **Voice Scribe**: Integrated voice recognition for nurses to dictate clinical notes hands-free.
- **Radiology Integration**: Dedicated module for uploading and viewing scan reports (X-Ray, MRI, CT, etc.).
- **Role-Based Access Control**: Tailored UI experiences for Physicians (Admins) and Registered Nurses.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Tailwind CSS, JavaScript (Vanilla), FontAwesome, Chart.js.
- **Backend**: Python 3.x, FastAPI, SQLAlchemy.
- **Database**: SQLite (local-first with Vercel/Production compatibility).
- **Deployment**: Configured for Vercel and similar serverless/cloud platforms.

## 📂 Project Structure

```text
├── BACKEND/
│   ├── main.py            # FastAPI Application & API Endpoints
│   ├── requirements.txt   # Backend Dependencies
│   └── prms.db            # Local SQLite Database (Auto-generated)
├── FRONTEND/
│   ├── index.html         # Main Dashboard Interface
│   ├── login.html         # Authentication Page
│   └── app.js             # Integrated Frontend Logic
├── vercel.json            # Deployment Configuration
└── README.md              # Documentation
```

## 🛠️ Local Installation

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/RobsTrk/pmrs3.git
    cd pmrs3
    ```

2.  **Setup the Backend**:
    ```bash
    cd BACKEND
    pip install -r requirements.txt
    uvicorn main:app --reload
    ```

3.  **Launch the Frontend**:
    - Open `FRONTEND/login.html` in your browser.
    - **Default Credentials**:
        - **Admin**: `admin` / `123`
        - **Nurse**: `nurse` / `123`

## 🌐 Deployment

The project is pre-configured for Vercel. 
- The `vercel.json` file handles the routing for the FastAPI backend as serverless functions.
- The backend is optimized to use `/tmp/prms.db` in production environments.

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for more information.

---
*Built with ❤️ for better patient care.*
