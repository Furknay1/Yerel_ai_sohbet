# main.py - API Anahtar Kontrolü dahil son versiyon
#
# Bu güncellenmiş versiyon, model yükleme kontrolünü daha sağlam hale getirir.
# Ayrıca, model bulunamadığında kullanıcıya daha bilgilendirici mesajlar döner.

import os
import glob
import logging
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
from typing import List, Dict, Optional
from datetime import datetime
from llama_cpp import Llama
from fastapi.security import APIKeyHeader
from dotenv import load_dotenv

# Günlükleme ayarlarını yapılandır
logging.basicConfig(level=logging.INFO)

# .env dosyasını yükle
load_dotenv()

# FastAPI uygulamasını oluştur
app = FastAPI(
    title="Yerel AI Modelli Sohbet API'si",
    description="Yerel GGUF modelleri arasında geçiş yapabilen ve sohbetleri kaydeden bir API."
)

# CORS middleware'ini ekle
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Anahtarı Güvenlik Tanımları ---
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    raise RuntimeError("API_KEY ortam değişkeni ayarlanmamış! Lütfen bir .env dosyası oluşturun ve API anahtarınızı ekleyin.")

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def api_key_auth(api_key: str = Depends(api_key_header)):
    if not api_key or api_key != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya eksik API Anahtarı"
        )
    return api_key

# --- Veritabanı Ayarları ---
DATABASE_URL = "sqlite:///./chat_history.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Base = declarative_base()

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, default="Yeni Sohbet")
    created_at = Column(DateTime, default=datetime.now)
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"))
    sender = Column(String)  # "user" veya "bot"
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    conversation = relationship("Conversation", back_populates="messages")

Base.metadata.create_all(bind=engine)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Llama.cpp Model Yönetimi ---
loaded_llm = None
loaded_model_name = ""

def get_model(model_name: str):
    global loaded_llm, loaded_model_name
    
    if loaded_llm and loaded_model_name == model_name:
        logging.info(f"'{model_name}' modeli zaten yüklü, tekrar yüklenmiyor.")
        return loaded_llm

    model_dir = os.getenv("GGUF_MODEL_PATH", "models")
    full_path = os.path.join(model_dir, f"{model_name}.gguf")
    
    logging.info(f"BİLGİ: '{model_name}' modeli yükleniyor. Aranılan yol: {os.path.abspath(full_path)}")

    if not os.path.exists(full_path):
        logging.error(f"HATA: Model dosyası bulunamadı. Lütfen '{full_path}' yolunu kontrol edin.")
        raise HTTPException(status_code=404, detail=f"Model '{model_name}.gguf' bulunamadı.")

    try:
        llm = Llama(
            model_path=full_path,
            n_ctx=4096,  # Bağlam uzunluğu (gereksinime göre ayarlanabilir)
            n_threads=8, # CPU çekirdek sayısı
            n_gpu_layers=-1 # GPU hızlandırmasını tüm katmanlar için kullanır
        )
        loaded_llm = llm
        loaded_model_name = model_name
        logging.info(f"BİLGİ: '{model_name}' modeli başarıyla yüklendi.")
        return loaded_llm
    except Exception as e:
        logging.error(f"HATA: '{model_name}' modeli yüklenirken bir hata oluştu: {e}")
        raise HTTPException(status_code=500, detail=f"AI modeli yüklenemedi veya kullanılamıyor: {e}")

# --- API Şemaları ---
class MessageCreate(BaseModel):
    conversation_id: Optional[int]
    message: str
    model: str

class ConversationTitleUpdate(BaseModel):
    new_title: str

# --- API Uç Noktaları ---
@app.get("/")
def read_root():
    return {"message": "Yerel AI Sohbet API'si çalışıyor."}

@app.get("/models", dependencies=[Depends(api_key_auth)])
async def get_models(api_key: str = Depends(api_key_auth)):
    model_dir = os.getenv("GGUF_MODEL_PATH", "models")
    if not os.path.exists(model_dir):
        return []
    
    model_files = glob.glob(os.path.join(model_dir, "*.gguf"))
    models = [os.path.basename(f).replace(".gguf", "") for f in model_files]
    logging.info(f"Bulunan modeller: {models}")
    return models

