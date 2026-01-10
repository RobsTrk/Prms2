from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import json
import os

# ==========================================
# 1. DATABASE SETUP (SQLAlchemy)
# ==========================================
if os.environ.get("VERCEL"):
    SQLALCHEMY_DATABASE_URL = "sqlite:////tmp/prms.db"
else:
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
    password = Column(String)
    role = Column(String)

class Patient(Base):
    __tablename__ = "patients"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    dob = Column(String)
    gender = Column(String)
    status = Column(String, default="Stable")
    condition_summary = Column(Text, nullable=True)
    discharge_time = Column(String, default="TBD")
    vitals_history = Column(Text, default="[]") 
    instructions = Column(Text, default="[]")
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

# ==========================================
# 3. SCHEMAS
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

class EmergencyUpdate(BaseModel):
    active: bool

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
    vitals_update: Optional[int] = None
    instructions_update: Optional[List[dict]] = None

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
# 4. APP & SEEDING
# ==========================================
app = FastAPI(title="PRMS Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_data(db: Session):
    if not db.query(User).first():
        db.add(User(username="admin", password="123", role="admin"))
        db.add(User(username="nurse", password="123", role="nurse"))
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
        db.commit()

# INITIALIZE DB ON STARTUP (For Vercel)
Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_data(db)

# --- EMERGENCY STATE ---
emergency_state = {"active": False}

@app.get("/")
def root():
    return {"status": "Backend running"}

@app.get("/emergency")
def get_emergency():
    return emergency_state

@app.post("/emergency")
def set_emergency(update: EmergencyUpdate):
    emergency_state["active"] = update.active
    return emergency_state

# ==========================================
# 5. ENDPOINTS
# ==========================================
@app.post("/login")
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == creds.username, User.password == creds.password).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"username": user.username, "role": user.role}

@app.get("/patients", response_model=List[PatientResponse])
def get_patients(db: Session = Depends(get_db)):
    patients = db.query(Patient).all()
    results = []
    for p in patients:
        results.append({
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
        })
    return results

@app.post("/patients", response_model=PatientResponse)
def create_patient(p: PatientCreate, db: Session = Depends(get_db)):
    db_patient = Patient(name=p.name, dob=p.dob, gender=p.gender, status=p.status, condition_summary=p.condition_summary, discharge_time="TBD", vitals_history="[]", instructions="[]")
    db.add(db_patient); db.commit(); db.refresh(db_patient)
    init_rec = ClinicalRecord(patient_id=db_patient.id, date="Just Now", type="Admission", icon="fa-hospital-user", color="text-medical-600", description="Patient admitted.")
    db.add(init_rec); db.commit()
    return {
        "id": db_patient.id, "name": db_patient.name, "dob": db_patient.dob, "gender": db_patient.gender, "status": db_patient.status,
        "condition_summary": db_patient.condition_summary, "discharge_time": db_patient.discharge_time, "history": [init_rec], "vitals_history": [], "instructions": []
    }

@app.post("/patients/{patient_id}/record")
def add_record(patient_id: int, record: RecordCreate, db: Session = Depends(get_db)):
    new_record = ClinicalRecord(patient_id=patient_id, date=record.date, type=record.type, description=record.description, icon=record.icon, color=record.color)
    db.add(new_record); db.commit()
    return {"message": "Record added"}

@app.put("/patients/{patient_id}/update")
def update_patient(patient_id: int, update: PatientUpdate, db: Session = Depends(get_db)):
    db_patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not db_patient: raise HTTPException(status_code=404, detail="Not found")
    if update.status: db_patient.status = update.status
    if update.condition_summary: db_patient.condition_summary = update.condition_summary
    if update.discharge_time: db_patient.discharge_time = update.discharge_time
    if update.vitals_update:
        v = json.loads(db_patient.vitals_history) if db_patient.vitals_history else []
        v.append(update.vitals_update)
        db_patient.vitals_history = json.dumps(v[-10:])
    if update.instructions_update is not None:
        db_patient.instructions = json.dumps(update.instructions_update)
    db.commit()
    return {"message": "Updated"}
