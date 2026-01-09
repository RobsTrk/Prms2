from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import json

# ==========================================
# 1. DATABASE SETUP (SQLAlchemy)
# ==========================================
SQLALCHEMY_DATABASE_URL = "sqlite:///./prms.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# ==========================================
# 2. DATABASE MODELS
# ==========================================
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)  # Plain text as per requirements
    role = Column(String)      # 'admin' or 'nurse'

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    dob = Column(String)
    gender = Column(String)
    status = Column(String, default="Stable")
    condition_summary = Column(Text, nullable=True)
    discharge_time = Column(String, default="TBD")
    vitals_history = Column(Text, default="[]") # JSON string for chart data
    instructions = Column(Text, default="[]")   # JSON string for orders

    records = relationship("ClinicalRecord", back_populates="patient", cascade="all, delete-orphan")

class ClinicalRecord(Base):
    __tablename__ = "records"
    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    date = Column(String)
    type = Column(String)
    description = Column(String)
    icon = Column(String)
    color = Column(String)

    patient = relationship("Patient", back_populates="records")

# Create Tables
Base.metadata.create_all(bind=engine)

# ==========================================
# 3. Pydantic Schemas (Validation)
# ==========================================
class LoginRequest(BaseModel):
    username: str
    password: str

class RecordCreate(BaseModel):
    date: str
    type: str
    description: str
    icon: str
    color: str

class RecordResponse(RecordCreate):
    id: int
    patient_id: int
    class Config:
        orm_mode = True

class PatientCreate(BaseModel):
    name: str
    dob: str
    gender: str
    status: str
    condition_summary: Optional[str] = None

class PatientUpdate(BaseModel):
    status: Optional[str] = None
    condition_summary: Optional[str] = None
    discharge_time: Optional[str] = None
    vitals_update: Optional[int] = None # Optional: to push a new value
    instructions_update: Optional[List[dict]] = None # Save entire list

class PatientResponse(BaseModel):
    id: int
    name: str
    dob: str
    gender: str
    status: str
    condition_summary: Optional[str] = None
    discharge_time: str
    history: List[RecordResponse] = []
    vitals_history: List[int] = []
    instructions: List[dict] = []

    class Config:
        orm_mode = True

# ==========================================
# 4. FASTAPI APP & ROUTES
# ==========================================

app = FastAPI(title="PRMS Backend", description="Real Python Backend for Patient Record Management")

@app.get("/")
def root():
    return {"status": "Backend running"}


# CORS (Allow Frontend to talk to Backend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- INITIAL DATA SEED ---
# We'll simple check if users exist, if not create them
def seed_data(db: Session):
    if not db.query(User).first():
        db.add(User(username="admin", password="123", role="admin"))
        db.add(User(username="nurse", password="123", role="nurse"))
        
        # Add a sample patient
        p1 = Patient(
            name="Jane Doe", 
            dob="1985-04-12", 
            gender="Female", 
            status="Critical",
            discharge_time="TBD",
            vitals_history=json.dumps([110, 118, 130, 142, 160, 155]),
            instructions=json.dumps([
                {"id": 1, "text": "Monitor BP every hour", "from": "Dr. Admin", "time": "09:00", "status": "pending"}
            ])
        )
        db.add(p1)
        db.commit()
        db.refresh(p1)
        
        db.add(ClinicalRecord(patient_id=p1.id, date="Jan 10, 09:00", type="Emergency", icon="fa-truck-medical", color="text-red-500", description="Admitted via Ambulance."))
        db.add(ClinicalRecord(patient_id=p1.id, date="Jan 10, 09:30", type="Vitals", icon="fa-heart-pulse", color="text-blue-500", description="BP 180/110, HR 110bpm."))
        
        db.commit()

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    seed_data(db)
    db.close()

# --- GLOBAL STATE (In-Memory for simplicity) ---
emergency_state = {"active": False}

@app.get("/emergency")
def get_emergency():
    return emergency_state

@app.post("/emergency")
def set_emergency(active: bool):
    emergency_state["active"] = active
    return emergency_state

# --- ENDPOINTS ---

@app.post("/login")
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == creds.username, User.password == creds.password).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"username": user.username, "role": user.role}

@app.get("/patients", response_model=List[PatientResponse])
def get_patients(db: Session = Depends(get_db)):
    patients = db.query(Patient).all()
    # Convert stored JSON text back to lists for the response
    results = []
    for p in patients:
        p_dict = {
            "id": p.id,
            "name": p.name,
            "dob": p.dob,
            "gender": p.gender,
            "status": p.status,
            "condition_summary": p.condition_summary,
            "discharge_time": p.discharge_time,
            "history": p.records,
            "vitals_history": json.loads(p.vitals_history) if p.vitals_history else [],
            "instructions": json.loads(p.instructions) if p.instructions else []
        }
        results.append(p_dict)
    return results

@app.post("/patients", response_model=PatientResponse)
def create_patient(p: PatientCreate, db: Session = Depends(get_db)):
    db_patient = Patient(
        name=p.name,
        dob=p.dob,
        gender=p.gender,
        status=p.status,
        condition_summary=p.condition_summary,
        discharge_time="TBD",
        # Initialize empty arrays
        vitals_history="[]",
        instructions="[]"
    )
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    
    # Add initial admission record
    init_record = ClinicalRecord(
        patient_id=db_patient.id,
        date="Just Now",
        type="Admission",
        icon="fa-hospital-user",
        color="text-medical-600",
        description="Patient admitted to unit."
    )
    db.add(init_record)
    db.commit()
    
    return {
        "id": db_patient.id,
        "name": db_patient.name,
        "dob": db_patient.dob,
        "gender": db_patient.gender,
        "status": db_patient.status,
        "condition_summary": db_patient.condition_summary,
        "discharge_time": db_patient.discharge_time,
        "history": [init_record],
        "vitals_history": [],
        "instructions": []
    }

@app.post("/patients/{patient_id}/record")
def add_record(patient_id: int, record: RecordCreate, db: Session = Depends(get_db)):
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    new_record = ClinicalRecord(
        patient_id=patient_id,
        date=record.date,
        type=record.type,
        description=record.description,
        icon=record.icon,
        color=record.color
    )
    db.add(new_record)
    db.commit()
    return {"message": "Record added", "record_id": new_record.id}

@app.put("/patients/{patient_id}/update")
def update_patient(patient_id: int, update: PatientUpdate, db: Session = Depends(get_db)):
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not db_patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    if update.status:
        db_patient.status = update.status
    if update.condition_summary:
        db_patient.condition_summary = update.condition_summary
    if update.discharge_time:
        db_patient.discharge_time = update.discharge_time
        
    # Handle Vitals Array Update (Simulated single source of truth append)
    if update.vitals_update:
        current_vitals = json.loads(db_patient.vitals_history) if db_patient.vitals_history else []
        current_vitals.append(update.vitals_update)
        if len(current_vitals) > 10:
            current_vitals.pop(0)
        db_patient.vitals_history = json.dumps(current_vitals)

    if update.instructions_update is not None:
        db_patient.instructions = json.dumps(update.instructions_update)

    db.commit()
    return {"message": "Patient updated"}