@app.post("/chat", dependencies=[Depends(api_key_auth)])
async def chat_with_model(msg: MessageCreate, db: Session = Depends(get_db)):
    llm = get_model(msg.model)

    # Sohbeti bul veya yeni bir sohbet oluştur
    if msg.conversation_id:
        conversation = db.query(Conversation).filter(Conversation.id == msg.conversation_id).first()
        if not conversation:
            raise HTTPException(status_code=404, detail=f"Sohbet ID {msg.conversation_id} bulunamadı.")
        
        # Sohbet geçmişini al
        messages_db = db.query(Message).filter(Message.conversation_id == msg.conversation_id).order_by(Message.created_at).all()
    else:
        conversation = Conversation(title=msg.message[:50] + "...")
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        messages_db = []

    # Mesajı veritabanına ekle
    user_message = Message(conversation_id=conversation.id, sender="user", text=msg.message)
    db.add(user_message)
    db.commit()
    db.refresh(user_message)

    # Sohbet geçmişini prompt için hazırla
    full_prompt = ""
    # Gerekirse bir sistem prompt'u ekleyin
    # full_prompt += "Sen yardımsever bir yapay zeka asistanısın.\n\n" 
    for m in messages_db:
        full_prompt += f"{m.sender}: {m.text}\n"
    
    # Yeni mesajı ve beklenen bot yanıtı formatını ekle
    full_prompt += f"user: {msg.message}\n"
    full_prompt += f"bot:"

    print(f"BİLGİ: '{msg.model}' modeline istek gönderiliyor...")
    print(f"GÖNDERİLEN PROMPT:\n{full_prompt}")

    output = llm(
        full_prompt,
        max_tokens=4000,
        stop=["user:", "bot:"], # Modeli durdurmak için yeni stop kelimeleri
        echo=False
    )
    bot_response = output['choices'][0]['text'].strip()

    bot_message = Message(conversation_id=conversation.id, sender="bot", text=bot_response)
    db.add(bot_message)
    db.commit()

    return {"conversation_id": conversation.id, "response": bot_response}

@app.get("/conversations", dependencies=[Depends(api_key_auth)])
async def get_conversations(db: Session = Depends(get_db)):
    conversations = db.query(Conversation).order_by(Conversation.created_at.desc()).all()
    return [{"id": c.id, "title": c.title, "created_at": c.created_at} for c in conversations]

@app.put("/conversations/{conversation_id}", dependencies=[Depends(api_key_auth)])
async def update_conversation_title(conversation_id: int, new_title: ConversationTitleUpdate, db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail=f"Sohbet ID {conversation_id} bulunamadı.")

    conversation.title = new_title.new_title
    db.commit()
    db.refresh(conversation)
    return {"message": "Sohbet başlığı başarıyla güncellendi.", "conversation": {"id": conversation.id, "title": conversation.title}}

@app.get("/conversations/{conversation_id}/messages", dependencies=[Depends(api_key_auth)])
async def get_messages(conversation_id: int, db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail=f"Sohbet ID {conversation_id} bulunamadı.")

    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at).all()
    return [{"role": msg.sender, "content": msg.text} for msg in messages]

@app.delete("/conversations/{conversation_id}", dependencies=[Depends(api_key_auth)])
async def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    logging.info(f"Sohbet ID {conversation_id} silme isteği alındı.")
    try:
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            raise HTTPException(status_code=404, detail=f"Sohbet ID {conversation_id} bulunamadı.")

        db.delete(conversation)
        db.commit()
        logging.info(f"Sohbet ID {conversation_id} başarıyla silindi.")
        return {"message": f"Sohbet ID {conversation_id} başarıyla silindi."}
    except Exception as e:
        logging.error(f"Sohbet ID {conversation_id} silinirken bir hata oluştu: {e}")
        raise HTTPException(status_code=500, detail=f"Sohbet silinirken bir hata oluştu: {e}")